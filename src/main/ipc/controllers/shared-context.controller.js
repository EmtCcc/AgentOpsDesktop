'use strict';

const { IpcError } = require('../errors');

/**
 * Shared context (blackboard) IPC controller.
 * Allows DAG agents to read/write shared key-value context isolated by dag_id.
 */

let sharedContextRepo = null;

const sharedContextController = {
  setRepository(repo) {
    sharedContextRepo = repo;
  },

  async set(_event, { dagId, key, value, updatedBy }) {
    if (!sharedContextRepo) throw new Error('SharedContext repository not initialized');
    return sharedContextRepo.set(dagId, key, value, updatedBy);
  },

  async get(_event, { dagId, key }) {
    if (!sharedContextRepo) throw new Error('SharedContext repository not initialized');
    const entry = sharedContextRepo.get(dagId, key);
    if (!entry) throw IpcError.notFound('SharedContext key', `${dagId}/${key}`);
    return entry;
  },

  async getMany(_event, { dagId, keys }) {
    if (!sharedContextRepo) throw new Error('SharedContext repository not initialized');
    return sharedContextRepo.getMany(dagId, keys);
  },

  async list(_event, { dagId }) {
    if (!sharedContextRepo) throw new Error('SharedContext repository not initialized');
    return sharedContextRepo.list(dagId);
  },

  async delete(_event, { dagId, key }) {
    if (!sharedContextRepo) throw new Error('SharedContext repository not initialized');
    const deleted = sharedContextRepo.delete(dagId, key);
    if (!deleted) throw IpcError.notFound('SharedContext key', `${dagId}/${key}`);
    return { ok: true };
  },

  schemas: {
    set: {
      dagId: { type: 'string', required: true },
      key: { type: 'string', required: true },
      value: { required: true },
      updatedBy: { type: 'string' },
    },
    get: {
      dagId: { type: 'string', required: true },
      key: { type: 'string', required: true },
    },
    getMany: {
      dagId: { type: 'string', required: true },
      keys: { type: 'array', required: true },
    },
    list: {
      dagId: { type: 'string', required: true },
    },
    delete: {
      dagId: { type: 'string', required: true },
      key: { type: 'string', required: true },
    },
  },
};

module.exports = sharedContextController;
