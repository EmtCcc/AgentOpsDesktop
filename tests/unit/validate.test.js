'use strict';

const { describe, it, expect } = require('vitest');
const { validate, ValidationError } = require('../../src/main/ipc/middleware/validate');

describe('validate', () => {
  it('returns payload unchanged when no schema is provided', () => {
    const payload = { foo: 'bar' };
    expect(validate(null, payload)).toBe(payload);
    expect(validate(undefined, payload)).toBe(payload);
  });

  it('passes valid payload through', () => {
    const schema = { name: { type: 'string', required: true } };
    const payload = { name: 'agent-1' };
    expect(validate(schema, payload)).toEqual(payload);
  });

  it('throws ValidationError for missing required field', () => {
    const schema = { name: { type: 'string', required: true } };
    expect(() => validate(schema, {})).toThrow(ValidationError);
  });

  it('throws ValidationError for wrong type', () => {
    const schema = { count: { type: 'number' } };
    expect(() => validate(schema, { count: 'abc' })).toThrow(ValidationError);
  });

  it('allows optional fields to be absent', () => {
    const schema = {
      name: { type: 'string', required: true },
      tag: { type: 'string' },
    };
    expect(validate(schema, { name: 'x' })).toEqual({ name: 'x' });
  });

  it('validates enum constraints', () => {
    const schema = { status: { type: 'string', enum: ['running', 'idle', 'error'] } };
    expect(() => validate(schema, { status: 'unknown' })).toThrow(ValidationError);
    expect(validate(schema, { status: 'running' })).toEqual({ status: 'running' });
  });

  it('validates string minLength and maxLength', () => {
    const schema = { name: { type: 'string', minLength: 2, maxLength: 5 } };
    expect(() => validate(schema, { name: 'a' })).toThrow(ValidationError);
    expect(() => validate(schema, { name: 'abcdef' })).toThrow(ValidationError);
    expect(validate(schema, { name: 'abc' })).toEqual({ name: 'abc' });
  });

  it('validates string pattern', () => {
    const schema = { channel: { type: 'string', pattern: /^[a-z]+:[a-z]+$/ } };
    expect(() => validate(schema, { channel: 'BAD' })).toThrow(ValidationError);
    expect(validate(schema, { channel: 'agent:spawn' })).toEqual({ channel: 'agent:spawn' });
  });

  it('runs custom validator function', () => {
    const schema = {
      port: {
        type: 'number',
        validate: (v) => (v > 0 && v < 65536) ? true : 'port out of range',
      },
    };
    expect(() => validate(schema, { port: 99999 })).toThrow(ValidationError);
    expect(validate(schema, { port: 3000 })).toEqual({ port: 3000 });
  });

  it('detects arrays as type "array"', () => {
    const schema = { items: { type: 'array' } };
    expect(validate(schema, { items: [1, 2] })).toEqual({ items: [1, 2] });
    expect(() => validate(schema, { items: 'not-array' })).toThrow(ValidationError);
  });

  it('collects multiple errors in a single throw', () => {
    const schema = {
      a: { type: 'string', required: true },
      b: { type: 'number', required: true },
    };
    try {
      validate(schema, {});
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toContain('a is required');
      expect(err.message).toContain('b is required');
    }
  });
});

describe('ValidationError', () => {
  it('exposes field and message', () => {
    const err = new ValidationError('name', 'name is required');
    expect(err.field).toBe('name');
    expect(err.message).toBe('name is required');
    expect(err.name).toBe('ValidationError');
  });
});
