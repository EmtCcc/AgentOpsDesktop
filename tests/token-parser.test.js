import { describe, it, expect } from 'vitest';
import { parseTokenUsage, calculateCost } from '../src/main/token-parser.js';

describe('token-parser', () => {
  describe('parseTokenUsage', () => {
    it('returns null for empty input', () => {
      expect(parseTokenUsage(null)).toBeNull();
      expect(parseTokenUsage('')).toBeNull();
      expect(parseTokenUsage('no json here')).toBeNull();
    });

    it('parses Claude stream-json result message', () => {
      const stdout = [
        '{"type":"assistant","message":{"role":"assistant","model":"claude-sonnet-4-20250514","usage":{"input_tokens":1500,"output_tokens":800}}}',
        '{"type":"result","subtype":"success","usage":{"input_tokens":2000,"output_tokens":1000},"model":"claude-sonnet-4-20250514"}',
      ].join('\n');

      const result = parseTokenUsage(stdout);
      expect(result).not.toBeNull();
      expect(result.inputTokens).toBe(2000);
      expect(result.outputTokens).toBe(1000);
      expect(result.model).toBe('claude-sonnet-4-20250514');
      expect(result.provider).toBe('anthropic');
    });

    it('parses Claude assistant message with usage', () => {
      const stdout = '{"type":"assistant","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude-opus-4-20250514","usage":{"input_tokens":5000,"output_tokens":3000}}}';

      const result = parseTokenUsage(stdout);
      expect(result).not.toBeNull();
      expect(result.inputTokens).toBe(5000);
      expect(result.outputTokens).toBe(3000);
      expect(result.model).toBe('claude-opus-4-20250514');
      expect(result.provider).toBe('anthropic');
    });

    it('parses OpenAI/Codex format with prompt_tokens/completion_tokens', () => {
      const stdout = JSON.stringify({
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        usage: { prompt_tokens: 1200, completion_tokens: 600 },
      });

      const result = parseTokenUsage(stdout);
      expect(result).not.toBeNull();
      expect(result.inputTokens).toBe(1200);
      expect(result.outputTokens).toBe(600);
      expect(result.model).toBe('gpt-4o');
      expect(result.provider).toBe('openai');
    });

    it('parses OpenAI format with input_tokens/output_tokens', () => {
      const stdout = JSON.stringify({
        model: 'o4-mini',
        usage: { input_tokens: 800, output_tokens: 400 },
      });

      const result = parseTokenUsage(stdout);
      expect(result).not.toBeNull();
      expect(result.inputTokens).toBe(800);
      expect(result.outputTokens).toBe(400);
      expect(result.provider).toBe('openai');
    });

    it('takes the last usage record from multiple lines', () => {
      const stdout = [
        '{"type":"assistant","message":{"model":"claude-sonnet-4-20250514","usage":{"input_tokens":100,"output_tokens":50}}}',
        '{"type":"assistant","message":{"model":"claude-sonnet-4-20250514","usage":{"input_tokens":200,"output_tokens":100}}}',
        '{"type":"result","usage":{"input_tokens":500,"output_tokens":250},"model":"claude-sonnet-4-20250514"}',
      ].join('\n');

      const result = parseTokenUsage(stdout);
      expect(result.inputTokens).toBe(500);
      expect(result.outputTokens).toBe(250);
    });

    it('skips non-JSON lines', () => {
      const stdout = [
        'Starting agent...',
        'Loading config...',
        '{"type":"result","usage":{"input_tokens":1000,"output_tokens":500},"model":"claude-sonnet-4-20250514"}',
        'Done.',
      ].join('\n');

      const result = parseTokenUsage(stdout);
      expect(result).not.toBeNull();
      expect(result.inputTokens).toBe(1000);
    });

    it('handles Claude result with cost_usd', () => {
      const stdout = '{"type":"result","usage":{"input_tokens":1000,"output_tokens":500},"cost_usd":0.045,"model":"claude-sonnet-4-20250514"}';

      const result = parseTokenUsage(stdout);
      expect(result.costUsd).toBe(0.045);
    });

    it('calculates cost from model pricing when cost_usd is absent', () => {
      const stdout = '{"type":"result","usage":{"input_tokens":1000000,"output_tokens":1000000},"model":"claude-sonnet-4-20250514"}';

      const result = parseTokenUsage(stdout);
      expect(result.costUsd).toBeGreaterThan(0);
      // 1M input * $3 + 1M output * $15 = $18
      expect(result.costUsd).toBeCloseTo(18, 0);
    });

    it('returns zero cost for unknown models', () => {
      const stdout = '{"type":"result","usage":{"input_tokens":1000,"output_tokens":500},"model":"some-unknown-model"}';

      const result = parseTokenUsage(stdout);
      expect(result.costUsd).toBe(0);
    });
  });

  describe('calculateCost', () => {
    it('returns 0 for unknown model', () => {
      expect(calculateCost(1000, 500, 'unknown-model')).toBe(0);
    });

    it('returns 0 for null model', () => {
      expect(calculateCost(1000, 500, null)).toBe(0);
    });

    it('calculates correct cost for Claude Sonnet 4', () => {
      // $3/M input, $15/M output
      const cost = calculateCost(1_000_000, 1_000_000, 'claude-sonnet-4-20250514');
      expect(cost).toBeCloseTo(18, 2);
    });

    it('calculates correct cost for Claude Opus 4', () => {
      // $15/M input, $75/M output
      const cost = calculateCost(1_000_000, 1_000_000, 'claude-opus-4-20250514');
      expect(cost).toBeCloseTo(90, 2);
    });

    it('calculates proportional cost for partial tokens', () => {
      // 100K input at $3/M = $0.30, 50K output at $15/M = $0.75 => $1.05
      const cost = calculateCost(100_000, 50_000, 'claude-sonnet-4-20250514');
      expect(cost).toBeCloseTo(1.05, 2);
    });

    it('handles prefix matching for model names', () => {
      const cost = calculateCost(1_000_000, 1_000_000, 'claude-sonnet-4-20250514-beta');
      expect(cost).toBeCloseTo(18, 2);
    });
  });
});
