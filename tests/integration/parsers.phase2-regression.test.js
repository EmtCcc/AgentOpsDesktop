/**
 * Phase 2 Round 1 回归测试 — CMPAAA-320 OutputParser
 *
 * 覆盖：
 *   - OutputParser 基类 (createMessage)
 *   - StreamJsonParser (NDJSON 带缓冲)
 *   - ClaudeCodeStreamParser (stream-json 事件映射、session 元数据)
 *   - LineDelimitedJsonParser (完整行 JSON)
 *   - PlainTextParser
 *   - MarkerParser (标记分割)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OutputParser, createMessage } from '../../src/main/parsers/output-parser.js';
import StreamJsonParser from '../../src/main/parsers/stream-json.parser.js';
import ClaudeCodeStreamParser from '../../src/main/parsers/claude-code-stream.parser.js';
import LineDelimitedJsonParser from '../../src/main/parsers/line-delimited-json.parser.js';
import PlainTextParser from '../../src/main/parsers/plain-text.parser.js';
import MarkerParser from '../../src/main/parsers/marker.parser.js';

// ─── OutputParser 基类 ─────────────────────────────────────────

describe('OutputParser base', () => {
  it('createMessage fills defaults', () => {
    const msg = createMessage({});
    expect(msg.type).toBe('text');
    expect(msg.text).toBe('');
    expect(msg.data).toBeNull();
    expect(typeof msg.timestamp).toBe('number');
  });

  it('createMessage overrides defaults', () => {
    const msg = createMessage({ type: 'result', text: 'hello', data: { a: 1 } });
    expect(msg.type).toBe('result');
    expect(msg.text).toBe('hello');
    expect(msg.data).toEqual({ a: 1 });
  });

  it('base parse() throws not implemented', () => {
    const parser = new OutputParser();
    expect(() => parser.parse('test')).toThrow('not implemented');
  });

  it('base flush() returns empty array', () => {
    const parser = new OutputParser();
    expect(parser.flush()).toEqual([]);
  });

  it('base reset() is a no-op', () => {
    const parser = new OutputParser();
    expect(() => parser.reset()).not.toThrow();
  });
});

// ─── StreamJsonParser ───────────────────────────────────────────

describe('StreamJsonParser', () => {
  let parser;

  beforeEach(() => {
    parser = new StreamJsonParser();
  });

  it('parses complete JSON lines', () => {
    const chunk = '{"type":"text","content":"hello"}\n{"type":"result","content":"done"}\n';
    const msgs = parser.parse(chunk);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('hello');
    expect(msgs[1].type).toBe('result');
    expect(msgs[1].text).toBe('done');
  });

  it('buffers partial lines across chunks', () => {
    const msgs1 = parser.parse('{"type":"text","content":"hel');
    expect(msgs1).toHaveLength(0);

    const msgs2 = parser.parse('lo"}\n');
    expect(msgs2).toHaveLength(1);
    expect(msgs2[0].text).toBe('hello');
  });

  it('emits non-JSON lines as text', () => {
    const msgs = parser.parse('plain text line\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('plain text line');
  });

  it('flush() returns remaining buffer as text when not valid JSON', () => {
    parser.parse('not json data');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('not json data');
  });

  it('flush() returns empty when buffer is empty', () => {
    parser.parse('line\n');
    expect(parser.flush()).toEqual([]);
  });

  it('reset() clears buffer', () => {
    parser.parse('{"type":"text","content":"hello');
    parser.reset();
    expect(parser.flush()).toEqual([]);
  });

  it('skips empty lines', () => {
    const msgs = parser.parse('\n\n{"type":"text","content":"ok"}\n\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('ok');
  });

  it('uses obj.text as fallback for content', () => {
    const msgs = parser.parse('{"type":"info","text":"fallback"}\n');
    expect(msgs[0].text).toBe('fallback');
  });
});

// ─── ClaudeCodeStreamParser ─────────────────────────────────────

describe('ClaudeCodeStreamParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ClaudeCodeStreamParser();
  });

  it('maps system event to metadata', () => {
    const chunk = JSON.stringify({
      type: 'system', subtype: 'init', session_id: 'sess-1', model: 'claude-sonnet-4-6',
    }) + '\n';
    const msgs = parser.parse(chunk);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('metadata');
    expect(msgs[0].text).toBe('init');
    expect(parser.sessionId).toBe('sess-1');
    expect(parser.model).toBe('claude-sonnet-4-6');
  });

  it('maps assistant event and extracts text from content blocks', () => {
    const chunk = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
      },
    }) + '\n';
    const msgs = parser.parse(chunk);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('assistant');
    expect(msgs[0].text).toBe('Hello world');
  });

  it('maps result event with session metadata', () => {
    parser.parse(JSON.stringify({ type: 'system', session_id: 's1', model: 'm1', cost_usd: 0.05 }) + '\n');
    parser.parse(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'answer' }] } }) + '\n');

    const msgs = parser.parse(JSON.stringify({
      type: 'result', subtype: 'success', result: 'done', session_id: 's1',
    }) + '\n');

    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('result');
    expect(msgs[0].text).toBe('done');
    expect(msgs[0].data.sessionId).toBe('s1');
    expect(msgs[0].data.model).toBe('m1');
    expect(msgs[0].data.totalCostUsd).toBe(0.05);
    expect(msgs[0].data.collectedText).toBe('answer');
  });

  it('accumulates costUsd across events', () => {
    parser.parse(JSON.stringify({ type: 'system', cost_usd: 0.01 }) + '\n');
    parser.parse(JSON.stringify({ type: 'assistant', cost_usd: 0.02 }) + '\n');
    expect(parser.costUsd).toBeCloseTo(0.03);
  });

  it('getSessionInfo returns accumulated state', () => {
    parser.parse(JSON.stringify({ type: 'system', session_id: 's2', model: 'm2' }) + '\n');
    parser.parse(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'part1' }] } }) + '\n');
    parser.parse(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'part2' }] } }) + '\n');

    const info = parser.getSessionInfo();
    expect(info.sessionId).toBe('s2');
    expect(info.model).toBe('m2');
    expect(info.fullText).toBe('part1part2');
  });

  it('handles unknown event types', () => {
    const msgs = parser.parse('{"type":"custom_event","text":"info"}\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('custom_event');
    expect(msgs[0].text).toBe('info');
  });

  it('handles assistant event with no text content', () => {
    const msgs = parser.parse(JSON.stringify({
      type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1' }] },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('assistant');
  });

  it('reset() clears all state', () => {
    parser.parse(JSON.stringify({ type: 'system', session_id: 's', model: 'm', cost_usd: 1.0 }) + '\n');
    parser.reset();
    expect(parser.sessionId).toBeNull();
    expect(parser.model).toBeNull();
    expect(parser.costUsd).toBe(0);
    expect(parser.getSessionInfo().fullText).toBe('');
  });

  it('flush() processes remaining buffer', () => {
    parser.parse('{"type":"system","session_id":"flush-test"}');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(1);
    expect(parser.sessionId).toBe('flush-test');
  });
});

// ─── LineDelimitedJsonParser ────────────────────────────────────

describe('LineDelimitedJsonParser', () => {
  let parser;

  beforeEach(() => {
    parser = new LineDelimitedJsonParser();
  });

  it('parses complete JSON lines', () => {
    const chunk = '{"type":"log","content":"entry1"}\n{"type":"log","content":"entry2"}\n';
    const msgs = parser.parse(chunk);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].text).toBe('entry1');
    expect(msgs[1].text).toBe('entry2');
  });

  it('handles non-JSON lines as text', () => {
    const msgs = parser.parse('plain text\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('plain text');
  });

  it('skips empty lines', () => {
    const msgs = parser.parse('\n\n{"type":"ok"}\n\n');
    expect(msgs).toHaveLength(1);
  });

  it('uses text field as fallback', () => {
    const msgs = parser.parse('{"type":"info","text":"fallback"}\n');
    expect(msgs[0].text).toBe('fallback');
  });

  it('does NOT buffer partial lines (unlike StreamJsonParser)', () => {
    const msgs = parser.parse('{"partial": true');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
  });
});

// ─── PlainTextParser ────────────────────────────────────────────

describe('PlainTextParser', () => {
  let parser;

  beforeEach(() => {
    parser = new PlainTextParser();
  });

  it('emits chunk as-is', () => {
    const msgs = parser.parse('hello world');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('hello world');
  });

  it('returns empty for empty chunk', () => {
    expect(parser.parse('')).toEqual([]);
  });
});

// ─── MarkerParser ───────────────────────────────────────────────

describe('MarkerParser', () => {
  let parser;

  beforeEach(() => {
    parser = new MarkerParser();
  });

  it('emits pre-marker lines as text', () => {
    const msgs = parser.parse('line1\nline2\n__AGENT_OUTPUT__\n');
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('line1');
    expect(msgs[1].text).toBe('line2');
  });

  it('flush() returns JSON after marker', () => {
    parser.parse('log\n__AGENT_OUTPUT__\n{"result":"ok"}');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('result');
    expect(msgs[0].data.result).toBe('ok');
  });

  it('flush() returns text if post-marker is not JSON', () => {
    parser.parse('log\n__AGENT_OUTPUT__\nnot json');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('not json');
  });

  it('reset() clears marker state', () => {
    parser.parse('__AGENT_OUTPUT__\n{"a":1}');
    parser.reset();
    const msgs = parser.parse('new line\n__AGENT_OUTPUT__\n{"b":2}');
    expect(msgs.some(m => m.text === 'new line')).toBe(true);
  });

  it('custom marker', () => {
    const custom = new MarkerParser({ marker: '##OUTPUT##' });
    custom.parse('pre\n##OUTPUT##\n{"x":1}');
    const msgs = custom.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].data.x).toBe(1);
  });
});
