'use strict';

/**
 * Authentication middleware for IPC handlers.
 *
 * Verifies that the request carries a valid session token.
 * Designed to compose with the existing IpcRouter validation pipeline.
 * Throws AuthError on failure (matching the throw-based error pattern).
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
 * The middleware extracts the token from the IPC payload's `_auth` field
 * and validates it. Throws AuthError on failure. Returns void on success.
 *
 * @param {import('./token-manager').TokenManager} tokenManager
 * @returns {Function} middleware(event, payload) => void (throws on failure)
 */
function createAuthMiddleware(tokenManager) {
  return function authMiddleware(_event, payload) {
    const token = payload?._auth?.token;

    if (!token || typeof token !== 'string') {
      throw new AuthError('Authentication required: missing token', 'AUTH_REQUIRED');
    }

    if (!tokenManager.validate(token)) {
      throw new AuthError('Authentication failed: invalid or expired token', 'AUTH_INVALID');
    }
  };
}

module.exports = { AuthError, createAuthMiddleware };
