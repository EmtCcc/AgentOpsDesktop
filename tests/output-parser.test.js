import { describe, it, expect, beforeEach } from 'vitest';
import {
  OutputParser,
  createMessage,
  StreamJsonParser,
  LineDelimitedJsonParser,
  PlainTextParser,
  MarkerParser,
} from '../src/main/parsers/index.js';

describe('OutputParser base class', () => {
  it('parse() throws not implemented', () => {
    const parser = new OutputParser();
    expect(() => parser.parse('test')).toThrow('not implemented');
  });

  it('flush() returns empty array', () => {
    const parser = new OutputParser();
    expect(parser.flush()).toEqual([]);
  });

  it('reset() is a no-op', () => {
    const parser = new OutputParser();
    expect(() => parser.reset()).not.toThrow();
  });
});

describe('createMessage', () => {
  it('returns default message with overrides', () => {
    const msg = createMessage({ type: 'json', text: 'hello' });
    expect(msg.type).toBe('json');
    expect(msg.text).toBe('hello');
    expect(msg.data).toBeNull();
    expect(msg.timestamp).toBeTypeOf('number');
  });

  it('allows overriding data', () => {
    const msg = createMessage({ data: { key: 'value' } });
    expect(msg.data).toEqual({ key: 'value' });
  });
});

describe('PlainTextParser', () => {
  let parser;

  beforeEach(() => {
    parser = new PlainTextParser();
  });

  it('emits each chunk as a text message', () => {
    const msgs = parser.parse('hello world');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('hello world');
  });

  it('returns empty array for empty chunk', () => {
    expect(parser.parse('')).toEqual([]);
  });

  it('does not transform content', () => {
    const input = '{"json": true}\nplain text\n';
    const msgs = parser.parse(input);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe(input);
  });
});

describe('LineDelimitedJsonParser', () => {
  let parser;

  beforeEach(() => {
    parser = new LineDelimitedJsonParser();
  });

  it('parses complete JSON lines', () => {
    const chunk = '{"type":"result","text":"done"}\n{"type":"log","text":"hi"}\n';
    const msgs = parser.parse(chunk);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].type).toBe('result');
    expect(msgs[0].data).toEqual({ type: 'result', text: 'done' });
    expect(msgs[1].type).toBe('log');
    expect(msgs[1].data).toEqual({ type: 'log', text: 'hi' });
  });

  it('handles non-JSON lines as text', () => {
    const chunk = 'not json\n{"type":"ok"}\n';
    const msgs = parser.parse(chunk);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('not json');
    expect(msgs[1].type).toBe('ok');
  });

  it('skips empty lines', () => {
    const chunk = '\n{"type":"a"}\n\n{"type":"b"}\n';
    const msgs = parser.parse(chunk);
    expect(msgs).toHaveLength(2);
  });

  it('uses content field for text when available', () => {
    const chunk = '{"type":"message","content":"hello world"}';
    const msgs = parser.parse(chunk);
    expect(msgs[0].text).toBe('hello world');
  });
});

describe('StreamJsonParser', () => {
  let parser;

  beforeEach(() => {
    parser = new StreamJsonParser();
  });

  it('parses complete lines immediately', () => {
    const msgs = parser.parse('{"type":"a"}\n{"type":"b"}\n');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].type).toBe('a');
    expect(msgs[1].type).toBe('b');
  });

  it('buffers partial lines until newline arrives', () => {
    let msgs = parser.parse('{"type":"partial"');
    expect(msgs).toHaveLength(0);

    msgs = parser.parse(',"text":"ok"}\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].data).toEqual({ type: 'partial', text: 'ok' });
  });

  it('handles chunks split mid-JSON', () => {
    parser.parse('{"type":');
    parser.parse('"a","data":');
    const msgs = parser.parse('1}\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].data.type).toBe('a');
  });

  it('flush() emits remaining buffer', () => {
    parser.parse('{"type":"leftover"}');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('leftover');
  });

  it('flush() handles non-JSON remainder', () => {
    parser.parse('some text');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('some text');
  });

  it('reset() clears buffer', () => {
    parser.parse('{"type":"a"');
    parser.reset();
    const msgs = parser.flush();
    expect(msgs).toHaveLength(0);
  });

  it('handles mixed JSON and text lines', () => {
    const chunk = 'log line\n{"type":"result","text":"done"}\n';
    const msgs = parser.parse(chunk);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('log line');
    expect(msgs[1].type).toBe('result');
  });
});

describe('MarkerParser', () => {
  let parser;

  beforeEach(() => {
    parser = new MarkerParser();
  });

  it('emits pre-marker text lines', () => {
    const msgs = parser.parse('line1\nline2\n__AGENT_OUTPUT__\n');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].text).toBe('line1');
    expect(msgs[1].text).toBe('line2');
  });

  it('parses JSON after marker on flush', () => {
    parser.parse('log\n__AGENT_OUTPUT__\n{"result":"ok"}');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('result');
    expect(msgs[0].data).toEqual({ result: 'ok' });
  });

  it('handles marker arriving across chunks', () => {
    let msgs = parser.parse('text\n__AGENT_');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('text');

    msgs = parser.parse('OUTPUT__\n{"done":true}');
    expect(msgs).toHaveLength(0); // no new pre-marker lines

    const flushed = parser.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0].type).toBe('result');
    expect(flushed[0].data).toEqual({ done: true });
  });

  it('returns non-JSON post-marker content as text', () => {
    parser.parse('__AGENT_OUTPUT__\nnot json at all');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].text).toBe('not json at all');
  });

  it('uses custom marker', () => {
    const custom = new MarkerParser({ marker: '<<OUTPUT>>' });
    custom.parse('before\n<<OUTPUT>>\n{"x":1}');
    const msgs = custom.flush();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].data).toEqual({ x: 1 });
  });

  it('reset() clears state', () => {
    parser.parse('text\n__AGENT_OUTPUT__\n{"a":1}');
    parser.reset();
    // After reset, marker not found yet
    const msgs = parser.parse('new text\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('new text');
  });

  it('handles no marker in output', () => {
    parser.parse('just plain\ntext output\n');
    parser.parse('more lines\n');
    const msgs = parser.flush();
    expect(msgs).toHaveLength(0); // all lines emitted during parse
  });
});

describe('Parser integration with adapter', () => {
  it('PlainTextParser works as adapter default', () => {
    const parser = new PlainTextParser();
    const msgs = parser.parse('raw output from CLI');
    expect(msgs[0].text).toBe('raw output from CLI');
    expect(parser.flush()).toEqual([]);
  });

  it('StreamJsonParser handles Claude-style NDJSON', () => {
    const parser = new StreamJsonParser();
    const lines = [
      '{"type":"assistant","message":{"role":"assistant","content":"hello"}}',
      '{"type":"result","subtype":"success","usage":{"input_tokens":100,"output_tokens":50}}',
    ];
    const allMsgs = [];
    for (const line of lines) {
      allMsgs.push(...parser.parse(line + '\n'));
    }
    expect(allMsgs).toHaveLength(2);
    expect(allMsgs[0].type).toBe('assistant');
    expect(allMsgs[1].type).toBe('result');
    expect(allMsgs[1].data.usage.input_tokens).toBe(100);
  });
});
