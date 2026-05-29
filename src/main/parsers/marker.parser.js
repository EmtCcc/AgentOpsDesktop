'use strict';

const { OutputParser, createMessage } = require('./output-parser');

/**
 * Parser that looks for a marker string in stdout and extracts
 * structured content after it.
 *
 * Default marker: __AGENT_OUTPUT__
 * Text before the marker is emitted as 'text' messages.
 * Content after the marker is parsed as JSON (if valid) or emitted as text.
 *
 * This formalizes the marker-based parsing currently inline in agent-runtime.js.
 */
class MarkerParser extends OutputParser {
  /**
   * @param {object} [options]
   * @param {string} [options.marker='__AGENT_OUTPUT__'] — the delimiter string
   */
  constructor(options = {}) {
    super();
    this.marker = options.marker || '__AGENT_OUTPUT__';
    this._buffer = '';
    this._markerFound = false;
  }

  parse(chunk) {
    if (this._markerFound) {
      // Already past the marker — accumulate for flush
      this._buffer += chunk;
      return [];
    }

    this._buffer += chunk;
    const markerIdx = this._buffer.indexOf(this.marker);

    if (markerIdx === -1) {
      // No marker yet — emit pre-marker text lines
      const lastNewline = this._buffer.lastIndexOf('\n');
      if (lastNewline === -1) return [];

      const complete = this._buffer.slice(0, lastNewline);
      this._buffer = this._buffer.slice(lastNewline + 1);

      const lines = complete.split('\n').filter(Boolean);
      return lines.map(line => createMessage({ type: 'text', text: line }));
    }

    // Marker found
    this._markerFound = true;
    const preMarker = this._buffer.slice(0, markerIdx);
    const postMarker = this._buffer.slice(markerIdx + this.marker.length);

    const messages = [];

    // Emit pre-marker text lines
    const preLines = preMarker.split('\n').filter(Boolean);
    for (const line of preLines) {
      messages.push(createMessage({ type: 'text', text: line }));
    }

    // Buffer post-marker content for flush
    this._buffer = postMarker;
    return messages;
  }

  flush() {
    const remaining = this._buffer.trim();
    this._buffer = '';
    if (!remaining) return [];

    // Try to parse as JSON (structured output)
    try {
      const obj = JSON.parse(remaining);
      return [createMessage({
        type: 'result',
        text: obj.content || obj.text || JSON.stringify(obj),
        data: obj,
      })];
    } catch {
      return [createMessage({ type: 'text', text: remaining })];
    }
  }

  reset() {
    this._buffer = '';
    this._markerFound = false;
  }
}

module.exports = MarkerParser;
