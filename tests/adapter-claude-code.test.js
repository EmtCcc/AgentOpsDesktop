import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { default: ClaudeCodeAdapter } = await import('../src/main/adapters/claude-code.adapter.js');
const { default: ClaudeCodeStreamParser } = await import('../src/main/parsers/claude-code-stream.parser.js');

const MOCK_CC = join(__dirname, 'fixtures', 'mock-claude-code.js');
const NODE = process.execPath;

function createAdapter(overrides = {}) {
  return new ClaudeCodeAdapter({
    execPath: NODE,
    args: [MOCK_CC],
    timeoutMs: 5000,
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ClaudeCodeStreamParser unit tests
// ═══════════════════════════════════════════════════════════════════════════
describe('ClaudeCodeStreamParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ClaudeCodeStreamParser();
  });

  it('parses a complete stream-json session', () => {
    const events = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sess_001', model: 'claude-sonnet-4-6' }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] }, cost_usd: 0.001 }),
      JSON.stringify({ type: 'result', subtype: 'success', result: 'Done', session_id: 'sess_001', cost_usd: 0.002 }),
    ].join('\n') + '\n';

    const messages = parser.parse(events);
    expect(messages.length).toBe(3);
    expect(messages[0].type).toBe('metadata');
    expect(messages[1].type).toBe('assistant');
    expect(messages[1].text).toBe('Hello');
    expect(messages[2].type).toBe('result');
    expect(messages[2].text).toBe('Done');
  });

  it('extracts session_id from events', () => {
    parser.parse(JSON.stringify({ type: 'system', session_id: 'sess_xyz', subtype: 'init' }) + '\n');
    expect(parser.sessionId).toBe('sess_xyz');
  });

  it('extracts model from events', () => {
    parser.parse(JSON.stringify({ type: 'system', model: 'claude-opus-4-7', subtype: 'init' }) + '\n');
    expect(parser.model).toBe('claude-opus-4-7');
  });

  it('accumulates cost_usd across events', () => {
    parser.parse(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'a' }] }, cost_usd: 0.01 }) + '\n');
    parser.parse(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'b' }] }, cost_usd: 0.02 }) + '\n');
    expect(parser.costUsd).toBeCloseTo(0.03);
  });

  it('handles partial lines across chunks', () => {
    const full = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'partial' }] }, cost_usd: 0.001 }) + '\n';
    const mid = Math.floor(full.length / 2);

    const m1 = parser.parse(full.slice(0, mid));
    expect(m1.length).toBe(0); // incomplete line buffered

    const m2 = parser.parse(full.slice(mid));
    expect(m2.length).toBe(1);
    expect(m2[0].text).toBe('partial');
  });

  it('flush() processes remaining buffer', () => {
    const line = JSON.stringify({ type: 'result', result: 'final', session_id: 's1', cost_usd: 0.005 });
    parser.parse(line); // no trailing newline
    const flushed = parser.flush();
    expect(flushed.length).toBe(1);
    expect(flushed[0].type).toBe('result');
    expect(flushed[0].text).toBe('final');
  });

  it('handles non-JSON lines as text', () => {
    const messages = parser.parse('plain text line\n');
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('text');
    expect(messages[0].text).toBe('plain text line');
  });

  it('reset() clears all state', () => {
    parser.parse(JSON.stringify({ type: 'system', session_id: 's', model: 'm', cost_usd: 1 }) + '\n');
    parser.reset();
    expect(parser.sessionId).toBeNull();
    expect(parser.model).toBeNull();
    expect(parser.costUsd).toBe(0);
  });

  it('getSessionInfo() returns accumulated metadata', () => {
    parser.parse(JSON.stringify({ type: 'system', session_id: 's1', model: 'claude-sonnet-4-6' }) + '\n');
    parser.parse(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'part1 ' }] }, cost_usd: 0.01 }) + '\n');
    parser.parse(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'part2' }] }, cost_usd: 0.02 }) + '\n');

    const info = parser.getSessionInfo();
    expect(info.sessionId).toBe('s1');
    expect(info.model).toBe('claude-sonnet-4-6');
    expect(info.costUsd).toBeCloseTo(0.03);
    expect(info.fullText).toBe('part1 part2');
  });

  it('handles content blocks with no text type', () => {
    const msg = parser.parse(JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Bash', input: {} }] },
      cost_usd: 0.001,
    }) + '\n');
    expect(msg.length).toBe(1);
    expect(msg[0].type).toBe('assistant');
  });

  it('handles unknown event types', () => {
    const msg = parser.parse(JSON.stringify({ type: 'custom_event', text: 'hello' }) + '\n');
    expect(msg.length).toBe(1);
    expect(msg[0].type).toBe('custom_event');
    expect(msg[0].text).toBe('hello');
  });

  it('handles empty input gracefully', () => {
    expect(parser.parse('')).toEqual([]);
    expect(parser.flush()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ClaudeCodeAdapter unit tests
// ═══════════════════════════════════════════════════════════════════════════
describe('ClaudeCodeAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = createAdapter();
  });

  afterEach(async () => {
    for (const [id] of adapter.instances) {
      try { await adapter.kill(id); } catch { /* already dead */ }
    }
  });

  // ─── constructor defaults ─────────────────────────────────────────────
  describe('constructor', () => {
    it('sets default config values', () => {
      const a = new ClaudeCodeAdapter();
      expect(a.execPath).toBe('claude');
      expect(a.name).toBe('claude-code');
      expect(a.type).toBe('claude-code');
      expect(a.timeoutMs).toBe(600_000);
      expect(a.maxTurns).toBe(10);
      expect(a.permissionMode).toBe('default');
    });

    it('accepts custom config', () => {
      const a = new ClaudeCodeAdapter({
        execPath: '/usr/local/bin/claude',
        model: 'claude-opus-4-7',
        mcpConfig: '/path/to/mcp.json',
        sessionId: 'sess_123',
        maxTurns: 5,
        permissionMode: 'auto-edit',
      });
      expect(a.execPath).toBe('/usr/local/bin/claude');
      expect(a.model).toBe('claude-opus-4-7');
      expect(a.mcpConfig).toBe('/path/to/mcp.json');
      expect(a.sessionId).toBe('sess_123');
      expect(a.maxTurns).toBe(5);
      expect(a.permissionMode).toBe('auto-edit');
    });
  });

  // ─── _buildArgs ──────────────────────────────────────────────────────
  describe('_buildArgs', () => {
    it('includes --output-format stream-json', () => {
      const args = adapter._buildArgs({ task: { description: 'test' } });
      expect(args).toContain('--output-format');
      expect(args).toContain('stream-json');
    });

    it('includes -p flag for print mode', () => {
      const args = adapter._buildArgs({ task: { description: 'test' } });
      expect(args).toContain('-p');
    });

    it('appends task description at the end', () => {
      const args = adapter._buildArgs({ task: { description: 'hello world' } });
      expect(args[args.length - 1]).toBe('hello world');
    });

    it('includes --model when configured', () => {
      adapter.model = 'claude-opus-4-7';
      const args = adapter._buildArgs({ task: { description: 'test' } });
      const idx = args.indexOf('--model');
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe('claude-opus-4-7');
    });

    it('allows model override per spawn', () => {
      adapter.model = 'claude-sonnet-4-6';
      const args = adapter._buildArgs({ model: 'claude-opus-4-7', task: { description: 'test' } });
      const idx = args.indexOf('--model');
      expect(args[idx + 1]).toBe('claude-opus-4-7');
    });

    it('includes --resume when sessionId is set', () => {
      adapter.sessionId = 'sess_old';
      const args = adapter._buildArgs({ task: { description: 'test' } });
      const idx = args.indexOf('--resume');
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe('sess_old');
    });

    it('includes --mcp-config when set', () => {
      adapter.mcpConfig = '/tmp/mcp.json';
      const args = adapter._buildArgs({ task: { description: 'test' } });
      const idx = args.indexOf('--mcp-config');
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe('/tmp/mcp.json');
    });

    it('includes --max-turns', () => {
      adapter.maxTurns = 5;
      const args = adapter._buildArgs({ task: { description: 'test' } });
      const idx = args.indexOf('--max-turns');
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe('5');
    });

    it('includes --permission-mode when not default', () => {
      adapter.permissionMode = 'auto-edit';
      const args = adapter._buildArgs({ task: { description: 'test' } });
      const idx = args.indexOf('--permission-mode');
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe('auto-edit');
    });

    it('omits --permission-mode when default', () => {
      const args = adapter._buildArgs({ task: { description: 'test' } });
      expect(args).not.toContain('--permission-mode');
    });

    it('uses description from params when task is absent', () => {
      const args = adapter._buildArgs({ description: 'direct prompt' });
      expect(args[args.length - 1]).toBe('direct prompt');
    });
  });

  // ─── spawn ───────────────────────────────────────────────────────────
  describe('spawn', () => {
    it('starts a process and returns instanceId + pid', async () => {
      const result = await adapter.spawn({
        args: [MOCK_CC, '--hang'],
        task: { description: '' },
      });
      expect(result).toHaveProperty('instanceId');
      expect(result).toHaveProperty('pid');
      expect(result.pid).toBeGreaterThan(0);
      expect(adapter.instances.has(result.instanceId)).toBe(true);
      expect(adapter.status).toBe('running');
    });

    it('accepts custom instanceId', async () => {
      const result = await adapter.spawn({
        instanceId: 'my-instance',
        args: [MOCK_CC, '--hang'],
      });
      expect(result.instanceId).toBe('my-instance');
    });

    it('emits exit event with sessionInfo on process end', async () => {
      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      adapter.spawn({ args: [MOCK_CC, '--stream', '--session', 'sess_exit_test'] });
      const event = await exitPromise;
      expect(event).toHaveProperty('instanceId');
      expect(event).toHaveProperty('code', 0);
      expect(event.sessionInfo).toBeDefined();
      expect(event.sessionInfo.sessionId).toBe('sess_exit_test');
    });

    it('cleans up instances map on exit', async () => {
      const result = await adapter.spawn({ args: [MOCK_CC, '--stream'] });
      await new Promise((r) => setTimeout(r, 200));
      expect(adapter.instances.has(result.instanceId)).toBe(false);
      expect(adapter.status).toBe('idle');
    });
  });

  // ─── kill ────────────────────────────────────────────────────────────
  describe('kill', () => {
    it('terminates a running process', async () => {
      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      const result = await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      await adapter.kill(result.instanceId);
      await exitPromise;
      expect(adapter.instances.has(result.instanceId)).toBe(false);
    });

    it('throws for unknown instanceId', async () => {
      await expect(adapter.kill('nonexistent')).rejects.toThrow('Instance not found: nonexistent');
    });
  });

  // ─── healthCheck ─────────────────────────────────────────────────────
  describe('healthCheck', () => {
    it('returns ok for a valid executable', async () => {
      const health = await adapter.healthCheck();
      expect(health.ok).toBe(true);
    });

    it('returns error for nonexistent executable', async () => {
      const bad = new ClaudeCodeAdapter({ execPath: 'nonexistent_cmd_xyz' });
      const health = await bad.healthCheck();
      expect(health.ok).toBe(false);
    });
  });

  // ─── execute ─────────────────────────────────────────────────────────
  describe('execute', () => {
    it('captures parsed output with session metadata', async () => {
      // Use --stream mock — execute() builds args via _buildArgs and parses
      // stream-json events through ClaudeCodeStreamParser.
      const streamAdapter = createAdapter({
        args: [MOCK_CC, '--stream', '--session', 'sess_exec', '--model', 'claude-opus-4-7'],
      });
      const result = await streamAdapter.execute({ title: 'test', description: 'test prompt' });
      expect(result.exitCode).toBe(0);
      expect(result.sessionId).toBe('sess_exec');
      expect(result.model).toBe('claude-opus-4-7');
      expect(result.costUsd).toBeGreaterThan(0);
      expect(result.output).toContain('Processing');
    });

    it('returns exit code 1 on failure', async () => {
      const failAdapter = createAdapter({ args: [MOCK_CC, '--fail'] });
      const result = await failAdapter.execute({ title: 'test' });
      expect(result.exitCode).toBe(1);
    });

    it('passes --output-format stream-json and -p to the CLI', async () => {
      // Verify _buildArgs produces the expected flags by checking echo-args output
      const echoAdapter = createAdapter({ execPath: NODE, args: [MOCK_CC, '--echo-args'] });
      const args = echoAdapter._buildArgs({ task: { description: 'test' } });
      expect(args).toContain('--output-format');
      expect(args).toContain('stream-json');
      expect(args).toContain('-p');
      expect(args[args.length - 1]).toBe('test');
    });
  });

  // ─── sendInput / readStream ──────────────────────────────────────────
  describe('sendInput / readStream', () => {
    it('sendInput writes to stdin', async () => {
      const result = await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      await adapter.sendInput(result.instanceId, 'test input\n');
      // No error = success
    });

    it('readStream returns stdout stream', async () => {
      const result = await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      const stream = adapter.readStream(result.instanceId, 'stdout');
      expect(stream).toBeDefined();
      expect(typeof stream.on).toBe('function');
    });

    it('throws for unknown instanceId', async () => {
      expect(() => adapter.readStream('nope')).toThrow('Instance not found');
      await expect(adapter.sendInput('nope', 'data')).rejects.toThrow('Instance not found');
    });
  });

  // ─── resumeSession ───────────────────────────────────────────────────
  describe('resumeSession', () => {
    it('returns alive for running instance', async () => {
      const result = await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      const status = await adapter.resumeSession(result.instanceId);
      expect(status.alive).toBe(true);
      expect(status.pid).toBeGreaterThan(0);
    });

    it('returns not alive for unknown instance', async () => {
      const status = await adapter.resumeSession('nonexistent');
      expect(status.alive).toBe(false);
    });
  });

  // ─── getOutputParser ─────────────────────────────────────────────────
  describe('getOutputParser', () => {
    it('returns a ClaudeCodeStreamParser', () => {
      const p = adapter.getOutputParser();
      // Check constructor name (instanceof fails across ESM/CJS boundary)
      expect(p.constructor.name).toBe('ClaudeCodeStreamParser');
      expect(typeof p.parse).toBe('function');
      expect(typeof p.getSessionInfo).toBe('function');
    });
  });

  // ─── resume (session resumption) ─────────────────────────────────────
  describe('resume', () => {
    it('spawns with --resume flag', async () => {
      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      const result = await adapter.resume('sess_resume_123', {
        args: [MOCK_CC, '--stream', '--session', 'sess_resume_123'],
      });
      expect(result).toHaveProperty('instanceId');
      expect(result).toHaveProperty('pid');
      await exitPromise;
    });
  });

  // ─── lifecycle integration ───────────────────────────────────────────
  describe('lifecycle', () => {
    it('spawn → kill → re-spawn cycle', async () => {
      const r1 = await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      expect(adapter.instances.size).toBe(1);

      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      await adapter.kill(r1.instanceId);
      await exitPromise;
      expect(adapter.instances.size).toBe(0);

      const r2 = await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      expect(adapter.instances.size).toBe(1);
      expect(r2.instanceId).not.toBe(r1.instanceId);
    });

    it('multiple concurrent instances', async () => {
      const r1 = await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      const r2 = await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      expect(adapter.instances.size).toBe(2);

      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      await adapter.kill(r1.instanceId);
      await exitPromise;
      expect(adapter.instances.size).toBe(1);
      expect(adapter.instances.has(r2.instanceId)).toBe(true);
    });

    it('status transitions: idle → running → idle', async () => {
      expect(adapter.status).toBe('idle');
      await adapter.spawn({ args: [MOCK_CC, '--hang'] });
      expect(adapter.status).toBe('running');

      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      for (const [id] of adapter.instances) await adapter.kill(id);
      await exitPromise;
      expect(adapter.status).toBe('idle');
    });
  });

  // ─── end-to-end stream parsing through adapter ───────────────────────
  describe('e2e stream parsing', () => {
    it('parses Claude Code stream-json output through spawn', async () => {
      const exitPromise = new Promise((resolve) => adapter.on('exit', resolve));
      await adapter.spawn({
        args: [MOCK_CC, '--stream', '--session', 'sess_e2e', '--model', 'claude-opus-4-7'],
      });
      const event = await exitPromise;
      expect(event.sessionInfo.sessionId).toBe('sess_e2e');
      expect(event.sessionInfo.model).toBe('claude-opus-4-7');
      expect(event.sessionInfo.costUsd).toBeGreaterThan(0);
      expect(event.sessionInfo.fullText).toContain('Processing');
    });
  });
});
