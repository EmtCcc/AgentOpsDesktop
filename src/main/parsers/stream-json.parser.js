'use strict';

const { OutputParser, createMessage } = require('./output-parser');

/**
 * Parser for streaming newline-delimited JSON (NDJSON).
 * Handles partial lines across chunks — buffers incomplete lines until
 * a newline arrives.
 *
 * Typical sources: Claude CLI --output-format stream-json, any NDJSON stream.
 */
class StreamJsonParser extends OutputParser {
  constructor() {
    super();
    this._buffer = '';
  }

  parse(chunk) {
    this._buffer += chunk;
    const messages = [];

    let newlineIdx;
    while ((newlineIdx = this._buffer.indexOf('\n')) !== -1) {
      const line = this._buffer.slice(0, newlineIdx).trim();
      this._buffer = this._buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const obj = JSON.parse(line);
        messages.push(createMessage({
          type: obj.type || 'json',
          text: obj.content || obj.text || JSON.stringify(obj),
          data: obj,
        }));
      } catch {
        // Non-JSON line in a JSON stream — emit as text
        messages.push(createMessage({ type: 'text', text: line }));
      }
    }

    return messages;
  }

  flush() {
    const remaining = this._buffer.trim();
    this._buffer = '';
    if (!remaining) return [];

    try {
      const obj = JSON.parse(remaining);
      return [createMessage({
        type: obj.type || 'json',
        text: obj.content || obj.text || JSON.stringify(obj),
        data: obj,
      })];
    } catch {
      return [createMessage({ type: 'text', text: remaining })];
    }
  }

  reset() {
    this._buffer = '';
  }
}

module.exports = StreamJsonParser;
