'use strict';

/**
 * Goal management controller.
 * In-memory store; will be replaced by SQLite in Phase 2.1.
 */

const { IpcError } = require('../errors');
const { paginate } = require('../pagination');

const goals = new Map();
let nextId = 1;

const goalController = {
  /**
   * List goals with pagination.
   * @param {Object} [params] - { offset, limit, sortBy, sortOrder, status }
   */
  async list(_event, params = {}) {
    const filter = params.status
      ? (g) => g.status === params.status
      : undefined;
    const result = paginate(goals, { ...params, filter });
    return result.items;
  },

  /**
   * Get a single goal by ID.
   * @param {string} id
   */
  async get(_event, { id }) {
    const goal = goals.get(id);
    if (!goal) throw IpcError.notFound('Goal', id);
    return goal;
  },

  async create(_event, goal) {
    const id = `goal-${nextId++}`;
    const record = {
      id,
      title: goal.title,
      description: goal.description || null,
      status: 'active',
      taskIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    goals.set(id, record);
    return record;
  },

  async update(_event, { id, updates }) {
    const existing = goals.get(id);
    if (!existing) throw IpcError.notFound('Goal', id);
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    goals.set(id, updated);
    return updated;
  },

  async delete(_event, { id }) {
    if (!goals.has(id)) throw IpcError.notFound('Goal', id);
    goals.delete(id);
    return { deleted: true, id };
  },
};

goalController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    status: { type: 'string', enum: ['active', 'completed', 'archived'] },
    sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'status'] },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    description: { type: 'string', maxLength: 5000 },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['title', 'description', 'status'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        if (v.title !== undefined && (typeof v.title !== 'string' || v.title.length === 0)) return 'title must be a non-empty string';
        if (v.status !== undefined && !['active', 'completed', 'archived'].includes(v.status)) return 'status must be active, completed, or archived';
        return true;
      },
    },
  },
  delete: {
    id: { type: 'string', required: true },
  },
};

goalController.store = goals;

module.exports = goalController;
