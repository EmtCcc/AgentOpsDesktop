'use strict';

const os = require('os');
const { app } = require('electron');

/**
 * System controller — health check, app info, diagnostics.
 */
const systemController = {
  /**
   * Health check endpoint.
   * Returns application status and basic system info.
   */
  async healthCheck() {
    return {
      status: 'ok',
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: process.memoryUsage(),
      },
      timestamp: Date.now(),
    };
  },

  /**
   * List all registered IPC routes (for debugging).
   */
  async listRoutes(_event, _payload, router) {
    return { routes: router.listRoutes() };
  },
};

module.exports = systemController;
