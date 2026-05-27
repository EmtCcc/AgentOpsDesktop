'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const settings = new Hono();

const updateBodySchema = {
  settings: { type: 'object', required: true },
};

/**
 * GET /settings — Get all settings.
 */
settings.get('/', async (c) => {
  const repo = c.get('repos').settings;
  const data = repo.getAll ? repo.getAll() : {};
  return c.json({ ok: true, data });
});

/**
 * PATCH /settings — Update settings.
 */
settings.patch('/', validateRequest({ body: updateBodySchema }), async (c) => {
  const repo = c.get('repos').settings;
  const body = c.get('validatedBody');
  const updated = repo.update ? repo.update(body) : body;
  return c.json({ ok: true, data: updated });
});

module.exports = settings;
