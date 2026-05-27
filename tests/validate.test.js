import { describe, it, expect } from 'vitest';
import { validate, ValidationError } from '../src/main/ipc/middleware/validate.js';

describe('validate', () => {
  it('returns payload unchanged when no schema', () => {
    const payload = { foo: 'bar' };
    expect(validate(null, payload)).toBe(payload);
    expect(validate(undefined, payload)).toBe(payload);
  });

  it('passes valid payload', () => {
    const schema = {
      name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    };
    const result = validate(schema, { name: 'Test' });
    expect(result.name).toBe('Test');
  });

  it('throws on missing required field', () => {
    const schema = {
      name: { type: 'string', required: true },
    };
    expect(() => validate(schema, {})).toThrow(ValidationError);
    expect(() => validate(schema, { name: null })).toThrow(ValidationError);
  });

  it('throws on wrong type', () => {
    const schema = {
      count: { type: 'number' },
    };
    expect(() => validate(schema, { count: 'not a number' })).toThrow(ValidationError);
  });

  it('passes for optional missing fields', () => {
    const schema = {
      name: { type: 'string', required: true },
      optional: { type: 'string' },
    };
    const result = validate(schema, { name: 'Test' });
    expect(result.optional).toBeUndefined();
  });

  it('validates string minLength', () => {
    const schema = {
      name: { type: 'string', minLength: 3 },
    };
    expect(() => validate(schema, { name: 'ab' })).toThrow(ValidationError);
    expect(() => validate(schema, { name: 'abc' })).not.toThrow();
  });

  it('validates string maxLength', () => {
    const schema = {
      name: { type: 'string', maxLength: 5 },
    };
    expect(() => validate(schema, { name: 'toolongname' })).toThrow(ValidationError);
    expect(() => validate(schema, { name: 'short' })).not.toThrow();
  });

  it('validates enum values', () => {
    const schema = {
      status: { type: 'string', enum: ['pending', 'running', 'done'] },
    };
    expect(() => validate(schema, { status: 'invalid' })).toThrow(ValidationError);
    expect(() => validate(schema, { status: 'pending' })).not.toThrow();
  });

  it('validates array type', () => {
    const schema = {
      items: { type: 'array' },
    };
    expect(() => validate(schema, { items: 'not array' })).toThrow(ValidationError);
    expect(() => validate(schema, { items: [1, 2, 3] })).not.toThrow();
  });

  it('validates object type', () => {
    const schema = {
      config: { type: 'object' },
    };
    expect(() => validate(schema, { config: 'string' })).toThrow(ValidationError);
    expect(() => validate(schema, { config: { key: 'value' } })).not.toThrow();
  });

  it('runs custom validator', () => {
    const schema = {
      email: {
        type: 'string',
        validate: (v) => v.includes('@') || 'Must be a valid email',
      },
    };
    expect(() => validate(schema, { email: 'notanemail' })).toThrow(ValidationError);
    expect(() => validate(schema, { email: 'test@example.com' })).not.toThrow();
  });

  it('validates pattern', () => {
    const schema = {
      id: { type: 'string', pattern: /^agent-\d+$/ },
    };
    expect(() => validate(schema, { id: 'invalid' })).toThrow(ValidationError);
    expect(() => validate(schema, { id: 'agent-42' })).not.toThrow();
  });
});
