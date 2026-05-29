import { describe, it, expect, beforeEach, vi } from 'vitest';
import CodexAdapter from '../src/main/adapters/codex.adapter.js';
import { LineDelimitedJsonParser } from '../src/main/parsers/index.js';

describe('CodexAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new CodexAdapter({ apiKey: 'test-key-123' });
  });

  describe('constructor', () => {
    it('sets defaults', () => {
      expect(adapter.name).toBe('codex');
      expect(adapter.execPath).toBe('codex');
      expect(adapter.sandboxMode).toBe('suggest');
      expect(adapter.timeoutMs).toBe(600_000);
      expect(adapter.status).toBe('idle');
    });

    it('extends AgentAdapter interface', () => {
      expect(typeof adapter.spawn).toBe('function');
      expect(typeof adapter.kill).toBe('function');
      expect(typeof adapter.healthCheck).toBe('function');
      expect(typeof adapter.execute).toBe('function');
      expect(typeof adapter.sendInput).toBe('function');
      expect(typeof adapter.readStream).toBe('function');
      expect(typeof adapter.resumeSession).toBe('function');
      expect(typeof adapter.getOutputParser).toBe('function');
    });

    it('accepts custom config', () => {
      const custom = new CodexAdapter({
        name: 'my-codex',
        execPath: '/usr/local/bin/codex',
        model: 'o3',
        sandboxMode: 'full-auto',
        approvalPolicy: 'auto-approve',
        timeoutMs: 30000,
      });
      expect(custom.name).toBe('my-codex');
      expect(custom.execPath).toBe('/usr/local/bin/codex');
      expect(custom.model).toBe('o3');
      expect(custom.sandboxMode).toBe('full-auto');
      expect(custom.approvalPolicy).toBe('auto-approve');
      expect(custom.timeoutMs).toBe(30000);
    });
  });

  describe('_buildBaseArgs', () => {
    it('includes --quiet by default', () => {
      expect(adapter._buildBaseArgs()).toContain('--quiet');
    });

    it('includes --model when set', () => {
      adapter.model = 'o3';
      const args = adapter._buildBaseArgs();
      expect(args).toContain('--model');
      expect(args[args.indexOf('--model') + 1]).toBe('o3');
    });

    it('includes --full-auto for full-auto sandbox mode', () => {
      adapter.sandboxMode = 'full-auto';
      expect(adapter._buildBaseArgs()).toContain('--full-auto');
    });

    it('includes --auto-edit for auto-edit sandbox mode', () => {
      adapter.sandboxMode = 'auto-edit';
      expect(adapter._buildBaseArgs()).toContain('--auto-edit');
    });

    it('includes --approval-policy when set', () => {
      adapter.approvalPolicy = 'never';
      const args = adapter._buildBaseArgs();
      expect(args).toContain('--approval-policy');
      expect(args[args.indexOf('--approval-policy') + 1]).toBe('never');
    });
  });

  describe('_buildEnv', () => {
    it('includes OPENAI_API_KEY when apiKey is set', () => {
      const env = adapter._buildEnv();
      expect(env.OPENAI_API_KEY).toBe('test-key-123');
    });

    it('merges params env', () => {
      const env = adapter._buildEnv({ EXTRA: 'val' });
      expect(env.EXTRA).toBe('val');
      expect(env.OPENAI_API_KEY).toBe('test-key-123');
    });
  });

  describe('healthCheck', () => {
    it('returns ok when codex --version succeeds', async () => {
      // Use 'echo' as a stand-in to test the success path
      const echoAdapter = new CodexAdapter({ execPath: 'echo', apiKey: 'k' });
      const result = await echoAdapter.healthCheck();
      expect(result.ok).toBe(true);
      expect(result.checks.cli).toBe(true);
      expect(result.checks.apiKey).toBe(true);
    });

    it('returns ok=false for missing executable', async () => {
      const bad = new CodexAdapter({ execPath: 'nonexistent_codex_binary_xyz' });
      const result = await bad.healthCheck();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('reports apiKey missing in checks', async () => {
      const noKey = new CodexAdapter({ execPath: 'echo' });
      delete process.env.OPENAI_API_KEY;
      const result = await noKey.healthCheck();
      expect(result.ok).toBe(true);
      expect(result.checks.apiKey).toBe(false);
    });
  });

  describe('execute', () => {
    it('runs a command and returns output', async () => {
      const echoAdapter = new CodexAdapter({ execPath: 'echo' });
      const result = await echoAdapter.execute({ description: 'hello codex' });
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('hello codex');
    });

    it('returns non-zero exit code on failure', async () => {
      const failAdapter = new CodexAdapter({ execPath: 'false' });
      const result = await failAdapter.execute({ description: 'test' });
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('spawn / kill / resumeSession', () => {
    it('spawns and tracks instances', async () => {
      const sleepAdapter = new CodexAdapter({ execPath: 'sleep', args: ['30'] });
      const { instanceId, pid } = await sleepAdapter.spawn();
      expect(instanceId).toMatch(/^codex-/);
      expect(pid).toBeGreaterThan(0);
      expect(sleepAdapter.status).toBe('running');

      const resume = await sleepAdapter.resumeSession(instanceId);
      expect(resume.alive).toBe(true);

      await sleepAdapter.kill(instanceId);
    });

    it('kill throws on unknown instance', async () => {
      await expect(adapter.kill('nope')).rejects.toThrow('Instance not found');
    });

    it('resumeSession returns alive=false for unknown instance', async () => {
      const result = await adapter.resumeSession('nope');
      expect(result.alive).toBe(false);
    });
  });

  describe('sendInput / readStream', () => {
    it('sendInput throws on unknown instance', async () => {
      await expect(adapter.sendInput('nope', 'data')).rejects.toThrow('Instance not found');
    });

    it('readStream throws on unknown instance', () => {
      expect(() => adapter.readStream('nope')).toThrow('Instance not found');
    });
  });

  describe('getOutputParser', () => {
    it('returns LineDelimitedJsonParser', () => {
      const parser = adapter.getOutputParser();
      expect(parser).toBeInstanceOf(LineDelimitedJsonParser);
    });

    it('parser handles Codex-style JSON lines', () => {
      const parser = adapter.getOutputParser();
      const chunk = '{"type":"message","content":"Hello"}\n{"type":"tool_use","content":"ls"}\n';
      const msgs = parser.parse(chunk);
      expect(msgs).toHaveLength(2);
      expect(msgs[0].type).toBe('message');
      expect(msgs[0].text).toBe('Hello');
      expect(msgs[1].type).toBe('tool_use');
    });

    it('parser falls back to text for non-JSON lines', () => {
      const parser = adapter.getOutputParser();
      const msgs = parser.parse('plain text output\n');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].type).toBe('text');
      expect(msgs[0].text).toBe('plain text output');
    });
  });
});
