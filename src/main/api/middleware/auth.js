'use strict';

/**
 * HTTP auth middleware for the Hono API.
 *
 * Extracts a Bearer token from the Authorization header and validates it
 * against the shared TokenManager instance. Sets `c.set('session', session)`
 * on success.
 */

const { HTTPException } = require('hono/http-exception');

/**
 * Create an auth middleware bound to a TokenManager instance.
 * @param {import('../../ipc/middleware/token-manager').TokenManager} tokenManager
 * @returns {import('hono').MiddlewareHandler}
 */
function createAuthMiddleware(tokenManager) {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);
    const valid = tokenManager.validate(token);
    if (!valid) {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }
    const session = tokenManager.getSessionInfo();

    c.set('session', session);
    await next();
  };
}

/**
 * Create an optional auth middleware — sets session if valid token present,
 * but does not reject unauthenticated requests.
 * @param {import('../../ipc/middleware/token-manager').TokenManager} tokenManager
 * @returns {import('hono').MiddlewareHandler}
 */
function createOptionalAuthMiddleware(tokenManager) {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const valid = tokenManager.validate(token);
      if (valid) {
        c.set('session', tokenManager.getSessionInfo());
      }
    }
    await next();
  };
}

module.exports = { createAuthMiddleware, createOptionalAuthMiddleware };
