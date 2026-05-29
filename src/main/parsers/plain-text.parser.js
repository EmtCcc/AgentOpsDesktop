'use strict';

const { OutputParser, createMessage } = require('./output-parser');

/**
 * Plain text parser — the simplest parser.
 * Emits each chunk as-is with no transformation.
 *
 * Default parser for generic CLI adapters that produce unstructured output.
 */
class PlainTextParser extends OutputParser {
  parse(chunk) {
    if (!chunk) return [];
    return [createMessage({ type: 'text', text: chunk })];
  }
}

module.exports = PlainTextParser;
