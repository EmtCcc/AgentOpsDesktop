/**
 * Phase 2 Round 1 回归测试 — CMPAAA-317, CMPAAA-319, CMPAAA-321
 *
 * 覆盖：
 *   - AgentAdapter 基类接口 (CMPAAA-317: sendInput/readStream/resumeSession)
 *   - AdapterRegistry 注册/加载/卸载
 *   - ClaudeCodeAdapter 全流程 (CMPAAA-319: spawn→execute→kill→healthCheck)
 *   - CodexAdapter sandbox mode + API key 注入 (CMPAAA-321)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { EventEmitter } from 'events';
import { AgentAdapter, AdapterRegistry } from '../../src/main/adapter-registry.js';

// ─── AgentAdapter 基类 ─────────────────────────────────────────

describe('AgentAdapter base (CMPAAA-317)', () => {
  it('all abstract methods throw not-implemented', async () => {
    const adapter = new AgentAdapter({ name: 'test' });
    await expect(adapter.spawn({})).rejects.toThrow('not implemented');
    await expect(adapter.kill('x')).rejects.toThrow('not implemented');
    await expect(adapter.healthCheck()).rejects.toThrow('not implemented');
    await expect(adapter.execute({})).rejects.toThrow('not implemented');
    await expect(adapter.sendInput('x', 'data')).rejects.toThrow('not implemented');
    expect(() => adapter.readStream('x')).toThrow('not implemented');
    await expect(adapter.resumeSession('x')).rejects.toThrow('not implemented');
  });

  it('getOutputParser returns PlainTextParser by default', () => {
    const adapter = new AgentAdapter();
    const parser = adapter.getOutputParser();
    expect(parser.constructor.name).toBe('PlainTextParser');
  });

  it('constructor assigns defaults', () => {
    const adapter = new AgentAdapter();
    expect(adapter.type).toBe('custom');
    expect(adapter.status).toBe('idle');
    expect(adapter.id).toBeDefined();
  });
});

// ─── AdapterRegistry ────────────────────────────────────────────

describe('AdapterRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('registerClass and load', () => {
    class TestAdapter extends AgentAdapter {
      async healthCheck() { return { ok: true }; }
    }
    registry.registerClass('test', TestAdapter);
    expect(registry.listRegistered()).toContain('test');

    const adapter = registry.load('test', { name: 'my-test' });
    expect(adapter).toBeInstanceOf(TestAdapter);
    expect(adapter.name).toBe('my-test');
    expect(registry.get('test')).toBe(adapter);
    expect(registry.listLoaded()).toHaveLength(1);
  });

  it('registerClass throws on duplicate', () => {
    registry.registerClass('dup', AgentAdapter);
    expect(() => registry.registerClass('dup', AgentAdapter)).toThrow('already registered');
  });

  it('load throws for unknown type', () => {
    expect(() => registry.load('unknown')).toThrow('No adapter class registered');
  });

  it('load throws for already loaded type', () => {
    registry.registerClass('t', AgentAdapter);
    registry.load('t');
    expect(() => registry.load('t')).toThrow('already loaded');
  });

  it('unload removes adapter', async () => {
    registry.registerClass('t', AgentAdapter);
    registry.load('t');
    const result = await registry.unload('t');
    expect(result).toBe(true);
    expect(registry.get('t')).toBeNull();
  });

  it('unload returns false for unknown', async () => {
    expect(await registry.unload('nope')).toBe(false);
  });

  it('healthCheck delegates to adapter', async () => {
    class HealthyAdapter extends AgentAdapter {
      async healthCheck() { return { ok: true, version: '1.0' }; }
    }
    registry.registerClass('h', HealthyAdapter);
    registry.load('h');
    const result = await registry.healthCheck('h');
    expect(result.ok).toBe(true);
    expect(result.version).toBe('1.0');
  });

  it('healthCheck returns error for unloaded adapter', async () => {
    const result = await registry.healthCheck('missing');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not loaded');
  });

  it('healthCheck catches adapter errors', async () => {
    class BadAdapter extends AgentAdapter {
      async healthCheck() { throw new Error('crash'); }
    }
    registry.registerClass('bad', BadAdapter);
    registry.load('bad');
    const result = await registry.healthCheck('bad');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('crash');
  });

  it('unregisterClass cleans up', () => {
    registry.registerClass('u', AgentAdapter);
    registry.unregisterClass('u');
    expect(registry.listRegistered()).not.toContain('u');
  });
});

// ─── ClaudeCodeAdapter ─────────────────────────────────────────

describe('ClaudeCodeAdapter (CMPAAA-319)', () => {
  let ClaudeCodeAdapter;
  let adapter;
  const MOCK_CLAUDE = path.resolve(__dirname, '../fixtures/mock-claude-code.js');

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/main/adapters/claude-code.adapter.js');
    ClaudeCodeAdapter = mod.default;
    adapter = new ClaudeCodeAdapter({
      execPath: MOCK_CLAUDE,
    });
  });

  afterEach(() => {
    adapter.removeAllListeners();
    // Prevent unhandled error events from crashing the test
    adapter.on('error', () => {});
  });

  it('healthCheck returns ok with mock CLI', async () => {
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.version).toBeDefined();
  });

  it('healthCheck fails for missing binary', async () => {
    adapter.execPath = '/nonexistent/claude';
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(false);
  });

  it('spawn creates instance and emits exit', async () => {
    const { instanceId, pid } = await adapter.spawn({
      args: ['--stream', '--session', 'test-sess'],
    });
    expect(instanceId).toBeDefined();
    expect(pid).toBeDefined();
    expect(adapter.status).toBe('running');

    await new Promise((r) => adapter.on('exit', r));
    expect(adapter.status).toBe('idle');
    expect(adapter.instances.has(instanceId)).toBe(false);
  });

  it('execute returns session info', async () => {
    const result = await adapter.execute({ description: 'test task' });
    expect(result.exitCode).toBe(0);
    expect(result.sessionId).toBeDefined();
    expect(result.model).toBeDefined();
    expect(result.output).toBeDefined();
  });

  it('kill terminates instance', async () => {
    const { instanceId } = await adapter.spawn({ args: ['--hang'] });
    await new Promise((r) => setTimeout(r, 100));
    await adapter.kill(instanceId);
    await new Promise((r) => setTimeout(r, 200));
    expect(adapter.instances.has(instanceId)).toBe(false);
  });

  it('kill throws for unknown instance', async () => {
    await expect(adapter.kill('nonexistent')).rejects.toThrow('Instance not found');
  });

  it('sendInput throws for unknown instance', async () => {
    await expect(adapter.sendInput('nope', 'data')).rejects.toThrow('Instance not found');
  });

  it('readStream throws for unknown instance', () => {
    expect(() => adapter.readStream('nope')).toThrow('Instance not found');
  });

  it('resumeSession returns dead for unknown instance', async () => {
    const result = await adapter.resumeSession('ghost');
    expect(result.alive).toBe(false);
  });

  it('getOutputParser returns ClaudeCodeStreamParser', () => {
    const parser = adapter.getOutputParser();
    expect(parser.constructor.name).toBe('ClaudeCodeStreamParser');
  });

  it('_buildArgs includes all configured options', () => {
    adapter.model = 'claude-sonnet-4-6';
    adapter.maxTurns = 5;
    adapter.mcpConfig = '/path/config.json';
    adapter.permissionMode = 'bypass-permissions';
    const args = adapter._buildArgs({ task: { description: 'test' } });
    expect(args).toContain('--model');
    expect(args).toContain('claude-sonnet-4-6');
    expect(args).toContain('--max-turns');
    expect(args).toContain('5');
    expect(args).toContain('--mcp-config');
    expect(args).toContain('--permission-mode');
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
    expect(args).toContain('-p');
    expect(args).toContain('test');
  });

  it('_buildArgs does not add permission-mode for default', () => {
    adapter.permissionMode = 'default';
    const args = adapter._buildArgs({});
    expect(args).not.toContain('--permission-mode');
  });
});

// ─── CodexAdapter (CMPAAA-321) ─────────────────────────────────

describe('CodexAdapter (CMPAAA-321)', () => {
  let CodexAdapter;
  let adapter;
  const MOCK_CLI = path.resolve(__dirname, '../fixtures/mock-cli.js');

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/main/adapters/codex.adapter.js');
    CodexAdapter = mod.default;
    adapter = new CodexAdapter({
      execPath: MOCK_CLI,
      apiKey: 'sk-test-key-123',
      model: 'o3',
      sandboxMode: 'full-auto',
    });
  });

  afterEach(() => {
    adapter.removeAllListeners();
  });

  it('_buildEnv injects OPENAI_API_KEY', () => {
    const env = adapter._buildEnv();
    expect(env.OPENAI_API_KEY).toBe('sk-test-key-123');
  });

  it('_buildEnv merges extra env', () => {
    const env = adapter._buildEnv({ EXTRA: 'val' });
    expect(env.EXTRA).toBe('val');
    expect(env.OPENAI_API_KEY).toBe('sk-test-key-123');
  });

  it('_buildBaseArgs includes --full-auto for full-auto mode', () => {
    const args = adapter._buildBaseArgs();
    expect(args).toContain('--full-auto');
    expect(args).toContain('--model');
    expect(args).toContain('o3');
    expect(args).toContain('--quiet');
  });

  it('_buildBaseArgs includes --auto-edit for auto-edit mode', () => {
    adapter.sandboxMode = 'auto-edit';
    const args = adapter._buildBaseArgs();
    expect(args).toContain('--auto-edit');
    expect(args).not.toContain('--full-auto');
  });

  it('_buildBaseArgs has neither flag for suggest mode', () => {
    adapter.sandboxMode = 'suggest';
    const args = adapter._buildBaseArgs();
    expect(args).not.toContain('--full-auto');
    expect(args).not.toContain('--auto-edit');
  });

  it('_buildBaseArgs includes approval-policy', () => {
    adapter.approvalPolicy = 'auto-approve';
    const args = adapter._buildBaseArgs();
    expect(args).toContain('--approval-policy');
    expect(args).toContain('auto-approve');
  });

  it('healthCheck returns ok with checks', async () => {
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.checks.cli).toBe(true);
    expect(result.checks.apiKey).toBe(true);
  });

  it('healthCheck reports missing apiKey', async () => {
    adapter.apiKey = null;
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.checks.apiKey).toBe(false);
  });

  it('healthCheck fails for missing binary', async () => {
    adapter.execPath = '/nonexistent/codex';
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(false);
  });

  it('kill throws for unknown instance', async () => {
    await expect(adapter.kill('nope')).rejects.toThrow('Instance not found');
  });

  it('sendInput throws for unknown instance', async () => {
    await expect(adapter.sendInput('nope', 'data')).rejects.toThrow('Instance not found');
  });

  it('resumeSession returns dead for unknown', async () => {
    const result = await adapter.resumeSession('ghost');
    expect(result.alive).toBe(false);
  });

  it('getOutputParser returns LineDelimitedJsonParser', () => {
    const parser = adapter.getOutputParser();
    expect(parser.constructor.name).toBe('LineDelimitedJsonParser');
  });
});
