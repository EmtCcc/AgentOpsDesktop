'use strict';

const { OutputParser, createMessage } = require('./output-parser');

/**
 * Parser for Claude Code's `--output-format stream-json` output.
 *
 * Claude Code emits NDJSON with typed events:
 *   {"type":"system","subtype":"init","session_id":"...","model":"...",...}
 *   {"type":"assistant","message":{"role":"assistant","content":[...]},...}
 *   {"type":"result","subtype":"success","result":"...","session_id":"...",...}
 *
 * This parser extracts session metadata, assistant text, cost info,
 * and the final result for downstream consumption.
 */
class ClaudeCodeStreamParser extends OutputParser {
  constructor() {
    super();
    this._buffer = '';
    /** @type {string|null} Last seen session_id from stream events */
    this.sessionId = null;
    /** @type {string|null} Last seen model from stream events */
    this.model = null;
    /** @type {number} Accumulated cost in USD */
    this.costUsd = 0;
    /** @type {string[]} Collected assistant text fragments */
    this._textParts = [];
  }

  parse(chunk) {
    this._buffer += chunk;
    const messages = [];

    let newlineIdx;
    while ((newlineIdx = this._buffer.indexOf('\n')) !== -1) {
      const line = this._buffer.slice(0, newlineIdx).trim();
      this._buffer = this._buffer.slice(newlineIdx + 1);

      if (!line) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        messages.push(createMessage({ type: 'text', text: line }));
        continue;
      }

      // Extract metadata from any event that carries it
      if (event.session_id) this.sessionId = event.session_id;
      if (event.model) this.model = event.model;
      if (typeof event.cost_usd === 'number') this.costUsd += event.cost_usd;

      const msg = this._mapEvent(event);
      if (msg) messages.push(msg);
    }

    return messages;
  }

  flush() {
    // Process any remaining buffer
    const remaining = this._buffer.trim();
    this._buffer = '';
    if (!remaining) return [];

    let event;
    try {
      event = JSON.parse(remaining);
    } catch {
      return [createMessage({ type: 'text', text: remaining })];
    }

    if (event.session_id) this.sessionId = event.session_id;
    if (event.model) this.model = event.model;
    if (typeof event.cost_usd === 'number') this.costUsd += event.cost_usd;

    const msg = this._mapEvent(event);
    return msg ? [msg] : [];
  }

  /**
   * Map a parsed Claude Code event to a ParsedMessage.
   * Returns null for events that are purely metadata (e.g. system init).
   */
  _mapEvent(event) {
    switch (event.type) {
      case 'system':
        return createMessage({
          type: 'metadata',
          text: event.subtype || 'system',
          data: event,
        });

      case 'assistant': {
        // Extract text from content blocks
        const content = event.message?.content;
        if (Array.isArray(content)) {
          const textParts = content
            .filter((b) => b.type === 'text')
            .map((b) => b.text);
          if (textParts.length > 0) {
            const joined = textParts.join('');
            this._textParts.push(joined);
            return createMessage({
              type: 'assistant',
              text: joined,
              data: event,
            });
          }
        }
        // No text content — emit as raw data
        return createMessage({
          type: 'assistant',
          text: event.message?.content?.[0]?.text || '',
          data: event,
        });
      }

      case 'result':
        return createMessage({
          type: 'result',
          text: event.result || '',
          data: {
            ...event,
            sessionId: this.sessionId,
            model: this.model,
            totalCostUsd: this.costUsd,
            collectedText: this._textParts.join(''),
          },
        });

      default:
        // Unknown event type — pass through as data
        return createMessage({
          type: event.type || 'unknown',
          text: event.text || event.result || '',
          data: event,
        });
    }
  }

  /**
   * Get accumulated session metadata.
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      model: this.model,
      costUsd: this.costUsd,
      fullText: this._textParts.join(''),
    };
  }

  reset() {
    this._buffer = '';
    this.sessionId = null;
    this.model = null;
    this.costUsd = 0;
    this._textParts = [];
  }
}

module.exports = ClaudeCodeStreamParser;
