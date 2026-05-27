import { describe, it, expect } from 'vitest';
import { validate, ValidationError } from '../../src/main/ipc/middleware/validate.js';

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

describe('validate — number constraints', () => {
  it('validates min', () => {
    const schema = { count: { type: 'number', min: 1 } };
    expect(() => validate(schema, { count: 0 })).toThrow(ValidationError);
    expect(validate(schema, { count: 1 })).toEqual({ count: 1 });
    expect(validate(schema, { count: 99 })).toEqual({ count: 99 });
  });

  it('validates max', () => {
    const schema = { count: { type: 'number', max: 100 } };
    expect(() => validate(schema, { count: 101 })).toThrow(ValidationError);
    expect(validate(schema, { count: 100 })).toEqual({ count: 100 });
  });

  it('validates min and max together', () => {
    const schema = { port: { type: 'number', min: 1, max: 65535 } };
    expect(() => validate(schema, { port: 0 })).toThrow(ValidationError);
    expect(() => validate(schema, { port: 65536 })).toThrow(ValidationError);
    expect(validate(schema, { port: 3000 })).toEqual({ port: 3000 });
  });
});

describe('validate — nested object schema', () => {
  it('validates nested object fields', () => {
    const schema = {
      config: {
        type: 'object',
        schema: {
          host: { type: 'string', required: true },
          port: { type: 'number', min: 1, max: 65535 },
        },
      },
    };
    expect(() => validate(schema, { config: { port: 3000 } })).toThrow(ValidationError);
    expect(() => validate(schema, { config: { host: 'x', port: 99999 } })).toThrow(ValidationError);
    expect(validate(schema, { config: { host: 'localhost', port: 3000 } })).toEqual({
      config: { host: 'localhost', port: 3000 },
    });
  });

  it('skips nested validation when object is absent and not required', () => {
    const schema = {
      config: {
        type: 'object',
        schema: { host: { type: 'string', required: true } },
      },
    };
    expect(validate(schema, {})).toEqual({});
  });
});

describe('validate — array item validation', () => {
  it('validates array items against schema', () => {
    const schema = {
      tags: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
    };
    expect(() => validate(schema, { tags: ['ok', ''] })).toThrow(ValidationError);
    expect(validate(schema, { tags: ['a', 'b'] })).toEqual({ tags: ['a', 'b'] });
  });

  it('validates array item types', () => {
    const schema = {
      ids: { type: 'array', items: { type: 'number' } },
    };
    expect(() => validate(schema, { ids: [1, 'two', 3] })).toThrow(ValidationError);
    expect(validate(schema, { ids: [1, 2, 3] })).toEqual({ ids: [1, 2, 3] });
  });

  it('validates minItems and maxItems', () => {
    const schema = { tags: { type: 'array', minItems: 1, maxItems: 3 } };
    expect(() => validate(schema, { tags: [] })).toThrow(ValidationError);
    expect(() => validate(schema, { tags: [1, 2, 3, 4] })).toThrow(ValidationError);
    expect(validate(schema, { tags: [1] })).toEqual({ tags: [1] });
  });
});

describe('validate — strict mode', () => {
  it('rejects unknown fields in strict mode', () => {
    const schema = { name: { type: 'string' } };
    expect(() => validate(schema, { name: 'x', extra: 'y' }, { strict: true })).toThrow(ValidationError);
  });

  it('allows unknown fields when strict is false (default)', () => {
    const schema = { name: { type: 'string' } };
    expect(validate(schema, { name: 'x', extra: 'y' })).toEqual({ name: 'x', extra: 'y' });
  });

  it('passes strict mode when no extra fields', () => {
    const schema = { name: { type: 'string', required: true } };
    expect(validate(schema, { name: 'x' }, { strict: true })).toEqual({ name: 'x' });
  });
});

describe('validate — defaults', () => {
  it('applies default value for missing optional field', () => {
    const schema = { status: { type: 'string', default: 'idle' } };
    expect(validate(schema, {})).toEqual({ status: 'idle' });
  });

  it('does not override provided values with default', () => {
    const schema = { status: { type: 'string', default: 'idle' } };
    expect(validate(schema, { status: 'running' })).toEqual({ status: 'running' });
  });

  it('supports function defaults', () => {
    const schema = { id: { type: 'string', default: () => 'generated' } };
    expect(validate(schema, {})).toEqual({ id: 'generated' });
  });
});

describe('ValidationError', () => {
  it('exposes field and message', () => {
    const err = new ValidationError('name', 'name is required');
    expect(err.field).toBe('name');
    expect(err.message).toBe('name is required');
    expect(err.name).toBe('ValidationError');
  });

  it('exposes structured errors array', () => {
    const schema = {
      a: { type: 'string', required: true },
      b: { type: 'number', required: true },
    };
    try {
      validate(schema, {});
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.errors).toHaveLength(2);
      expect(err.errors[0]).toEqual({ field: 'a', message: 'a is required' });
      expect(err.errors[1]).toEqual({ field: 'b', message: 'b is required' });
    }
  });
});
