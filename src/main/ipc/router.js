'use strict';

const { ipcMain } = require('electron');
const { validate, ValidationError } = require('./middleware/validate');
const logger = require('../logger');

/**
 * IPC Router — registers channel handlers with validation and error handling.
 *
 * Usage:
 *   const router = new IpcRouter();
 *   router.register('agents:list', agentController.list);
 *   router.register('agents:create', agentController.create, { schema: agentController.schemas.create });
 *   router.bootstrap();
 *
 * Response format: raw return values (backward-compatible with existing preload.js).
 * Validation errors are thrown and caught by the monitor wrapper in index.js.
 */
class IpcRouter {
  constructor() {
    this._routes = new Map();
  }

  /**
   * Register a handler for an IPC channel.
   *
   * @param {string} channel - IPC channel name (e.g. 'agents:list')
   * @param {Function} handler - async (event, payload) => result
   * @param {Object} options
   * @param {Object} [options.schema] - Validation schema for the payload
   */
  register(channel, handler, options = {}) {
    if (this._routes.has(channel)) {
      throw new Error(`Duplicate IPC route: ${channel}`);
    }
    this._routes.set(channel, { handler, schema: options.schema || null });
  }

  /**
   * Activate all registered routes on ipcMain.
   * Pipeline: payload validation → handler invocation.
   * Errors propagate to the monitor wrapper already installed in main/index.js.
   */
  bootstrap() {
    for (const [channel, { handler, schema }] of this._routes) {
      ipcMain.handle(channel, async (event, payload) => {
        if (schema) {
          validate(schema, payload);
        }
        return handler(event, payload);
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
