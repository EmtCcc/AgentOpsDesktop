import { describe, it, expect, beforeEach } from 'vitest';
import { AgentAdapter, AdapterRegistry } from '../src/main/adapter-registry.js';
import GenericCliAdapter from '../src/main/adapters/generic-cli.adapter.js';

describe('AgentAdapter (base class)', () => {
  it('throws on unimplemented methods', async () => {
    const adapter = new AgentAdapter({ name: 'test' });
    await expect(adapter.spawn()).rejects.toThrow('not implemented');
    await expect(adapter.kill()).rejects.toThrow('not implemented');
    await expect(adapter.healthCheck()).rejects.toThrow('not implemented');
    await expect(adapter.execute()).rejects.toThrow('not implemented');
    await expect(adapter.sendInput('id', 'data')).rejects.toThrow('not implemented');
    await expect(adapter.resumeSession('id')).rejects.toThrow('not implemented');
    expect(() => adapter.readStream('id')).toThrow('not implemented');
    expect(adapter.getOutputParser()).toBeInstanceOf(require('../src/main/parsers/output-parser.js').OutputParser);
  });

  it('has default properties', () => {
    const adapter = new AgentAdapter({ name: 'my-adapter', type: 'custom' });
    expect(adapter.name).toBe('my-adapter');
    expect(adapter.type).toBe('custom');
    expect(adapter.status).toBe('idle');
  });
});

describe('AdapterRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('registers and retrieves adapter classes', () => {
    registry.registerClass('generic-cli', GenericCliAdapter);
    expect(registry.getClass('generic-cli')).toBe(GenericCliAdapter);
    expect(registry.listRegistered()).toEqual(['generic-cli']);
  });

  it('prevents duplicate class registration', () => {
    registry.registerClass('generic-cli', GenericCliAdapter);
    expect(() => registry.registerClass('generic-cli', GenericCliAdapter)).toThrow('already registered');
  });

  it('loads and unloads adapter instances', () => {
    registry.registerClass('generic-cli', GenericCliAdapter);
    const adapter = registry.load('generic-cli', { execPath: 'echo' });
    expect(adapter).toBeInstanceOf(GenericCliAdapter);
    expect(registry.get('generic-cli')).toBe(adapter);
    expect(registry.listLoaded()).toHaveLength(1);

    registry.unload('generic-cli');
    expect(registry.get('generic-cli')).toBeNull();
    expect(registry.listLoaded()).toHaveLength(0);
  });

  it('throws on loading unknown type', () => {
    expect(() => registry.load('unknown')).toThrow('No adapter class registered');
  });

  it('throws on duplicate load', () => {
    registry.registerClass('generic-cli', GenericCliAdapter);
    registry.load('generic-cli', { execPath: 'echo' });
    expect(() => registry.load('generic-cli')).toThrow('already loaded');
  });

  it('unregisters classes', () => {
    registry.registerClass('generic-cli', GenericCliAdapter);
    registry.unregisterClass('generic-cli');
    expect(registry.getClass('generic-cli')).toBeNull();
    expect(registry.listRegistered()).toEqual([]);
  });

  it('healthCheck on loaded adapter', async () => {
    registry.registerClass('generic-cli', GenericCliAdapter);
    registry.load('generic-cli', { execPath: 'echo' });
    const result = await registry.healthCheck('generic-cli');
    expect(result.ok).toBe(true);
  });

  it('healthCheck on non-loaded adapter returns error', async () => {
    const result = await registry.healthCheck('nonexistent');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not loaded');
  });

  it('loadFromConfigs loads from config array', async () => {
    registry.registerClass('generic-cli', GenericCliAdapter);
    const results = await registry.loadFromConfigs([
      { type: 'generic-cli', config: { execPath: 'echo' } },
    ]);
    expect(results).toEqual([{ type: 'generic-cli', ok: true }]);
    expect(registry.get('generic-cli')).toBeInstanceOf(GenericCliAdapter);
  });

  it('loadFromConfigs reports errors gracefully', async () => {
    const results = await registry.loadFromConfigs([
      { type: 'bad-adapter', classPath: '/nonexistent/path.js' },
    ]);
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toBeTruthy();
  });

  it('emits events on load/unload', () => {
    const events = [];
    registry.on('adapter:loaded', (d) => events.push({ event: 'loaded', ...d }));
    registry.on('adapter:unloaded', (d) => events.push({ event: 'unloaded', ...d }));

    registry.registerClass('generic-cli', GenericCliAdapter);
    registry.load('generic-cli', { execPath: 'echo' });
    registry.unload('generic-cli');

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('loaded');
    expect(events[1].event).toBe('unloaded');
  });
});

describe('GenericCliAdapter', () => {
  it('healthCheck succeeds for installed command', async () => {
    const adapter = new GenericCliAdapter({ execPath: 'echo' });
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(true);
  });

  it('healthCheck fails for missing command', async () => {
    const adapter = new GenericCliAdapter({ execPath: 'nonexistent_command_xyz' });
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(false);
  });

  it('healthCheck fails without execPath', async () => {
    const adapter = new GenericCliAdapter({});
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(false);
  });

  it('execute runs a command and returns output', async () => {
    const adapter = new GenericCliAdapter({ execPath: 'echo', args: ['hello'] });
    const result = await adapter.execute({ title: 'test' });
    expect(result.exitCode).toBe(0);
    expect(result.output.trim()).toBe('hello');
  });

  it('sendInput writes to running process stdin', async () => {
    const adapter = new GenericCliAdapter({ execPath: 'cat' });
    const { instanceId } = await adapter.spawn();
    await adapter.sendInput(instanceId, 'hello world\n');
    // Give cat time to echo back
    const result = await new Promise((resolve) => {
      let out = '';
      adapter.readStream(instanceId).on('data', (d) => {
        out += d;
        if (out.includes('hello world')) resolve(out);
      });
      setTimeout(() => resolve(out), 2000);
    });
    expect(result).toContain('hello world');
    await adapter.kill(instanceId);
  });

  it('sendInput throws on nonexistent instance', async () => {
    const adapter = new GenericCliAdapter({ execPath: 'cat' });
    await expect(adapter.sendInput('nope', 'data')).rejects.toThrow('Instance not found');
  });

  it('readStream returns a readable stream', async () => {
    const adapter = new GenericCliAdapter({ execPath: 'echo', args: ['streamed'] });
    const { instanceId } = await adapter.spawn();
    const stream = adapter.readStream(instanceId, 'stdout');
    expect(stream).toBeDefined();
    expect(typeof stream.on).toBe('function');
    const data = await new Promise((resolve) => {
      stream.on('data', (d) => resolve(d.toString()));
      setTimeout(() => resolve(''), 2000);
    });
    expect(data).toContain('streamed');
    await adapter.kill(instanceId);
  });

  it('readStream throws on nonexistent instance', () => {
    const adapter = new GenericCliAdapter({ execPath: 'echo' });
    expect(() => adapter.readStream('nope')).toThrow('Instance not found');
  });

  it('resumeSession returns alive for running instance', async () => {
    const adapter = new GenericCliAdapter({ execPath: 'sleep', args: ['60'] });
    const { instanceId } = await adapter.spawn();
    const result = await adapter.resumeSession(instanceId);
    expect(result.alive).toBe(true);
    expect(result.pid).toBeGreaterThan(0);
    await adapter.kill(instanceId);
  });

  it('resumeSession returns not alive for unknown instance', async () => {
    const adapter = new GenericCliAdapter({ execPath: 'echo' });
    const result = await adapter.resumeSession('nope');
    expect(result.alive).toBe(false);
  });

  it('getOutputParser returns an OutputParser that parses output', () => {
    const adapter = new GenericCliAdapter({ execPath: 'echo' });
    const parser = adapter.getOutputParser();
    expect(parser).toBeInstanceOf(require('../src/main/parsers/output-parser.js').OutputParser);
    const msgs = parser.parse('line1\nline2\n\nline3\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('line1\nline2\n\nline3\n');
  });
});
