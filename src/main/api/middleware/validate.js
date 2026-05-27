'use strict';

/**
 * Hono middleware for request validation.
 *
 * Wraps the shared IPC validate() engine to enforce schemas
 * on HTTP request bodies and query parameters.
 */

const { validate, ValidationError } = require('../../ipc/middleware/validate');

/**
 * Create a Hono middleware that validates request body and/or query params.
 *
 * @param {Object} [opts.body] - Schema for request body (POST/PATCH/PUT)
 * @param {Object} [opts.query] - Schema for query parameters
 * @param {Object} [opts.options] - Extra options forwarded to validate() (e.g. { strict: true })
 * @returns {import('hono').MiddlewareHandler}
 */
function validateRequest({ body: bodySchema, query: querySchema, options = {} } = {}) {
  return async (c, next) => {
    const errors = [];

    // Validate query params
    if (querySchema) {
      const raw = c.req.query();
      // Convert string query values to proper types before validation
      const converted = _convertQueryTypes(querySchema, raw);
      try {
        validate(querySchema, converted, options);
      } catch (err) {
        if (err instanceof ValidationError) {
          errors.push(...err.errors.map(e => ({ ...e, source: 'query' })));
        } else {
          throw err;
        }
      }
    }

    // Validate body (only for methods that carry a body)
    if (bodySchema && ['POST', 'PATCH', 'PUT'].includes(c.req.method)) {
      let body;
      try {
        body = await c.req.json();
      } catch {
        errors.push({ field: 'body', message: 'Invalid JSON body', source: 'body' });
      }

      if (body !== undefined) {
        try {
          const validated = validate(bodySchema, body, options);
          // Store validated+defaulted body for the handler to use
          c.set('validatedBody', validated);
        } catch (err) {
          if (err instanceof ValidationError) {
            errors.push(...err.errors.map(e => ({ ...e, source: 'body' })));
          } else {
            throw err;
          }
        }
      }
    }

    if (errors.length > 0) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: errors.map(e => e.message).join('; '),
            status: 422,
            details: errors.map(e => ({ field: e.field, message: e.message, source: e.source })),
          },
        },
        422,
      );
    }

    await next();
  };
}

/**
 * Convert string query parameters to their schema-declared types.
 * Query params are always strings; this coerces numbers/booleans before validation.
 */
function _convertQueryTypes(schema, raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const result = { ...raw };
  for (const [field, rules] of Object.entries(schema)) {
    if (result[field] === undefined) continue;
    if (rules.type === 'number') {
      const n = Number(result[field]);
      if (!Number.isNaN(n)) result[field] = n;
    } else if (rules.type === 'boolean') {
      if (result[field] === 'true') result[field] = true;
      else if (result[field] === 'false') result[field] = false;
    }
  }
  return result;
}

module.exports = { validateRequest, ValidationError };
