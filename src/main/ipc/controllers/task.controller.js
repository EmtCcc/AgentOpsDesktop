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

const taskController = {
  /**
   * List tasks with pagination.
   * @param {Object} [params] - { offset, limit, sortBy, sortOrder, status, goalId }
   */
  async list(_event, params = {}) {
    const filter = (t) => {
      if (params.status && t.status !== params.status) return false;
      if (params.goalId && t.goalId !== params.goalId) return false;
      return true;
    };
    return paginate(tasks, { ...params, filter });
  },

  /**
   * Get a single task by ID.
   * @param {string} id
   */
  async get(_event, { id }) {
    const task = tasks.get(id);
    if (!task) throw IpcError.notFound('Task', id);
    return task;
  },

  async create(_event, task) {
    const id = `task-${nextId++}`;
    const record = {
      id,
      title: task.title,
      description: task.description || null,
      status: 'pending',
      goalId: task.goalId || null,
      assigneeAgentId: task.assigneeAgentId || null,
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

  async update(_event, { id, updates }) {
    const existing = tasks.get(id);
    if (!existing) throw IpcError.notFound('Task', id);
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    tasks.set(id, updated);
    return updated;
  },

  async delete(_event, { id }) {
    if (!tasks.has(id)) throw IpcError.notFound('Task', id);
    tasks.delete(id);
    return { deleted: true, id };
  },

  async remove(_event, { id }) {
    if (!tasks.has(id)) throw IpcError.notFound('Task', id);
    tasks.delete(id);
    return { deleted: true, id };
  },
};

taskController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    status: { type: 'string', enum: ['pending', 'running', 'done', 'failed'] },
    goalId: { type: 'string' },
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
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['title', 'description', 'status', 'goalId', 'assigneeAgentId'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        if (v.title !== undefined && (typeof v.title !== 'string' || v.title.length === 0)) return 'title must be a non-empty string';
        if (v.status !== undefined && !['pending', 'running', 'done', 'failed'].includes(v.status)) return 'status must be pending, running, done, or failed';
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
