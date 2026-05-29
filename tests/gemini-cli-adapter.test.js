import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { default: GeminiCliAdapter } = await import('../src/main/adapters/gemini-cli.adapter.js');
const parsers = await import('../src/main/parsers/index.js');
const LineDelimitedJsonParser = parsers.LineDelimitedJsonParser;

const MOCK_CLI = join(__dirname, 'fixtures', 'mock-cli.js');
const NODE = process.execPath;

function createAdapter(overrides = {}) {
  return new GeminiCliAdapter({
    execPath: NODE,
    args: [MOCK_CLI],
    timeoutMs: 5000,
    ...overrides,
  });
}

describe('GeminiCliAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = createAdapter();
  });

  afterEach(async () => {
    for (const [id] of adapter.instances) {
      try { await adapter.kill(id); } catch { /* already dead */ }
    }
  });

  // ─── constructor ──────────────────────────────────────────────────────
  describe('constructor', () => {
    it('uses default config values', () => {
      const a = new GeminiCliAdapter();
      expect(a.execPath).toBe('gemini');
      expect(a.model).toBeNull();
      expect(a.timeoutMs).toBe(600_000);
      expect(a.name).toBe('gemini-cli');
    });

    it('accepts custom config', () => {
      const a = new GeminiCliAdapter({
        execPath: '/usr/local/bin/gemini',
        model: 'gemini-2.5-pro',
        name: 'my-gemini',
        timeoutMs: 300_000,
      });
      expect(a.execPath).toBe('/usr/local/bin/gemini');
      expect(a.model).toBe('gemini-2.5-pro');
      expect(a.name).toBe('my-gemini');
      expect(a.timeoutMs).toBe(300_000);
    });
  });

  // ─── _buildArgs ───────────────────────────────────────────────────────
  describe('_buildArgs', () => {
    it('returns default args when no overrides', () => {
      const a = new GeminiCliAdapter({ args: ['--verbose'] });
      expect(a._buildArgs()).toEqual(['--verbose']);
    });

    it('appends --model when model is set', () => {
      const a = new GeminiCliAdapter({ model: 'gemini-2.5-flash' });
      expect(a._buildArgs()).toEqual(['--model', 'gemini-2.5-flash']);
    });

    it('allows per-call model override', () => {
      const a = new GeminiCliAdapter({ model: 'gemini-2.5-flash' });
      const args = a._buildArgs({ model: 'gemini-2.5-pro' });
      expect(args).toEqual(['--model', 'gemini-2.5-pro']);
    });

    it('appends extra args from overrides', () => {
      const a = new GeminiCliAdapter({ model: 'gemini-2.5-pro' });
      const args = a._buildArgs({ args: ['--context', 'large'] });
      expect(args).toEqual(['--model', 'gemini-2.5-pro', '--context', 'large']);
    });
  });

  // ─── spawn ────────────────────────────────────────────────────────────
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
        instanceId: 'custom-gemini',
        args: [MOCK_CLI, '--hang'],
      });
      expect(result.instanceId).toBe('custom-gemini');
    });

    it('emits exit event when process ends', async () => {
      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
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
  });

  // ─── kill ─────────────────────────────────────────────────────────────
  describe('kill', () => {
    it('terminates a running process', async () => {
      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      const result = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      await adapter.kill(result.instanceId);
      await exitPromise;
      expect(adapter.instances.has(result.instanceId)).toBe(false);
    });

    it('throws for unknown instanceId', async () => {
      await expect(adapter.kill('nonexistent')).rejects.toThrow('Instance not found: nonexistent');
    });
  });

  // ─── healthCheck ──────────────────────────────────────────────────────
  describe('healthCheck', () => {
    it('returns ok for a valid executable', async () => {
      const health = await adapter.healthCheck();
      expect(health).toEqual({ ok: true });
    });

    it('returns error for nonexistent executable', async () => {
      const bad = new GeminiCliAdapter({ execPath: 'nonexistent_gemini_xyz' });
      const health = await bad.healthCheck();
      expect(health.ok).toBe(false);
      expect(health.error).toContain('Gemini CLI not found');
    });
  });

  // ─── execute ──────────────────────────────────────────────────────────
  describe('execute', () => {
    it('captures stdout and exit code', async () => {
      const result = await adapter.execute({ title: 'test', description: 'hello gemini' });
      expect(result.output.trim()).toBe('hello gemini');
      expect(result.exitCode).toBe(0);
    });

    it('returns exit code 1 on failure', async () => {
      const failAdapter = createAdapter({ args: [MOCK_CLI, '--fail'] });
      const result = await failAdapter.execute({ title: 'test' });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('mock failure');
    });
  });

  // ─── sendInput / readStream / resumeSession ───────────────────────────
  describe('streaming', () => {
    it('sendInput writes to stdin without error', async () => {
      const result = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      await expect(adapter.sendInput(result.instanceId, 'test input\n')).resolves.toBeUndefined();
    });

    it('readStream returns a readable stream', async () => {
      const result = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      const stream = adapter.readStream(result.instanceId);
      expect(stream).toBeDefined();
      expect(typeof stream.on).toBe('function');
    });

    it('resumeSession reports alive for running process', async () => {
      const result = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      const session = await adapter.resumeSession(result.instanceId);
      expect(session.alive).toBe(true);
      expect(session.pid).toBeGreaterThan(0);
    });

    it('resumeSession reports dead after kill', async () => {
      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      const result = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      await adapter.kill(result.instanceId);
      await exitPromise;
      const session = await adapter.resumeSession(result.instanceId);
      expect(session.alive).toBe(false);
    });
  });

  // ─── getOutputParser ──────────────────────────────────────────────────
  describe('getOutputParser', () => {
    it('returns LineDelimitedJsonParser', () => {
      const parser = adapter.getOutputParser();
      expect(parser).toBeInstanceOf(LineDelimitedJsonParser);
    });

    it('parser handles Gemini-style JSON output', () => {
      const parser = adapter.getOutputParser();
      const chunk = '{"type":"content","text":"Hello"}\n{"type":"content","text":"World"}\n';
      const messages = parser.parse(chunk);
      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('content');
      expect(messages[0].text).toBe('Hello');
      expect(messages[1].text).toBe('World');
    });

    it('parser falls back to text for non-JSON lines', () => {
      const parser = adapter.getOutputParser();
      const messages = parser.parse('plain text output\n');
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('text');
      expect(messages[0].text).toBe('plain text output');
    });
  });

  // ─── lifecycle ────────────────────────────────────────────────────────
  describe('lifecycle', () => {
    it('spawn → kill → re-spawn cycle', async () => {
      const r1 = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.instances.size).toBe(1);

      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      await adapter.kill(r1.instanceId);
      await exitPromise;
      expect(adapter.instances.size).toBe(0);

      const r2 = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.instances.size).toBe(1);
      expect(r2.instanceId).not.toBe(r1.instanceId);
    });

    it('multiple concurrent instances', async () => {
      const r1 = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      const r2 = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.instances.size).toBe(2);
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
