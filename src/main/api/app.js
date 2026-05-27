'use strict';

const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { logger: honoLogger } = require('hono/logger');
const { HTTPException } = require('hono/http-exception');

const health = require('./routes/health');
const agents = require('./routes/agents');
const goals = require('./routes/goals');
const tasks = require('./routes/tasks');
const logs = require('./routes/logs');
const stats = require('./routes/stats');
const settingsRoutes = require('./routes/settings');
const { createAuthRoutes } = require('./routes/auth');
const { createAuthMiddleware } = require('./middleware/auth');
const { ValidationError } = require('./middleware/validate');

/**
 * Create the Hono API app.
 *
 * @param {object} opts
 * @param {object} opts.repos — Repository instances (agents, goals, tasks, taskLogs, settings)
 * @param {import('../ipc/middleware/token-manager').TokenManager} opts.tokenManager
 * @returns {Hono}
 */
function createApp({ repos, tokenManager }) {
  const app = new Hono();

  // ── Global middleware ──
  app.use('*', cors());
  app.use('*', honoLogger());

  // ── Inject repos into context ──
  app.use('*', async (c, next) => {
    c.set('repos', repos);
    await next();
  });

  // ── Public routes ──
  app.route('/health', health);
  app.route('/auth', createAuthRoutes(tokenManager));

  // ── List all routes (public, for debugging) ──
  app.get('/routes', (c) => {
    const routes = [];
    app.routes.forEach((r) => {
      routes.push({ method: r.method, path: r.path });
    });
    return c.json({ ok: true, data: routes });
  });

  // ── Protected routes ──
  const authMiddleware = createAuthMiddleware(tokenManager);

  // Apply auth to all /api/* routes
  app.use('/api/*', authMiddleware);

  app.route('/api/agents', agents);
  app.route('/api/goals', goals);
  app.route('/api/tasks', tasks);
  app.route('/api/logs', logs);
  app.route('/api/stats', stats);
  app.route('/api/settings', settingsRoutes);

  // ── Error handler ──
  app.onError((err, c) => {
    if (err instanceof ValidationError) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
            status: 422,
            details: err.errors,
          },
        },
        422,
      );
    }
    if (err instanceof HTTPException) {
      return c.json(
        { ok: false, error: { code: 'HTTP_ERROR', message: err.message, status: err.status } },
        err.status
      );
    }
    console.error('[API] Unhandled error:', err);
    return c.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', status: 500 } },
      500
    );
  });

  // ── 404 handler ──
  app.notFound((c) => {
    return c.json(
      { ok: false, error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found`, status: 404 } },
      404
    );
  });

  return app;
}

module.exports = { createApp };
