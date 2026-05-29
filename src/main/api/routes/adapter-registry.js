'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const registry = new Hono();

const searchQuerySchema = {
  q: { type: 'string', required: true, minLength: 1 },
  remote: { type: 'boolean' },
  limit: { type: 'number', min: 1, max: 100 },
};

const installBodySchema = {
  name: { type: 'string', required: true, minLength: 1 },
  version: { type: 'string' },
  autoLoad: { type: 'boolean' },
};

const installFileBodySchema = {
  filePath: { type: 'string', required: true },
  name: { type: 'string' },
  autoLoad: { type: 'boolean' },
};

const uninstallBodySchema = {
  name: { type: 'string', required: true },
  removeFiles: { type: 'boolean' },
};

const updateBodySchema = {
  name: { type: 'string', required: true },
  version: { type: 'string' },
};

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
  source: { type: 'string' },
};

// Search for adapters (local + remote)
registry.get('/search', validateRequest({ query: searchQuerySchema }), async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const { q, remote, limit } = c.req.query();
  const result = await service.search(q, {
    remote: remote !== undefined ? remote === 'true' : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });
  return c.json({ ok: true, data: result });
});

// List installed packages
registry.get('/installed', validateRequest({ query: listQuerySchema }), async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const { offset, limit, source } = c.req.query();
  const result = service.listInstalled({
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    source,
  });
  return c.json({ ok: true, data: result.items, total: result.total });
});

// Get featured adapters from remote registry
registry.get('/featured', async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const limit = c.req.query('limit');
  const result = await service.getFeatured({ limit: limit ? parseInt(limit, 10) : undefined });
  return c.json({ ok: true, data: result.items || [] });
});

// Check for updates on all installed registry adapters
registry.get('/updates', async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const result = await service.checkUpdates();
  return c.json({ ok: true, data: result });
});

// Scan local adapters directory for unregistered adapters
registry.get('/scan', async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const discovered = service.scanLocal();
  return c.json({ ok: true, data: discovered });
});

// Get installed package details
registry.get('/package/:name', async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const pkg = service.getPackage(c.req.param('name'));
  if (!pkg) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Package not found' } }, 404);
  return c.json({ ok: true, data: pkg });
});

// Install adapter from remote registry
registry.post('/install', validateRequest({ body: installBodySchema }), async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const body = c.get('validatedBody');
  try {
    const pkg = await service.install(body.name, { version: body.version, autoLoad: body.autoLoad });
    return c.json({ ok: true, data: pkg }, 201);
  } catch (err) {
    return c.json({ ok: false, error: { code: 'INSTALL_ERROR', message: err.message } }, 422);
  }
});

// Install adapter from local file
registry.post('/install-file', validateRequest({ body: installFileBodySchema }), async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const body = c.get('validatedBody');
  try {
    const pkg = await service.installFromFile(body.filePath, { name: body.name, autoLoad: body.autoLoad });
    return c.json({ ok: true, data: pkg }, 201);
  } catch (err) {
    return c.json({ ok: false, error: { code: 'INSTALL_ERROR', message: err.message } }, 422);
  }
});

// Register a locally discovered adapter
registry.post('/register-local', async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const body = await c.req.json();
  if (!body.discovered) return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'discovered is required' } }, 422);
  try {
    const pkg = service.registerLocal(body.discovered);
    return c.json({ ok: true, data: pkg }, 201);
  } catch (err) {
    return c.json({ ok: false, error: { code: 'REGISTER_ERROR', message: err.message } }, 422);
  }
});

// Uninstall adapter
registry.post('/uninstall', validateRequest({ body: uninstallBodySchema }), async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const body = c.get('validatedBody');
  try {
    const result = await service.uninstall(body.name, { removeFiles: body.removeFiles });
    return c.json({ ok: true, data: result });
  } catch (err) {
    return c.json({ ok: false, error: { code: 'UNINSTALL_ERROR', message: err.message } }, 422);
  }
});

// Update adapter
registry.post('/update', validateRequest({ body: updateBodySchema }), async (c) => {
  const service = c.get('adapterRegistryService');
  if (!service) return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Registry service not available' } }, 500);
  const body = c.get('validatedBody');
  try {
    const result = await service.update(body.name, { version: body.version });
    return c.json({ ok: true, data: result });
  } catch (err) {
    return c.json({ ok: false, error: { code: 'UPDATE_ERROR', message: err.message } }, 422);
  }
});

module.exports = registry;
