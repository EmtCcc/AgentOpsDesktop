'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const schedules = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
};

const createBodySchema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  cronExpr: { type: 'string', required: true, minLength: 1 },
  goalId: { type: 'string' },
  agentId: { type: 'string' },
  taskTemplate: { type: 'object' },
  maxExecutions: { type: 'number' },
};

const updateBodySchema = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  cronExpr: { type: 'string', minLength: 1 },
  goalId: { type: 'string' },
  agentId: { type: 'string' },
  taskTemplate: { type: 'object' },
  maxExecutions: { type: 'number' },
  enabled: { type: 'boolean' },
};

/**
 * GET /schedules — List schedules (paginated).
 */
schedules.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').schedules;
  const { offset, limit } = c.req.query();
  const params = {
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  };
  const result = repo.list(params);
  return c.json({ ok: true, data: result.items, total: result.total });
});

/**
 * GET /schedules/:id — Get a single schedule.
 */
schedules.get('/:id', async (c) => {
  const repo = c.get('repos').schedules;
  const schedule = repo.getById(c.req.param('id'));
  if (!schedule) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } }, 404);
  return c.json({ ok: true, data: schedule });
});

/**
 * POST /schedules — Create a new schedule.
 */
schedules.post('/', validateRequest({ body: createBodySchema }), async (c) => {
  const repo = c.get('repos').schedules;
  const body = c.get('validatedBody');
  const { nextCronTime } = require('../../cron-parser');
  const nextRun = nextCronTime(body.cronExpr);
  const schedule = repo.create({ ...body, nextRunAt: nextRun.toISOString() });
  return c.json({ ok: true, data: schedule }, 201);
});

/**
 * PATCH /schedules/:id — Update a schedule.
 */
schedules.patch('/:id', validateRequest({ body: updateBodySchema }), async (c) => {
  const repo = c.get('repos').schedules;
  const body = c.get('validatedBody');
  const existing = repo.getById(c.req.param('id'));
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } }, 404);

  const updates = { ...body };
  if (updates.cronExpr && updates.cronExpr !== existing.cronExpr) {
    const { nextCronTime } = require('../../cron-parser');
    updates.nextRunAt = nextCronTime(updates.cronExpr).toISOString();
  }

  const updated = repo.update(c.req.param('id'), updates);
  return c.json({ ok: true, data: updated });
});

/**
 * DELETE /schedules/:id — Delete a schedule.
 */
schedules.delete('/:id', async (c) => {
  const repo = c.get('repos').schedules;
  const deleted = repo.delete(c.req.param('id'));
  if (!deleted) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } }, 404);
  return c.json({ ok: true, data: { deleted: true, id: c.req.param('id') } });
});

/**
 * POST /schedules/:id/pause — Disable a schedule.
 */
schedules.post('/:id/pause', async (c) => {
  const repo = c.get('repos').schedules;
  const existing = repo.getById(c.req.param('id'));
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } }, 404);
  const updated = repo.toggleEnabled(c.req.param('id'), false);
  return c.json({ ok: true, data: updated });
});

/**
 * POST /schedules/:id/resume — Enable a schedule and recalculate next_run_at.
 */
schedules.post('/:id/resume', async (c) => {
  const repo = c.get('repos').schedules;
  const existing = repo.getById(c.req.param('id'));
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } }, 404);
  const { nextCronTime } = require('../../cron-parser');
  const nextRun = nextCronTime(existing.cronExpr);
  repo.updateNextRun(c.req.param('id'), nextRun);
  const updated = repo.toggleEnabled(c.req.param('id'), true);
  return c.json({ ok: true, data: updated });
});

/**
 * GET /schedules/:id/logs — Get trigger logs for a schedule.
 */
schedules.get('/:id/logs', async (c) => {
  const repo = c.get('repos').schedules;
  const existing = repo.getById(c.req.param('id'));
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } }, 404);
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit'), 10) : 50;
  const logs = repo.listLogs(c.req.param('id'), limit);
  return c.json({ ok: true, data: logs });
});

module.exports = schedules;
