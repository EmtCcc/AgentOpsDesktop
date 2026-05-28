'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const adapters = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
  enabled: { type: 'boolean' },
};

const createBodySchema = {
  type: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  name: { type: 'string', maxLength: 200 },
  classPath: { type: 'string' },
  config: { type: 'object' },
  enabled: { type: 'boolean' },
};

const updateBodySchema = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  classPath: { type: 'string' },
  config: { type: 'object' },
  enabled: { type: 'boolean' },
};

adapters.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').adapters;
  const { offset, limit, enabled } = c.req.query();
  const params = {
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    enabled: enabled !== undefined ? enabled === 'true' : undefined,
  };
  const result = repo.list(params);
  return c.json({ ok: true, data: result.items, total: result.total });
});

adapters.get('/loaded', async (c) => {
  const registry = c.get('adapterRegistry');
  if (!registry) return c.json({ ok: true, data: [] });
  return c.json({ ok: true, data: registry.listLoaded() });
});

adapters.get('/:id', async (c) => {
  const repo = c.get('repos').adapters;
  const adapter = repo.getById(c.req.param('id'));
  if (!adapter) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Adapter not found' } }, 404);
  return c.json({ ok: true, data: adapter });
});

adapters.post('/', validateRequest({ body: createBodySchema }), async (c) => {
  const repo = c.get('repos').adapters;
  const body = c.get('validatedBody');
  const existing = repo.getByType(body.type);
  if (existing) return c.json({ ok: false, error: { code: 'CONFLICT', message: `Adapter type already exists: ${body.type}` } }, 409);
  const adapter = repo.create(body);
  return c.json({ ok: true, data: adapter }, 201);
});

adapters.patch('/:id', validateRequest({ body: updateBodySchema }), async (c) => {
  const repo = c.get('repos').adapters;
  const body = c.get('validatedBody');
  const existing = repo.getById(c.req.param('id'));
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Adapter not found' } }, 404);
  const updated = repo.update(c.req.param('id'), body);
  return c.json({ ok: true, data: updated });
});

adapters.delete('/:id', async (c) => {
  const repo = c.get('repos').adapters;
  const registry = c.get('adapterRegistry');
  const existing = repo.getById(c.req.param('id'));
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Adapter not found' } }, 404);
  if (registry) {
    await registry.unload(existing.type);
    registry.unregisterClass(existing.type);
  }
  repo.delete(c.req.param('id'));
  return c.json({ ok: true, data: { deleted: true, id: c.req.param('id') } });
});

adapters.post('/:id/load', async (c) => {
  const repo = c.get('repos').adapters;
  const registry = c.get('adapterRegistry');
  if (!registry) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry not available' } }, 500);
  const config = repo.getById(c.req.param('id'));
  if (!config) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Adapter not found' } }, 404);
  try {
    if (config.classPath && !registry.getClass(config.type)) {
      const AdapterClass = require(config.classPath);
      const Cls = AdapterClass.default || AdapterClass;
      registry.registerClass(config.type, Cls);
    }
    registry.load(config.type, config.config || {});
    return c.json({ ok: true, data: { loaded: true, type: config.type } });
  } catch (err) {
    return c.json({ ok: false, error: { code: 'ADAPTER_ERROR', message: err.message } }, 422);
  }
});

adapters.post('/:id/unload', async (c) => {
  const repo = c.get('repos').adapters;
  const registry = c.get('adapterRegistry');
  if (!registry) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry not available' } }, 500);
  const config = repo.getById(c.req.param('id'));
  if (!config) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Adapter not found' } }, 404);
  await registry.unload(config.type);
  return c.json({ ok: true, data: { unloaded: true, type: config.type } });
});

adapters.post('/:id/health-check', async (c) => {
  const repo = c.get('repos').adapters;
  const registry = c.get('adapterRegistry');
  if (!registry) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry not available' } }, 500);
  const config = repo.getById(c.req.param('id'));
  if (!config) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Adapter not found' } }, 404);
  const result = await registry.healthCheck(config.type);
  return c.json({ ok: true, data: result });
});

module.exports = adapters;
