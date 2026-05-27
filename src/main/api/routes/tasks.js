'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const tasks = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
  status: { type: 'string', enum: ['pending', 'assigned', 'running', 'done', 'failed', 'blocked'] },
  goalId: { type: 'string' },
  sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'status'] },
  sortOrder: { type: 'string', enum: ['asc', 'desc'] },
};

const createBodySchema = {
  title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
  description: { type: 'string', maxLength: 5000 },
  goalId: { type: 'string' },
  assigneeAgentId: { type: 'string' },
};

const updateBodySchema = {
  title: { type: 'string', minLength: 1, maxLength: 500 },
  description: { type: 'string', maxLength: 5000 },
  status: { type: 'string', enum: ['pending', 'assigned', 'running', 'done', 'failed', 'blocked'] },
  goalId: { type: 'string' },
  assigneeAgentId: { type: 'string' },
};

/**
 * GET /tasks — List tasks (paginated).
 */
tasks.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').tasks;
  const { offset, limit, status, goalId, sortBy, sortOrder } = c.req.query();
  const params = {
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    status,
    goalId,
    sortBy,
    sortOrder,
  };
  const result = repo.list(params);
  return c.json({ ok: true, data: result.items || result });
});

/**
 * GET /tasks/:id — Get a single task.
 */
tasks.get('/:id', async (c) => {
  const repo = c.get('repos').tasks;
  const task = repo.getById(c.req.param('id'));
  if (!task) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  return c.json({ ok: true, data: task });
});

/**
 * POST /tasks — Create a new task.
 */
tasks.post('/', validateRequest({ body: createBodySchema }), async (c) => {
  const repo = c.get('repos').tasks;
  const body = c.get('validatedBody');
  const task = repo.create(body);
  return c.json({ ok: true, data: task }, 201);
});

/**
 * PATCH /tasks/:id — Update a task.
 */
tasks.patch('/:id', validateRequest({ body: updateBodySchema }), async (c) => {
  const repo = c.get('repos').tasks;
  const body = c.get('validatedBody');
  const updated = repo.update(c.req.param('id'), body);
  if (!updated) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  return c.json({ ok: true, data: updated });
});

/**
 * DELETE /tasks/:id — Delete a task.
 */
tasks.delete('/:id', async (c) => {
  const repo = c.get('repos').tasks;
  const deleted = repo.delete(c.req.param('id'));
  if (!deleted) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  return c.json({ ok: true, data: { deleted: true, id: c.req.param('id') } });
});

module.exports = tasks;
