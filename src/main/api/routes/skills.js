'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');
const { parseSkillMd, serializeSkillMd, validateSkillMd } = require('../../skill-format');

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
  version: { type: 'string' },
  allowedTools: { type: 'object' },
  hooks: { type: 'object' },
};

const updateBodySchema = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: 'string', maxLength: 2000 },
  content: { type: 'string', minLength: 1 },
  tags: { type: 'object' },
  version: { type: 'string' },
  allowedTools: { type: 'object' },
  hooks: { type: 'object' },
};

const importBodySchema = {
  content: { type: 'string', required: true, minLength: 1 },
  overwrite: { type: 'boolean' },
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

// ── Import / Export ──

/**
 * POST /skills/import — Import a skill from SKILL.md content.
 */
skills.post('/import', validateRequest({ body: importBodySchema }), async (c) => {
  const repo = c.get('repos').skills;
  const { content, overwrite } = c.get('validatedBody');

  let frontmatter, body;
  try {
    ({ frontmatter, body } = parseSkillMd(content));
  } catch (err) {
    return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err.message } }, 400);
  }

  const existing = repo.getByName(frontmatter.name);
  if (existing && !overwrite) {
    return c.json({ ok: false, error: { code: 'CONFLICT', message: `Skill "${frontmatter.name}" already exists. Set overwrite=true to replace.` } }, 409);
  }

  const skillData = {
    name: frontmatter.name,
    description: frontmatter.description,
    content: body,
    version: frontmatter.version,
    allowedTools: frontmatter['allowed-tools'] || [],
    hooks: frontmatter.hooks || {},
    tags: [],
  };

  const skill = existing
    ? repo.update(existing.id, skillData)
    : repo.create(skillData);

  return c.json({ ok: true, data: skill }, existing ? 200 : 201);
});

/**
 * POST /skills/validate — Validate SKILL.md content without importing.
 */
skills.post('/validate', async (c) => {
  const body = await c.req.json();
  if (!body.content || typeof body.content !== 'string') {
    return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'content is required (string)' } }, 400);
  }
  const result = validateSkillMd(body.content);
  return c.json({ ok: true, data: result });
});

/**
 * GET /skills/:id/export — Export a skill as SKILL.md content.
 */
skills.get('/:id/export', async (c) => {
  const repo = c.get('repos').skills;
  const skill = repo.getById(c.req.param('id'));
  if (!skill) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Skill not found' } }, 404);

  const md = serializeSkillMd({
    name: skill.name,
    version: skill.version || '1.0.0',
    description: skill.description || '',
    allowedTools: skill.allowedTools,
    hooks: skill.hooks,
    body: skill.content,
  });

  return c.json({ ok: true, data: { id: skill.id, name: skill.name, content: md } });
});

module.exports = skills;
