'use strict';

/**
 * Task management controller.
 * In-memory store; will be replaced by SQLite in Phase 2.1.
 * Maintains bidirectional link with goals via goalId.
 */

const { IpcError } = require('../errors');
const { paginate } = require('../pagination');
const goalController = require('./goal.controller');

const tasks = new Map();
let nextId = 1;

// ── Repository (injected) ──
let taskRepo = null;

const taskController = {
  /**
   * Set the repository for persistent storage.
   * @param {import('../../repositories/task.repository').TaskRepository} repo
   */
  setRepository(repo) {
    taskRepo = repo;
  },

  /**
   * List tasks with pagination.
   * Operators see only their own resources; admin/viewer see all.
   * @param {Object} [params] - { offset, limit, sortBy, sortOrder, status, goalId }
   */
  async list(event, params = {}) {
    const role = event?.session?.role;
    const ownerFilter = role === 'operator' ? role : null;
    if (taskRepo) {
      return taskRepo.list({ ...params, ownerRole: ownerFilter });
    }
    const filter = (t) => {
      if (params.status && t.status !== params.status) return false;
      if (params.goalId && t.goalId !== params.goalId) return false;
      if (ownerFilter && t.ownerRole && t.ownerRole !== ownerFilter) return false;
      return true;
    };
    return paginate(tasks, { ...params, filter });
  },

  /**
   * Get a single task by ID.
   * Operators can only access their own resources.
   * @param {string} id
   */
  async get(event, { id }) {
    const role = event?.session?.role;
    if (taskRepo) {
      const task = taskRepo.getById(id);
      if (!task) throw IpcError.notFound('Task', id);
      if (role === 'operator' && task.ownerRole && task.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      return task;
    }
    const task = tasks.get(id);
    if (!task) throw IpcError.notFound('Task', id);
    if (role === 'operator' && task.ownerRole && task.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    return task;
  },

  async create(event, task) {
    const ownerRole = event?.session?.role || 'operator';
    if (taskRepo) {
      return taskRepo.create({ ...task, ownerRole });
    }
    const id = `task-${nextId++}`;
    const record = {
      id,
      title: task.title,
      description: task.description || null,
      status: 'pending',
      goalId: task.goalId || null,
      assigneeAgentId: task.assigneeAgentId || null,
      ownerRole,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    tasks.set(id, record);

    // Link task to parent goal
    if (task.goalId) {
      const goalStore = goalController.store;
      const goal = goalStore.get(task.goalId);
      if (goal) {
        goal.taskIds = [...(goal.taskIds || []), id];
        goalStore.set(task.goalId, goal);
      }
    }

    return record;
  },

  async update(event, { id, updates }) {
    const role = event?.session?.role;
    if (taskRepo) {
      const existing = taskRepo.getById(id);
      if (!existing) throw IpcError.notFound('Task', id);
      if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      const updated = taskRepo.update(id, updates);
      return updated;
    }
    const existing = tasks.get(id);
    if (!existing) throw IpcError.notFound('Task', id);
    if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    tasks.set(id, updated);
    return updated;
  },

  async delete(event, { id }) {
    const role = event?.session?.role;
    if (taskRepo) {
      const existing = taskRepo.getById(id);
      if (!existing) throw IpcError.notFound('Task', id);
      if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      taskRepo.delete(id);
      return { deleted: true, id };
    }
    if (!tasks.has(id)) throw IpcError.notFound('Task', id);
    const existing = tasks.get(id);
    if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    tasks.delete(id);
    return { deleted: true, id };
  },

  async remove(event, { id }) {
    const role = event?.session?.role;
    if (taskRepo) {
      const existing = taskRepo.getById(id);
      if (!existing) throw IpcError.notFound('Task', id);
      if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      taskRepo.delete(id);
      return { deleted: true, id };
    }
    if (!tasks.has(id)) throw IpcError.notFound('Task', id);
    const existing = tasks.get(id);
    if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    tasks.delete(id);
    return { deleted: true, id };
  },
};

taskController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    status: { type: 'string', enum: ['pending', 'assigned', 'running', 'done', 'failed', 'blocked'] },
    goalId: { type: 'string' },
    squadId: { type: 'string' },
    sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'status'] },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    description: { type: 'string', maxLength: 5000 },
    goalId: { type: 'string' },
    assigneeAgentId: { type: 'string' },
    squadId: { type: 'string' },
    dependsOn: { type: 'object' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['title', 'description', 'status', 'goalId', 'assigneeAgentId', 'squadId', 'output', 'dependsOn'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        if (v.title !== undefined && (typeof v.title !== 'string' || v.title.length === 0)) return 'title must be a non-empty string';
        if (v.status !== undefined && !['pending', 'assigned', 'running', 'done', 'failed', 'blocked'].includes(v.status)) return 'status must be pending, assigned, running, done, failed, or blocked';
        return true;
      },
    },
  },
  delete: {
    id: { type: 'string', required: true },
  },
  remove: {
    id: { type: 'string', required: true },
  },
};

taskController.store = tasks;

module.exports = taskController;
