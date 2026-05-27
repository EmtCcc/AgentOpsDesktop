'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const logs = new Hono();

const listQuerySchema = {
  agentId: { type: 'string' },
  taskId: { type: 'string' },
  limit: { type: 'number', min: 1, max: 500 },
  offset: { type: 'number', min: 0 },
};

const appendBodySchema = {
  agentId: { type: 'string' },
  taskId: { type: 'string' },
  message: { type: 'string', required: true },
  level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
  stream: { type: 'string', enum: ['stdout', 'stderr'] },
};

/**
 * GET /logs — List log entries.
 */
logs.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').taskLogs;
  const { agentId, taskId, limit, offset } = c.req.query();
  const params = {
    agentId,
    taskId,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  };
  const entries = repo.list ? repo.list(params) : [];
  return c.json({ ok: true, data: entries });
});

/**
 * POST /logs — Append a log entry.
 */
logs.post('/', validateRequest({ body: appendBodySchema }), async (c) => {
  const repo = c.get('repos').taskLogs;
  const body = c.get('validatedBody');
  const entry = repo.append ? repo.append(body) : body;
  return c.json({ ok: true, data: entry }, 201);
});

module.exports = logs;
