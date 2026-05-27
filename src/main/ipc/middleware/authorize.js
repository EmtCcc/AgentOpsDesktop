'use strict';

/**
 * Authorization middleware for IPC handlers.
 *
 * Checks that the authenticated session's role has the required permission
 * for the current route. Must run AFTER auth middleware (requires a valid session).
 *
 * Designed to compose with the existing IpcRouter validation pipeline.
 */

const { hasPermission } = require('./rbac');
const { IpcError } = require('../errors');

/**
 * Create an authorize middleware bound to a TokenManager instance.
 *
 * The middleware reads the session role from the TokenManager and checks
 * it against the required permission. Throws IpcError('FORBIDDEN') on failure.
 *
 * @param {import('./token-manager').TokenManager} tokenManager
 * @returns {Function} middleware(event, payload, permission) => void (throws on failure)
 */
function createAuthorizeMiddleware(tokenManager) {
  return function authorizeMiddleware(_event, _payload, permission) {
    const role = tokenManager.getRole();

    if (!role) {
      throw IpcError.forbidden('No active session role');
    }

    if (!hasPermission(role, permission)) {
      throw IpcError.forbidden(`Role "${role}" lacks permission: ${permission}`);
    }
  };
}

module.exports = { createAuthorizeMiddleware };
