'use strict';

/**
 * Token usage parser — extracts input/output token counts from agent CLI output.
 *
 * Supports:
 *   - Claude CLI stream-json (result messages and assistant messages)
 *   - Codex API responses
 *   - Generic JSON blobs with input_tokens/output_tokens fields
 */

// Known model pricing (USD per 1M tokens) — input/output
const MODEL_PRICING = {
  // Claude 4.x
  'claude-opus-4-20250514':     { input: 15,   output: 75 },
  'claude-opus-4-0':            { input: 15,   output: 75 },
  'claude-sonnet-4-20250514':   { input: 3,    output: 15 },
  'claude-sonnet-4-0':          { input: 3,    output: 15 },
  'claude-haiku-4-5-20251001':  { input: 0.8,  output: 4 },
  'claude-haiku-4-5-0':         { input: 0.8,  output: 4 },
  // Claude 3.x
  'claude-3-5-sonnet-20241022': { input: 3,    output: 15 },
  'claude-3-5-haiku-20241022':  { input: 0.8,  output: 4 },
  'claude-3-opus-20240229':     { input: 15,   output: 75 },
  // Codex (OpenAI)
  'codex-mini-latest':          { input: 1.5,  output: 6 },
  'o4-mini':                    { input: 1.1,  output: 4.4 },
  'o3':                         { input: 2,    output: 8 },
  'gpt-4o':                     { input: 2.5,  output: 10 },
  'gpt-4o-mini':                { input: 0.15, output: 0.6 },
};

/**
 * Calculate cost in USD from token counts and model name.
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @param {string} [model]
 * @returns {number} cost in USD
 */
function calculateCost(inputTokens, outputTokens, model) {
  if (!model) return 0;
  // Try exact match, then prefix match
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const normalized = model.toLowerCase();
    for (const [key, val] of Object.entries(MODEL_PRICING)) {
      if (normalized.startsWith(key) || key.startsWith(normalized)) {
        pricing = val;
        break;
      }
    }
  }
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

/**
 * Parse a single JSON line for token usage.
 * Returns { inputTokens, outputTokens, model, provider } or null.
 */
function _parseJsonLine(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // Claude stream-json: result message
  if (obj.type === 'result' && obj.usage) {
    const u = obj.usage;
    return {
      inputTokens: u.input_tokens || 0,
      outputTokens: u.output_tokens || 0,
      model: obj.model || null,
      provider: 'anthropic',
      costUsd: obj.cost_usd || null,
    };
  }

  // Claude stream-json: assistant message with usage
  if (obj.type === 'assistant' && obj.message && obj.message.usage) {
    const u = obj.message.usage;
    return {
      inputTokens: u.input_tokens || 0,
      outputTokens: u.output_tokens || 0,
      model: obj.message.model || obj.model || null,
      provider: 'anthropic',
      costUsd: null,
    };
  }

  // Codex / OpenAI format: usage in response
  if (obj.usage && typeof obj.usage === 'object') {
    const u = obj.usage;
    if (u.input_tokens != null || u.prompt_tokens != null) { // eslint-disable-line eqeqeq
      return {
        inputTokens: u.input_tokens || u.prompt_tokens || 0,
        outputTokens: u.output_tokens || u.completion_tokens || 0,
        model: obj.model || null,
        provider: _guessProvider(obj.model),
        costUsd: null,
      };
    }
  }

  // Generic: top-level input_tokens/output_tokens
  if (obj.input_tokens != null || obj.output_tokens != null) { // eslint-disable-line eqeqeq
    return {
      inputTokens: obj.input_tokens || 0,
      outputTokens: obj.output_tokens || 0,
      model: obj.model || null,
      provider: _guessProvider(obj.model),
      costUsd: null,
    };
  }

  return null;
}

function _guessProvider(model) {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.startsWith('claude')) return 'anthropic';
  if (m.startsWith('gpt') || m.startsWith('o3') || m.startsWith('o4') || m.startsWith('codex')) return 'openai';
  return null;
}

/**
 * Parse token usage from agent stdout buffer.
 * Scans all lines for the LAST matching usage record (most complete).
 *
 * @param {string} stdout — full stdout buffer from agent process
 * @returns {{ inputTokens: number, outputTokens: number, model: string|null, provider: string|null, costUsd: number|null } | null}
 */
function parseTokenUsage(stdout) {
  if (!stdout || typeof stdout !== 'string') return null;

  const lines = stdout.split('\n');
  let lastUsage = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;

    try {
      const obj = JSON.parse(trimmed);
      const usage = _parseJsonLine(obj);
      if (usage) {
        lastUsage = usage;
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  if (!lastUsage) return null;

  // Calculate cost if not already provided
  if (lastUsage.costUsd == null || lastUsage.costUsd === 0) { // eslint-disable-line eqeqeq
    lastUsage.costUsd = calculateCost(lastUsage.inputTokens, lastUsage.outputTokens, lastUsage.model);
  }

  return lastUsage;
}

module.exports = { parseTokenUsage, calculateCost, MODEL_PRICING };
