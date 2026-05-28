'use strict';

const { validate } = require('./middleware/validate');
const { AuthError } = require('./middleware/auth');
const { IpcError } = require('./errors');
const logger = require('../logger');

/**
 * IPC Router — registers channel handlers with validation, auth, and error handling.
 *
 * Usage:
 *   const router = new IpcRouter();
 *   router.setAuthMiddleware(authMiddleware);
 *   router.register('agents:list', agentController.list);
 *   router.register('agents:create', agentController.create, { schema: ..., auth: true });
 *   router.bootstrap();
 *
 * Response format: raw return values (backward-compatible with existing preload.js).
 * Validation and auth errors are thrown and caught by the monitor wrapper in index.js.
 */
class IpcRouter {
  constructor() {
    this._routes = new Map();
    this._authMiddleware = null;
    this._authorizeMiddleware = null;
    this._getRole = null;
  }

  /**
   * Set the authentication middleware function.
   *
   * @param {Function} middleware - (event, payload) => void (throws AuthError on failure)
   */
  setAuthMiddleware(middleware) {
    this._authMiddleware = middleware;
  }

  /**
   * Set the authorization middleware function.
   *
   * @param {Function} middleware - (event, payload, permission) => void (throws IpcError on failure)
   */
  setAuthorizeMiddleware(middleware) {
    this._authorizeMiddleware = middleware;
  }

  /**
   * Set a function that returns the current session role.
   * Used to attach session context to events for ownership checks.
   *
   * @param {Function} getRole - () => string|null
   */
  setRoleGetter(getRole) {
    this._getRole = getRole;
  }

  /**
   * Register a handler for an IPC channel.
   *
   * @param {string} channel - IPC channel name (e.g. 'agents:list')
   * @param {Function} handler - async (event, payload) => result
   * @param {Object} options
   * @param {Object} [options.schema] - Validation schema for the payload
   * @param {boolean} [options.auth] - Require authentication (default: false)
   * @param {string} [options.permission] - Required permission (e.g. 'agents:create')
   * @param {boolean} [options.strict] - Reject fields not in schema (default: false)
   */
  register(channel, handler, options = {}) {
    if (this._routes.has(channel)) {
      throw new Error(`Duplicate IPC route: ${channel}`);
    }
    this._routes.set(channel, {
      handler,
      schema: options.schema || null,
      auth: !!options.auth,
      permission: options.permission || null,
      strict: !!options.strict,
    });
  }

  /**
   * Activate all registered routes on ipcMain.
   * Pipeline: auth check → authorization check → payload validation → handler invocation.
   * Errors propagate to the monitor wrapper already installed in main/index.js.
   */
  bootstrap(electronIpcMain) {
    const ipcMain = electronIpcMain || require('electron').ipcMain;
    for (const [channel, { handler, schema, auth, permission, strict }] of this._routes) {
      ipcMain.handle(channel, async (event, payload) => {
        // Auth check (if route requires it)
        if (auth) {
          if (!this._authMiddleware) {
            throw new AuthError('Auth middleware not configured', 'AUTH_UNCONFIGURED');
          }
          this._authMiddleware(event, payload);
        }

        // Authorization check (if route declares a permission)
        if (permission) {
          if (!this._authorizeMiddleware) {
            throw new IpcError('AUTHORIZE_UNCONFIGURED', 'Authorize middleware not configured', 500);
          }
          this._authorizeMiddleware(event, payload, permission);
        }

        // Attach session context to event for ownership checks in handlers
        if (auth && this._authMiddleware) {
          event.session = { role: this._getRole() };
        }

        // Strip _auth field before validation and handler
        const cleanPayload = payload && typeof payload === 'object' && '_auth' in payload
          ? (() => { const { _auth, ...rest } = payload; return rest; })()
          : payload;

        if (schema) {
          validate(schema, cleanPayload, { strict });
        }

        try {
          return await handler(event, cleanPayload);
        } catch (err) {
          if (err instanceof IpcError) {
            return { ok: false, error: { code: err.code, message: err.message, status: err.status, field: err.field } };
          }
          throw err;
        }
      });
    }

    logger.info('ipc.routes_registered', { count: this._routes.size, channels: this.listRoutes() });
  }

  /**
   * List all registered channels (for diagnostics).
   */
  listRoutes() {
    return Array.from(this._routes.keys());
  }
}

module.exports = { IpcRouter };
