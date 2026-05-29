'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const goals = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
  status: { type: 'string', enum: ['active', 'completed', 'archived'] },
  squadId: { type: 'string' },
  sortBy: { type: 'string', enum: ['title', 'status', 'createdAt', 'updatedAt'] },
  sortOrder: { type: 'string', enum: ['asc', 'desc'] },
};

const createBodySchema = {
  title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
  description: { type: 'string', maxLength: 5000 },
  squadId: { type: 'string' },
};

const updateBodySchema = {
  title: { type: 'string', minLength: 1, maxLength: 500 },
  description: { type: 'string', maxLength: 5000 },
  status: { type: 'string', enum: ['active', 'completed', 'archived'] },
  squadId: { type: 'string' },
};

/**
 * GET /goals — List goals (paginated).
 */
goals.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').goals;
  const { offset, limit, status, squadId, sortBy, sortOrder } = c.req.query();
  const params = {
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    status,
    squadId,
    sortBy,
    sortOrder,
  };
  const result = repo.list(params);
  return c.json({ ok: true, data: result.items || result });
});

/**
 * GET /goals/:id — Get a single goal.
 */
goals.get('/:id', async (c) => {
  const repo = c.get('repos').goals;
  const goal = repo.getById(c.req.param('id'));
  if (!goal) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
  return c.json({ ok: true, data: goal });
});

/**
 * POST /goals — Create a new goal.
 */
goals.post('/', validateRequest({ body: createBodySchema }), async (c) => {
  const repo = c.get('repos').goals;
  const body = c.get('validatedBody');
  const goal = repo.create(body);
  return c.json({ ok: true, data: goal }, 201);
});

/**
 * PATCH /goals/:id — Update a goal.
 */
goals.patch('/:id', validateRequest({ body: updateBodySchema }), async (c) => {
  const repo = c.get('repos').goals;
  const body = c.get('validatedBody');
  const updated = repo.update(c.req.param('id'), body);
  if (!updated) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
  return c.json({ ok: true, data: updated });
});

/**
 * DELETE /goals/:id — Delete a goal.
 */
goals.delete('/:id', async (c) => {
  const repo = c.get('repos').goals;
  const deleted = repo.delete(c.req.param('id'));
  if (!deleted) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
  return c.json({ ok: true, data: { deleted: true, id: c.req.param('id') } });
});

module.exports = goals;
