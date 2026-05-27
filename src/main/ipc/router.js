'use strict';

const { ipcMain } = require('electron');
const { validate, ValidationError } = require('./middleware/validate');
const { AuthError } = require('./middleware/auth');

/**
 * IPC Router — registers channel handlers with validation, auth, and error handling.
 *
 * Usage:
 *   const router = new IpcRouter();
 *   router.setAuthMiddleware(authMiddleware);
 *   router.register('agent:spawn', agentController.spawn, { schema: spawnSchema, auth: true });
 *   router.bootstrap();
 */
class IpcRouter {
  constructor() {
    this._routes = new Map();
    this._authMiddleware = null;
  }

  /**
   * Set the authentication middleware function.
   *
   * @param {Function} middleware - async (event, payload) => { ok, error? }
   */
  setAuthMiddleware(middleware) {
    this._authMiddleware = middleware;
  }

  /**
   * Register a handler for an IPC channel.
   *
   * @param {string} channel - IPC channel name (e.g. 'agent:spawn')
   * @param {Function} handler - async (event, payload) => result
   * @param {Object} options
   * @param {Object} [options.schema] - Validation schema for the payload
   * @param {boolean} [options.auth] - Require authentication (default: false)
   * @param {boolean} [options.noReply] - Fire-and-forget (no response sent back)
   */
  register(channel, handler, options = {}) {
    if (this._routes.has(channel)) {
      throw new Error(`Duplicate IPC route: ${channel}`);
    }
    this._routes.set(channel, {
      handler,
      schema: options.schema,
      auth: !!options.auth,
      noReply: options.noReply,
    });
  }

  /**
   * Activate all registered routes on ipcMain.
   * Pipeline: auth check → payload validation → handler invocation.
   */
  bootstrap() {
    for (const [channel, { handler, schema, auth }] of this._routes) {
      ipcMain.handle(channel, async (event, payload) => {
        try {
          // Auth check (if route requires it)
          if (auth) {
            if (!this._authMiddleware) {
              return { ok: false, error: { code: 'AUTH_UNCONFIGURED', message: 'Auth middleware not set' } };
            }
            const authResult = this._authMiddleware(event, payload);
            if (!authResult.ok) {
              return { ok: false, error: { code: authResult.error.code, message: authResult.error.message } };
            }
          }

          // Strip _auth field before validation and handler invocation
          const cleanPayload = payload && typeof payload === 'object'
            ? (() => { const { _auth, ...rest } = payload; return rest; })()
            : payload;

          // Validate payload if schema is defined
          const validated = validate(schema, cleanPayload);

          // Invoke the handler
          const result = await handler(event, validated);

          return { ok: true, data: result };
        } catch (err) {
          if (err instanceof ValidationError) {
            return { ok: false, error: { code: 'VALIDATION_ERROR', message: err.message, field: err.field } };
          }

          console.error(`[IPC] Error in ${channel}:`, err);
          return { ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } };
        }
      });
    }

    console.log(`[IPC] Registered ${this._routes.size} routes`);
  }

  /**
   * List all registered channels (for diagnostics).
   */
  listRoutes() {
    return Array.from(this._routes.keys());
  }
}

module.exports = { IpcRouter };
