'use strict';

const { serve } = require('@hono/node-server');
const { createApp } = require('./app');
const logger = require('../logger');

/**
 * Start the HTTP API server.
 *
 * @param {object} opts
 * @param {object} opts.repos — Repository instances
 * @param {import('../ipc/middleware/token-manager').TokenManager} opts.tokenManager
 * @param {number} [opts.port=3967] — Port to listen on
 * @returns {Promise<{ server: import('http').Server, port: number }>}
 */
async function startApiServer({ repos, tokenManager, port = 3967 }) {
  const app = createApp({ repos, tokenManager });

  const server = serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    logger.info('api.server.started', { port: info.port });
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('api.server.stopping');
    server.close(() => {
      logger.info('api.server.stopped');
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { server, port };
}

module.exports = { startApiServer };
