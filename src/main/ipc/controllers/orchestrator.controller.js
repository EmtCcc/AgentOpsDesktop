'use strict';

const { IpcError } = require('../errors');
const { paginate } = require('../pagination');

/**
 * Orchestrator IPC controller.
 * Manages DAG lifecycle: create, start, pause, resume, cancel, progress.
 */

let orchestratorRepo = null;
let orchestrator = null;

// In-memory fallback for testing without DB
const dagStore = new Map();
let _nextId = 1;

const orchestratorController = {
  setRepository(repo) {
    orchestratorRepo = repo;
  },

  setOrchestrator(orch) {
    orchestrator = orch;
  },

  /** Expose for event wiring in bootstrapRoutes */
  get _orchestrator() { return orchestrator; },

  // ── DAG CRUD ──

  async list(_event, params = {}) {
    if (orchestratorRepo) {
      return orchestratorRepo.listDags(params);
    }
    const filter = params.status
      ? (d) => d.status === params.status
      : undefined;
    return paginate(dagStore, { ...params, filter });
  },

  async get(_event, { id }) {
    if (orchestratorRepo) {
      const full = orchestratorRepo.getDagFull(id);
      if (!full) throw IpcError.notFound('DAG', id);
      return full;
    }
    const dag = dagStore.get(id);
    if (!dag) throw IpcError.notFound('DAG', id);
    return dag;
  },

  async create(_event, definition) {
    if (!orchestrator) throw new Error('Orchestrator not initialized');

    try {
      const result = orchestrator.createDag(definition);
      return result;
    } catch (err) {
      throw new IpcError(err.message, 'INVALID_DAG', 400);
    }
  },

  // ── DAG lifecycle ──

  async start(_event, { id }) {
    if (!orchestrator) throw new Error('Orchestrator not initialized');

    try {
      await orchestrator.startDag(id);
      return { ok: true, dagId: id };
    } catch (err) {
      throw new IpcError(err.message, 'DAG_START_FAILED', 400);
    }
  },

  async pause(_event, { id }) {
    if (!orchestrator) throw new Error('Orchestrator not initialized');

    try {
      await orchestrator.pauseDag(id);
      return { ok: true, dagId: id };
    } catch (err) {
      throw new IpcError(err.message, 'DAG_PAUSE_FAILED', 400);
    }
  },

  async resume(_event, { id }) {
    if (!orchestrator) throw new Error('Orchestrator not initialized');

    try {
      await orchestrator.resumeDag(id);
      return { ok: true, dagId: id };
    } catch (err) {
      throw new IpcError(err.message, 'DAG_RESUME_FAILED', 400);
    }
  },

  async cancel(_event, { id }) {
    if (!orchestrator) throw new Error('Orchestrator not initialized');

    try {
      await orchestrator.cancelDag(id);
      return { ok: true, dagId: id };
    } catch (err) {
      throw new IpcError(err.message, 'DAG_CANCEL_FAILED', 400);
    }
  },

  async getProgress(_event, { id }) {
    if (!orchestrator) throw new Error('Orchestrator not initialized');

    const status = orchestrator.getDagStatus(id);
    if (!status) throw IpcError.notFound('DAG', id);
    return status.progress;
  },

  // ── Task operations ──

  async getTask(_event, { dagId, taskId }) {
    if (orchestratorRepo) {
      const task = orchestratorRepo.getTaskById(taskId);
      if (!task || task.dagId !== dagId) throw IpcError.notFound('DAG task', taskId);
      return task;
    }
    throw new Error('Repository not initialized');
  },

  async completeManualTask(_event, { dagId, taskId, output, success }) {
    if (!orchestrator) throw new Error('Orchestrator not initialized');

    const task = orchestratorRepo.getTaskById(taskId);
    if (!task) throw IpcError.notFound('DAG task', taskId);
    if (task.taskType !== 'manual') throw new IpcError('Task is not a manual task', 'INVALID_TASK_TYPE', 400);
    if (task.status !== 'running') throw new IpcError('Task is not in running state', 'INVALID_TASK_STATUS', 400);

    const status = success ? 'succeeded' : 'failed';
    await orchestrator._completeTask(dagId, taskId, status, output, success ? null : 'Manual task marked as failed');
    return { ok: true };
  },
};

orchestratorController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    status: { type: 'string', enum: ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'paused'] },
    sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'name', 'status'] },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    tasks: {
      type: 'array',
      required: true,
      validate: (v) => {
        if (!Array.isArray(v) || v.length === 0) return 'tasks must be a non-empty array';
        for (let i = 0; i < v.length; i++) {
          const t = v[i];
          if (!t.title || typeof t.title !== 'string') return `tasks[${i}].title is required`;
          if (t.taskType && !['agent', 'noop', 'manual'].includes(t.taskType)) return `tasks[${i}].taskType must be agent/noop/manual`;
        }
        return true;
      },
    },
    edges: { type: 'array' },
    maxParallel: { type: 'number', min: 1, max: 32 },
    retryMax: { type: 'number', min: 0, max: 10 },
    retryBackoffMs: { type: 'number', min: 100, max: 60000 },
    retryBackoffMult: { type: 'number', min: 1, max: 10 },
    retryMaxBackoffMs: { type: 'number', min: 1000, max: 300000 },
    onFailure: { type: 'string', enum: ['fail-fast', 'best-effort'] },
  },
  start: {
    id: { type: 'string', required: true },
  },
  pause: {
    id: { type: 'string', required: true },
  },
  resume: {
    id: { type: 'string', required: true },
  },
  cancel: {
    id: { type: 'string', required: true },
  },
  getProgress: {
    id: { type: 'string', required: true },
  },
  getTask: {
    dagId: { type: 'string', required: true },
    taskId: { type: 'string', required: true },
  },
  completeManualTask: {
    dagId: { type: 'string', required: true },
    taskId: { type: 'string', required: true },
    output: { type: 'object' },
    success: { type: 'boolean', required: true },
  },
};

module.exports = orchestratorController;
