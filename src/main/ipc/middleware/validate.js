'use strict';

/**
 * Request validation middleware for IPC handlers.
 *
 * Each handler declares a `schema` object with field definitions.
 * Validation runs before the handler is invoked.
 *
 * Schema format per field:
 * {
 *   type: 'string' | 'number' | 'boolean' | 'object' | 'array',
 *   required: boolean,
 *   default: any,                    — applied to missing optional fields
 *   enum: [...],
 *   minLength: n,                    — string length (min)
 *   maxLength: n,                    — string length (max)
 *   pattern: RegExp,                 — string regex
 *   min: n,                          — number minimum (inclusive)
 *   max: n,                          — number maximum (inclusive)
 *   schema: { ... },                 — nested object validation schema
 *   items: { ... },                  — array item validation schema
 *   validate: (value) => boolean | string   — custom validator
 * }
 *
 * Top-level options (second arg to validate):
 *   strict: boolean — reject fields not declared in schema (default: false)
 */

class ValidationError extends Error {
  /**
   * @param {string} field - First offending field name
   * @param {string} message - Combined error message
   * @param {Array<{field: string, message: string}>} [errors] - All validation errors
   */
  constructor(field, message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.errors = errors;
  }
}

/**
 * Validate a single field value against its rules.
 * Returns an array of { field, message } errors (empty if valid).
 */
function _validateField(field, value, rules) {
  const errors = [];

  // Skip absent optional fields
  if (value === undefined || value === null) {
    if (rules.required) {
      errors.push({ field, message: `${field} is required` });
    }
    return errors;
  }

  // Type check
  if (rules.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      errors.push({ field, message: `${field} must be of type ${rules.type}, got ${actualType}` });
      return errors; // no point checking further if type is wrong
    }
  }

  // Enum check
  if (rules.enum && !rules.enum.includes(value)) {
    errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
  }

  // String constraints
  if (rules.type === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push({ field, message: `${field} has an invalid format` });
    }
  }

  // Number constraints
  if (rules.type === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push({ field, message: `${field} must be at least ${rules.min}` });
    }
    if (rules.max !== undefined && value > rules.max) {
      errors.push({ field, message: `${field} must be at most ${rules.max}` });
    }
  }

  // Array constraints
  if (rules.type === 'array') {
    if (rules.minItems !== undefined && value.length < rules.minItems) {
      errors.push({ field, message: `${field} must have at least ${rules.minItems} items` });
    }
    if (rules.maxItems !== undefined && value.length > rules.maxItems) {
      errors.push({ field, message: `${field} must have at most ${rules.maxItems} items` });
    }
    // Validate each array item against items schema
    if (rules.items) {
      for (let i = 0; i < value.length; i++) {
        const itemErrors = _validateField(`${field}[${i}]`, value[i], rules.items);
        errors.push(...itemErrors);
      }
    }
  }

  // Nested object validation
  if (rules.type === 'object' && rules.schema) {
    const nestedErrors = _validateObject(rules.schema, value, `${field}.`);
    errors.push(...nestedErrors);
  }

  // Custom validator
  if (rules.validate) {
    const result = rules.validate(value);
    if (result !== true) {
      errors.push({ field, message: typeof result === 'string' ? result : `${field} is invalid` });
    }
  }

  return errors;
}

/**
 * Validate an object payload against a schema.
 * @param {Object} schema - Field rules
 * @param {Object} payload - Data to validate
 * @param {string} [prefix] - Field path prefix for nested validation
 * @returns {Array<{field: string, message: string}>}
 */
function _validateObject(schema, payload, prefix = '') {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const fullField = prefix ? `${prefix}${field}` : field;
    const value = payload?.[field];
    errors.push(..._validateField(fullField, value, rules));
  }

  return errors;
}

/**
 * Apply defaults for missing optional fields.
 */
function _applyDefaults(schema, payload) {
  if (!schema || !payload || typeof payload !== 'object') return payload;
  const result = { ...payload };
  for (const [field, rules] of Object.entries(schema)) {
    if (rules.default !== undefined && (result[field] === undefined || result[field] === null)) {
      result[field] = typeof rules.default === 'function' ? rules.default() : rules.default;
    }
  }
  return result;
}

/**
 * Validate a payload against a schema definition.
 *
 * @param {Object} schema - Field validation rules
 * @param {Object} payload - Data to validate
 * @param {Object} [options]
 * @param {boolean} [options.strict] - Reject undeclared fields
 * @returns {Object} The (possibly sanitized) payload
 * @throws {ValidationError}
 */
function validate(schema, payload, options = {}) {
  if (!schema) return payload;

  // Apply defaults before validation
  const enriched = _applyDefaults(schema, payload);

  // Strict mode: reject fields not in schema
  if (options.strict && enriched && typeof enriched === 'object') {
    const declared = new Set(Object.keys(schema));
    const extra = Object.keys(enriched).filter(k => !declared.has(k));
    if (extra.length > 0) {
      throw new ValidationError(
        extra[0],
        `unknown fields: ${extra.join(', ')}`,
        extra.map(f => ({ field: f, message: `unknown field: ${f}` })),
      );
    }
  }

  const errors = _validateObject(schema, enriched);

  if (errors.length > 0) {
    throw new ValidationError(errors[0].field, errors.map(e => e.message).join('; '), errors);
  }

  return enriched;
}

module.exports = { validate, ValidationError };
