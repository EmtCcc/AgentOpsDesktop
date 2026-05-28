'use strict';

const { IpcError } = require('../errors');

let adapterRepo = null;
let registry = null;

const adapterController = {
  setRepository(repo) {
    adapterRepo = repo;
  },

  setRegistry(reg) {
    registry = reg;
  },

  /** Expose registry for external wiring */
  _registry: null,

  async list(event, params = {}) {
    if (!adapterRepo) throw IpcError.internal('Adapter repository not initialized');
    return adapterRepo.list(params);
  },

  async get(event, { id }) {
    if (!adapterRepo) throw IpcError.internal('Adapter repository not initialized');
    const adapter = adapterRepo.getById(id);
    if (!adapter) throw IpcError.notFound('Adapter', id);
    return adapter;
  },

  async create(event, adapter) {
    if (!adapterRepo) throw IpcError.internal('Adapter repository not initialized');
    // Prevent duplicate types
    const existing = adapterRepo.getByType(adapter.type);
    if (existing) throw IpcError.conflict(`Adapter type already exists: ${adapter.type}`);
    return adapterRepo.create(adapter);
  },

  async update(event, { id, updates }) {
    if (!adapterRepo) throw IpcError.internal('Adapter repository not initialized');
    const existing = adapterRepo.getById(id);
    if (!existing) throw IpcError.notFound('Adapter', id);
    return adapterRepo.update(id, updates);
  },

  async delete(event, { id }) {
    if (!adapterRepo) throw IpcError.internal('Adapter repository not initialized');
    const existing = adapterRepo.getById(id);
    if (!existing) throw IpcError.notFound('Adapter', id);
    // Unload from registry if loaded
    if (registry) {
      await registry.unload(existing.type);
      registry.unregisterClass(existing.type);
    }
    adapterRepo.delete(id);
    return { deleted: true, id };
  },

  async load(event, { id }) {
    if (!adapterRepo) throw IpcError.internal('Adapter repository not initialized');
    if (!registry) throw IpcError.internal('Adapter registry not initialized');
    const config = adapterRepo.getById(id);
    if (!config) throw IpcError.notFound('Adapter', id);

    try {
      if (config.classPath && !registry.getClass(config.type)) {
        const AdapterClass = require(config.classPath);
        const Cls = AdapterClass.default || AdapterClass;
        registry.registerClass(config.type, Cls);
      }
      registry.load(config.type, config.config || {});
      return { loaded: true, type: config.type };
    } catch (err) {
      throw IpcError.internal(`Failed to load adapter: ${err.message}`);
    }
  },

  async unload(event, { id }) {
    if (!adapterRepo) throw IpcError.internal('Adapter repository not initialized');
    if (!registry) throw IpcError.internal('Adapter registry not initialized');
    const config = adapterRepo.getById(id);
    if (!config) throw IpcError.notFound('Adapter', id);
    await registry.unload(config.type);
    return { unloaded: true, type: config.type };
  },

  async listLoaded() {
    if (!registry) throw IpcError.internal('Adapter registry not initialized');
    return registry.listLoaded();
  },

  async healthCheck(event, { id }) {
    if (!adapterRepo) throw IpcError.internal('Adapter repository not initialized');
    if (!registry) throw IpcError.internal('Adapter registry not initialized');
    const config = adapterRepo.getById(id);
    if (!config) throw IpcError.notFound('Adapter', id);
    return registry.healthCheck(config.type);
  },
};

adapterController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    enabled: { type: 'boolean' },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    type: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    name: { type: 'string', maxLength: 200 },
    classPath: { type: 'string' },
    config: { type: 'object' },
    enabled: { type: 'boolean' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['name', 'classPath', 'config', 'enabled'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        return true;
      },
    },
  },
  delete: {
    id: { type: 'string', required: true },
  },
  load: {
    id: { type: 'string', required: true },
  },
  unload: {
    id: { type: 'string', required: true },
  },
  healthCheck: {
    id: { type: 'string', required: true },
  },
};

module.exports = adapterController;
