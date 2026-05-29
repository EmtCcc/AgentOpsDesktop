'use strict';

const { OutputParser, createMessage } = require('./output-parser');

/**
 * Parser for line-delimited JSON where each line is a complete JSON object.
 * Unlike StreamJsonParser, assumes each parse() call contains complete lines
 * (no buffering across chunks).
 *
 * Typical sources: OpenAI Codex CLI, structured log output.
 */
class LineDelimitedJsonParser extends OutputParser {
  parse(chunk) {
    const lines = chunk.split('\n');
    const messages = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const obj = JSON.parse(trimmed);
        messages.push(createMessage({
          type: obj.type || 'json',
          text: obj.content || obj.text || JSON.stringify(obj),
          data: obj,
        }));
      } catch {
        messages.push(createMessage({ type: 'text', text: trimmed }));
      }
    }

    return messages;
  }
}

module.exports = LineDelimitedJsonParser;
