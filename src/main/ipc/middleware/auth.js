'use strict';

/**
 * Authentication middleware for IPC handlers.
 *
 * Verifies that the request carries a valid session token.
 * Designed to compose with the existing IpcRouter validation pipeline.
 */

class AuthError extends Error {
  constructor(message, code = 'AUTH_REQUIRED') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * Create an auth middleware bound to a TokenManager instance.
 *
 * Usage:
 *   const auth = createAuthMiddleware(tokenManager);
 *   router.register('agent:spawn', handler, { auth: true, schema: ... });
 *
 * The middleware extracts the token from the IPC payload's `_auth` field.
 * The router strips `_auth` before passing the payload to the handler.
 *
 * @param {import('./token-manager').TokenManager} tokenManager
 * @returns {Function} middleware(event, payload) => { ok, session?, error? }
 */
function createAuthMiddleware(tokenManager) {
  return function authMiddleware(_event, payload) {
    const token = payload?._auth?.token;

    if (!token || typeof token !== 'string') {
      return {
        ok: false,
        error: new AuthError('Authentication required: missing token', 'AUTH_REQUIRED'),
      };
    }

    if (!tokenManager.validate(token)) {
      return {
        ok: false,
        error: new AuthError('Authentication failed: invalid or expired token', 'AUTH_INVALID'),
      };
    }

    return { ok: true };
  };
}

module.exports = { AuthError, createAuthMiddleware };
