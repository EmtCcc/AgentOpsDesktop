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

describe('validate — number constraints', () => {
  it('validates min', () => {
    const schema = { count: { type: 'number', min: 1 } };
    expect(() => validate(schema, { count: 0 })).toThrow(ValidationError);
    expect(validate(schema, { count: 1 })).toEqual({ count: 1 });
  });

  it('validates max', () => {
    const schema = { count: { type: 'number', max: 100 } };
    expect(() => validate(schema, { count: 101 })).toThrow(ValidationError);
    expect(validate(schema, { count: 100 })).toEqual({ count: 100 });
  });
});

describe('validate — nested object schema', () => {
  it('validates nested fields', () => {
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
    expect(validate(schema, { config: { host: 'localhost', port: 3000 } })).toEqual({
      config: { host: 'localhost', port: 3000 },
    });
  });
});

describe('validate — array item validation', () => {
  it('validates array items', () => {
    const schema = {
      tags: { type: 'array', items: { type: 'string', minLength: 1 } },
    };
    expect(() => validate(schema, { tags: ['ok', ''] })).toThrow(ValidationError);
    expect(validate(schema, { tags: ['a', 'b'] })).toEqual({ tags: ['a', 'b'] });
  });

  it('validates minItems and maxItems', () => {
    const schema = { tags: { type: 'array', minItems: 1, maxItems: 3 } };
    expect(() => validate(schema, { tags: [] })).toThrow(ValidationError);
    expect(() => validate(schema, { tags: [1, 2, 3, 4] })).toThrow(ValidationError);
    expect(validate(schema, { tags: [1] })).toEqual({ tags: [1] });
  });
});

describe('validate — strict mode', () => {
  it('rejects unknown fields', () => {
    const schema = { name: { type: 'string' } };
    expect(() => validate(schema, { name: 'x', extra: 'y' }, { strict: true })).toThrow(ValidationError);
  });

  it('allows unknown fields by default', () => {
    const schema = { name: { type: 'string' } };
    expect(validate(schema, { name: 'x', extra: 'y' })).toEqual({ name: 'x', extra: 'y' });
  });
});

describe('validate — defaults', () => {
  it('applies default for missing field', () => {
    const schema = { status: { type: 'string', default: 'idle' } };
    expect(validate(schema, {})).toEqual({ status: 'idle' });
  });

  it('does not override provided value', () => {
    const schema = { status: { type: 'string', default: 'idle' } };
    expect(validate(schema, { status: 'running' })).toEqual({ status: 'running' });
  });
});

describe('ValidationError', () => {
  it('exposes structured errors array', () => {
    const schema = {
      a: { type: 'string', required: true },
      b: { type: 'number', required: true },
    };
    try {
      validate(schema, {});
    } catch (err) {
      expect(err.errors).toHaveLength(2);
      expect(err.errors[0].field).toBe('a');
      expect(err.errors[1].field).toBe('b');
    }
  });
});
