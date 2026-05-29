'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');
const { autoAssign, autoAssignPaperclipIssues } = require('../../auto-assign');
const { PaperclipClient } = require('../../paperclip-client');

const tasks = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
  status: { type: 'string', enum: ['pending', 'assigned', 'running', 'done', 'failed', 'blocked'] },
  goalId: { type: 'string' },
  squadId: { type: 'string' },
  sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'status'] },
  sortOrder: { type: 'string', enum: ['asc', 'desc'] },
};

const createBodySchema = {
  title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
  description: { type: 'string', maxLength: 5000 },
  goalId: { type: 'string' },
  assigneeAgentId: { type: 'string' },
  squadId: { type: 'string' },
  dependsOn: { type: 'object' },
};

const updateBodySchema = {
  title: { type: 'string', minLength: 1, maxLength: 500 },
  description: { type: 'string', maxLength: 5000 },
  status: { type: 'string', enum: ['pending', 'assigned', 'running', 'done', 'failed', 'blocked'] },
  goalId: { type: 'string' },
  assigneeAgentId: { type: 'string' },
  squadId: { type: 'string' },
  output: { type: 'object' },
  dependsOn: { type: 'object' },
};

/**
 * GET /tasks — List tasks (paginated).
 */
tasks.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').tasks;
  const { offset, limit, status, goalId, squadId, sortBy, sortOrder } = c.req.query();
  const params = {
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    status,
    goalId,
    squadId,
    sortBy,
    sortOrder,
  };
  const result = repo.list(params);
  return c.json({ ok: true, data: result.items || result });
});

/**
 * POST /tasks/auto-assign — Auto-assign unassigned pending tasks to best available agents.
 * Body: { limit?: number } — max tasks to assign (default: all)
 */
tasks.post('/auto-assign', async (c) => {
  const repos = c.get('repos');
  const taskRepo = repos.tasks;
  const agentRepo = repos.agents;

  if (!taskRepo || !agentRepo) {
    return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Repositories not available' } }, 500);
  }

  let body = {};
  try {
    body = await c.req.json();
  } catch {
    // empty body is fine
  }

  const limit = body.limit ? parseInt(body.limit, 10) : undefined;
  const result = autoAssign(taskRepo, agentRepo, { limit });

  return c.json({
    ok: true,
    data: {
      assigned: result.assigned,
      skipped: result.skipped,
      summary: {
        assignedCount: result.assigned.length,
        skippedCount: result.skipped.length,
      },
    },
  });
});

/**
 * POST /tasks/auto-assign-paperclip — Auto-assign unassigned Paperclip issues to best available agents.
 * Body: { limit?: number, baseUrl?: string, issuesDir?: string } — max issues to assign (default: all)
 */
tasks.post('/auto-assign-paperclip', async (c) => {
  const repos = c.get('repos');
  const agentRepo = repos.agents;

  if (!agentRepo) {
    return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Agent repository not available' } }, 500);
  }

  let body = {};
  try {
    body = await c.req.json();
  } catch {
    // empty body is fine
  }

  const paperclip = new PaperclipClient({
    baseUrl: body.baseUrl,
    issuesDir: body.issuesDir,
  });

  const limit = body.limit ? parseInt(body.limit, 10) : undefined;
  const result = await autoAssignPaperclipIssues(paperclip, agentRepo, { limit });

  return c.json({
    ok: true,
    data: {
      assigned: result.assigned,
      skipped: result.skipped,
      summary: {
        assignedCount: result.assigned.length,
        skippedCount: result.skipped.length,
      },
    },
  });
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

/**
 * GET /tasks/:id/upstream — Get upstream task outputs for handoff context.
 */
tasks.get('/:id/upstream', async (c) => {
  const repo = c.get('repos').tasks;
  const task = repo.getById(c.req.param('id'));
  if (!task) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  const upstream = repo.getUpstreamOutputs(c.req.param('id'));
  return c.json({ ok: true, data: upstream });
});

/**
 * GET /tasks/:id/handoffs — List handoffs involving this task.
 */
tasks.get('/:id/handoffs', async (c) => {
  const repo = c.get('repos').tasks;
  const task = repo.getById(c.req.param('id'));
  if (!task) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  const outgoing = repo.listHandoffsBySource(c.req.param('id'));
  const incoming = repo.listHandoffsByTarget(c.req.param('id'));
  return c.json({ ok: true, data: { outgoing, incoming } });
});

module.exports = tasks;
