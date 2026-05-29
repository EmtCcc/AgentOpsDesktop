import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { default: GenericCliAdapter } = await import('../src/main/adapters/generic-cli.adapter.js');

const MOCK_CLI = join(__dirname, 'fixtures', 'mock-cli.js');
const NODE = process.execPath;

/**
 * Standard test harness for CLI adapters.
 *
 * Template usage — to test a new adapter:
 *   1. Replace `createAdapter()` to return your adapter instance.
 *   2. Set `execPath` to your adapter's CLI binary (or mock).
 *   3. Adjust config for adapter-specific options.
 *
 * The harness covers all four AgentAdapter interface methods:
 *   spawn / kill / healthCheck / execute
 */
function createAdapter(overrides = {}) {
  return new GenericCliAdapter({
    execPath: NODE,
    args: [MOCK_CLI],
    timeoutMs: 5000,
    ...overrides,
  });
}

describe('CLI Adapter Test Harness', () => {
  let adapter;

  beforeEach(() => {
    adapter = createAdapter();
  });

  afterEach(async () => {
    for (const [id] of adapter.instances) {
      try { await adapter.kill(id); } catch { /* already dead */ }
    }
  });

  // ─── spawn ───────────────────────────────────────────────────────────
  describe('spawn', () => {
    it('starts a process and returns instanceId + pid', async () => {
      const result = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(result).toHaveProperty('instanceId');
      expect(result).toHaveProperty('pid');
      expect(result.pid).toBeGreaterThan(0);
      expect(adapter.instances.has(result.instanceId)).toBe(true);
      expect(adapter.status).toBe('running');
    });

    it('accepts custom instanceId', async () => {
      const result = await adapter.spawn({
        instanceId: 'custom-id',
        args: [MOCK_CLI, '--hang'],
      });
      expect(result.instanceId).toBe('custom-id');
      expect(adapter.instances.has('custom-id')).toBe(true);
    });

    it('emits exit event when process ends', async () => {
      const exitPromise = new Promise((resolve) => {
        adapter.on('exit', resolve);
      });
      adapter.spawn({ args: [MOCK_CLI, '--health'] });
      const event = await exitPromise;
      expect(event).toHaveProperty('instanceId');
      expect(event).toHaveProperty('code', 0);
    });

    it('cleans up instances map on exit', async () => {
      const result = await adapter.spawn({ args: [MOCK_CLI, '--health'] });
      await new Promise((r) => setTimeout(r, 200));
      expect(adapter.instances.has(result.instanceId)).toBe(false);
      expect(adapter.status).toBe('idle');
    });

    it('throws if execPath is not set', async () => {
      const bad = new GenericCliAdapter({});
      await expect(bad.spawn()).rejects.toThrow('execPath is required');
    });
  });

  // ─── kill ────────────────────────────────────────────────────────────
  describe('kill', () => {
    it('terminates a running process', async () => {
      const exitPromise = new Promise((resolve) => {
        adapter.on('exit', resolve);
      });
      const result = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.instances.has(result.instanceId)).toBe(true);

      await adapter.kill(result.instanceId);
      await exitPromise;
      expect(adapter.instances.has(result.instanceId)).toBe(false);
    });

    it('throws for unknown instanceId', async () => {
      await expect(adapter.kill('nonexistent')).rejects.toThrow('Instance not found: nonexistent');
    });

    it('handles double-kill gracefully (instance already removed)', async () => {
      const exitPromise = new Promise((resolve) => {
        adapter.on('exit', resolve);
      });
      const result = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      await adapter.kill(result.instanceId);
      await exitPromise;
      await expect(adapter.kill(result.instanceId)).rejects.toThrow('Instance not found');
    });
  });

  // ─── healthCheck ─────────────────────────────────────────────────────
  describe('healthCheck', () => {
    it('returns ok for a valid executable', async () => {
      const health = await adapter.healthCheck();
      expect(health).toEqual({ ok: true });
    });

    it('returns error for missing execPath', async () => {
      const bad = new GenericCliAdapter({});
      const health = await bad.healthCheck();
      expect(health.ok).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('returns error for nonexistent executable', async () => {
      const bad = new GenericCliAdapter({ execPath: 'nonexistent_command_xyz_12345' });
      const health = await bad.healthCheck();
      expect(health.ok).toBe(false);
      expect(health.error).toContain('Executable not found');
    });
  });

  // ─── execute ─────────────────────────────────────────────────────────
  describe('execute', () => {
    it('captures stdout and exit code', async () => {
      const result = await adapter.execute({ title: 'test', description: 'hello world' });
      expect(result.output.trim()).toBe('hello world');
      expect(result.exitCode).toBe(0);
    });

    it('returns exit code 1 on failure', async () => {
      const failAdapter = createAdapter({ args: [MOCK_CLI, '--fail'] });
      const result = await failAdapter.execute({ title: 'test' });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('mock failure');
    });

    it('works with no description', async () => {
      const result = await adapter.execute({ title: 'test' });
      expect(result.output.trim()).toBe('mock-cli ready');
      expect(result.exitCode).toBe(0);
    });

    it('passes config through to args', async () => {
      const configAdapter = createAdapter({ args: [MOCK_CLI, '--mode', 'fast'] });
      const result = await configAdapter.execute({ title: 'test', description: 'run' });
      expect(result.output.trim()).toBe('--mode fast run');
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── lifecycle integration ───────────────────────────────────────────
  describe('lifecycle', () => {
    it('spawn → kill → re-spawn cycle', async () => {
      const r1 = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.instances.size).toBe(1);

      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      await adapter.kill(r1.instanceId);
      await exitPromise;
      expect(adapter.instances.size).toBe(0);
      expect(adapter.status).toBe('idle');

      const r2 = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.instances.size).toBe(1);
      expect(r2.instanceId).not.toBe(r1.instanceId);
    });

    it('multiple concurrent instances', async () => {
      const r1 = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      const r2 = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.instances.size).toBe(2);
      expect(r1.instanceId).not.toBe(r2.instanceId);

      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      await adapter.kill(r1.instanceId);
      await exitPromise;
      expect(adapter.instances.size).toBe(1);
      expect(adapter.instances.has(r2.instanceId)).toBe(true);
    });

    it('status transitions: idle → running → idle', async () => {
      expect(adapter.status).toBe('idle');
      await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.status).toBe('running');

      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      for (const [id] of adapter.instances) await adapter.kill(id);
      await exitPromise;
      expect(adapter.status).toBe('idle');
    });
  });
});
