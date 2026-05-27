'use strict';

/**
 * Lightweight request validation for IPC handlers.
 *
 * Each handler declares a `schema` object with field definitions.
 * Validation runs before the handler is invoked.
 */

class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validate a payload against a schema definition.
 *
 * Schema format:
 * {
 *   fieldName: {
 *     type: 'string' | 'number' | 'boolean' | 'object' | 'array',
 *     required: true/false,
 *     enum: [...],
 *     minLength: n,
 *     maxLength: n,
 *     pattern: RegExp,
 *     validate: (value) => boolean | string   // custom validator
 *   }
 * }
 */
function validate(schema, payload) {
  if (!schema) return payload;

  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = payload?.[field];

    // Required check
    if (rules.required && (value === undefined || value === null)) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }

    // Skip optional fields that are absent
    if (value === undefined || value === null) continue;

    // Type check
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push({ field, message: `${field} must be of type ${rules.type}, got ${actualType}` });
        continue;
      }
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
    }

    // String constraints
    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({ field, message: `${field} has an invalid format` });
      }
    }

    // Custom validator
    if (rules.validate) {
      const result = rules.validate(value);
      if (result !== true) {
        errors.push({ field, message: typeof result === 'string' ? result : `${field} is invalid` });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors[0].field, errors.map(e => e.message).join('; '));
  }

  return payload;
}

module.exports = { validate, ValidationError };
