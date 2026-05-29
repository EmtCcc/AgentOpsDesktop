'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const agents = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
  status: { type: 'string', enum: ['idle', 'running', 'paused', 'error'] },
  sortBy: { type: 'string', enum: ['name', 'status', 'createdAt', 'updatedAt'] },
  sortOrder: { type: 'string', enum: ['asc', 'desc'] },
};

const createBodySchema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  type: { type: 'string', enum: ['autonomous', 'supervised', 'manual'] },
  command: { type: 'string', maxLength: 1000 },
  execPath: { type: 'string', maxLength: 1000 },
  cwd: { type: 'string', maxLength: 500 },
};

const updateBodySchema = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  type: { type: 'string', enum: ['autonomous', 'supervised', 'manual'] },
  status: { type: 'string', enum: ['idle', 'running', 'paused', 'error'] },
  command: { type: 'string', maxLength: 1000 },
  execPath: { type: 'string', maxLength: 1000 },
  cwd: { type: 'string', maxLength: 500 },
};

/**
 * GET /agents — List agents (paginated).
 */
agents.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').agents;
  const { offset, limit, status, sortBy, sortOrder } = c.req.query();
  const params = {
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    status,
    sortBy,
    sortOrder,
  };
  const result = repo.list(params);
  return c.json({ ok: true, data: result.items || result });
});

/**
 * GET /agents/:id — Get a single agent.
 */
agents.get('/:id', async (c) => {
  const repo = c.get('repos').agents;
  const agent = repo.getById(c.req.param('id'));
  if (!agent) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  return c.json({ ok: true, data: agent });
});

/**
 * POST /agents — Create a new agent.
 */
agents.post('/', validateRequest({ body: createBodySchema }), async (c) => {
  const repo = c.get('repos').agents;
  const body = c.get('validatedBody');
  const agent = repo.create(body);
  return c.json({ ok: true, data: agent }, 201);
});

/**
 * PATCH /agents/:id — Update an agent.
 */
agents.patch('/:id', validateRequest({ body: updateBodySchema }), async (c) => {
  const repo = c.get('repos').agents;
  const body = c.get('validatedBody');
  const updated = repo.update(c.req.param('id'), body);
  if (!updated) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  return c.json({ ok: true, data: updated });
});

/**
 * DELETE /agents/:id — Delete an agent.
 */
agents.delete('/:id', async (c) => {
  const repo = c.get('repos').agents;
  const deleted = repo.delete(c.req.param('id'));
  if (!deleted) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
  return c.json({ ok: true, data: { deleted: true, id: c.req.param('id') } });
});

/**
 * POST /agents/:id/send-input — Send input to a running agent's stdin.
 */
agents.post('/:id/send-input', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  if (!body || typeof body.data !== 'string') {
    return c.json({ ok: false, error: { code: 'VALIDATION', message: 'data (string) is required' } }, 400);
  }
  const engine = c.get('agentEngine');
  if (!engine) {
    return c.json({ ok: false, error: { code: 'UNAVAILABLE', message: 'Agent engine not available' } }, 503);
  }
  try {
    await engine.sendInput(id, body.data);
    return c.json({ ok: true });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    return c.json({ ok: false, error: { code: 'ERROR', message: err.message } }, status);
  }
});

module.exports = agents;
