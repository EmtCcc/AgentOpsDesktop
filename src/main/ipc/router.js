'use strict';

const { ipcMain } = require('electron');
const { validate, ValidationError } = require('./middleware/validate');

/**
 * IPC Router — registers channel handlers with validation and error handling.
 *
 * Usage:
 *   const router = new IpcRouter();
 *   router.register('agent:spawn', agentController.spawn, { schema: spawnSchema });
 *   router.bootstrap();
 */
class IpcRouter {
  constructor() {
    this._routes = new Map();
  }

  /**
   * Register a handler for an IPC channel.
   *
   * @param {string} channel - IPC channel name (e.g. 'agent:spawn')
   * @param {Function} handler - async (event, payload) => result
   * @param {Object} options
   * @param {Object} [options.schema] - Validation schema for the payload
   * @param {boolean} [options.noReply] - Fire-and-forget (no response sent back)
   */
  register(channel, handler, options = {}) {
    if (this._routes.has(channel)) {
      throw new Error(`Duplicate IPC route: ${channel}`);
    }
    this._routes.set(channel, { handler, schema: options.schema, noReply: options.noReply });
  }

  /**
   * Activate all registered routes on ipcMain.
   * Each handler gets wrapped with validation and error handling.
   */
  bootstrap() {
    for (const [channel, { handler, schema, noReply }] of this._routes) {
      ipcMain.handle(channel, async (event, payload) => {
        try {
          // Validate payload if schema is defined
          const validated = validate(schema, payload);

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
