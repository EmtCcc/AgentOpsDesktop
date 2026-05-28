'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const skills = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
  tag: { type: 'string' },
  tags: { type: 'string' },
  search: { type: 'string' },
};

const createBodySchema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  description: { type: 'string', maxLength: 2000 },
  content: { type: 'string', required: true, minLength: 1 },
  tags: { type: 'object' },
};

const updateBodySchema = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: 'string', maxLength: 2000 },
  content: { type: 'string', minLength: 1 },
  tags: { type: 'object' },
};

/**
 * GET /skills — List skills (paginated, filterable by tag/search).
 */
skills.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').skills;
  const { offset, limit, tag, tags, search } = c.req.query();
  const params = {
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    tag,
    tags: tags ? tags.split(',').map((t) => t.trim()) : undefined,
    search,
  };
  const result = repo.list(params);
  return c.json({ ok: true, data: result });
});

/**
 * GET /skills/tags — List all unique tags.
 */
skills.get('/tags', async (c) => {
  const repo = c.get('repos').skills;
  const tags = repo.listTags();
  return c.json({ ok: true, data: tags });
});

/**
 * GET /skills/:id — Get a single skill.
 */
skills.get('/:id', async (c) => {
  const repo = c.get('repos').skills;
  const skill = repo.getById(c.req.param('id'));
  if (!skill) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Skill not found' } }, 404);
  return c.json({ ok: true, data: skill });
});

/**
 * POST /skills — Create a new skill.
 */
skills.post('/', validateRequest({ body: createBodySchema }), async (c) => {
  const repo = c.get('repos').skills;
  const body = c.get('validatedBody');
  // Prevent duplicate names
  const existing = repo.getByName(body.name);
  if (existing) return c.json({ ok: false, error: { code: 'CONFLICT', message: 'Skill name already exists' } }, 409);
  const skill = repo.create(body);
  return c.json({ ok: true, data: skill }, 201);
});

/**
 * PATCH /skills/:id — Update a skill.
 */
skills.patch('/:id', validateRequest({ body: updateBodySchema }), async (c) => {
  const repo = c.get('repos').skills;
  const body = c.get('validatedBody');
  const updated = repo.update(c.req.param('id'), body);
  if (!updated) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Skill not found' } }, 404);
  return c.json({ ok: true, data: updated });
});

/**
 * DELETE /skills/:id — Delete a skill.
 */
skills.delete('/:id', async (c) => {
  const repo = c.get('repos').skills;
  const deleted = repo.delete(c.req.param('id'));
  if (!deleted) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Skill not found' } }, 404);
  return c.json({ ok: true, data: { deleted: true, id: c.req.param('id') } });
});

module.exports = skills;
