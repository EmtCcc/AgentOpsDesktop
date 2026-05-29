'use strict';

/**
 * Base class for output parsers.
 * Parsers transform raw stdout chunks into structured ParsedMessage objects.
 *
 * Lifecycle: parse(chunk) [repeated] -> flush() -> reset() [optional reuse]
 */
class OutputParser {
  /**
   * Process a chunk of stdout data.
   * @param {string} _chunk
   * @returns {ParsedMessage[]}
   */
  parse(_chunk) {
    throw new Error(`${this.constructor.name}.parse() not implemented`);
  }

  /**
   * Flush any buffered data. Called once when the stream ends.
   * @returns {ParsedMessage[]}
   */
  flush() {
    return [];
  }

  /**
   * Reset internal state for reuse.
   */
  reset() {
    // Default no-op; subclasses override if they buffer state
  }
}

/**
 * @typedef {Object} ParsedMessage
 * @property {string} type - Message type: 'text', 'json', 'result', 'error', 'metadata'
 * @property {string} text - Human-readable text content
 * @property {object|null} data - Structured data (JSON object) if available
 * @property {number} timestamp - Unix timestamp (ms) when parsed
 */

/**
 * Create a ParsedMessage with defaults.
 * @param {Partial<ParsedMessage>} fields
 * @returns {ParsedMessage}
 */
function createMessage(fields) {
  return {
    type: 'text',
    text: '',
    data: null,
    timestamp: Date.now(),
    ...fields,
  };
}

module.exports = { OutputParser, createMessage };
