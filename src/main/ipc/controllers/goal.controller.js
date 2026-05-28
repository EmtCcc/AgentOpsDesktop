'use strict';

/**
 * Goal management controller.
 * In-memory store; will be replaced by SQLite in Phase 2.1.
 */

const { IpcError } = require('../errors');
const { paginate } = require('../pagination');

const goals = new Map();
let nextId = 1;

// ── Repository (injected) ──
let goalRepo = null;

const goalController = {
  /**
   * Set the repository for persistent storage.
   * @param {import('../../repositories/goal.repository').GoalRepository} repo
   */
  setRepository(repo) {
    goalRepo = repo;
  },

  /**
   * List goals with pagination.
   * Operators see only their own resources; admin/viewer see all.
   * @param {Object} [params] - { offset, limit, sortBy, sortOrder, status }
   */
  async list(event, params = {}) {
    const role = event?.session?.role;
    const ownerFilter = role === 'operator' ? role : null;
    if (goalRepo) {
      return goalRepo.list({ ...params, ownerRole: ownerFilter });
    }
    const filter = (g) => {
      if (params.status && g.status !== params.status) return false;
      if (ownerFilter && g.ownerRole && g.ownerRole !== ownerFilter) return false;
      return true;
    };
    return paginate(goals, { ...params, filter });
  },

  /**
   * Get a single goal by ID.
   * Operators can only access their own resources.
   * @param {string} id
   */
  async get(event, { id }) {
    const role = event?.session?.role;
    if (goalRepo) {
      const goal = goalRepo.getById(id);
      if (!goal) throw IpcError.notFound('Goal', id);
      if (role === 'operator' && goal.ownerRole && goal.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      return goal;
    }
    const goal = goals.get(id);
    if (!goal) throw IpcError.notFound('Goal', id);
    if (role === 'operator' && goal.ownerRole && goal.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    return goal;
  },

  async create(event, goal) {
    const ownerRole = event?.session?.role || 'operator';
    if (goalRepo) {
      return goalRepo.create({ ...goal, ownerRole });
    }
    const id = `goal-${nextId++}`;
    const record = {
      id,
      title: goal.title,
      description: goal.description || null,
      status: 'active',
      taskIds: [],
      ownerRole,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    goals.set(id, record);
    return record;
  },

  async update(event, { id, updates }) {
    const role = event?.session?.role;
    if (goalRepo) {
      const existing = goalRepo.getById(id);
      if (!existing) throw IpcError.notFound('Goal', id);
      if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      const updated = goalRepo.update(id, updates);
      return updated;
    }
    const existing = goals.get(id);
    if (!existing) throw IpcError.notFound('Goal', id);
    if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    goals.set(id, updated);
    return updated;
  },

  async delete(event, { id }) {
    const role = event?.session?.role;
    if (goalRepo) {
      const existing = goalRepo.getById(id);
      if (!existing) throw IpcError.notFound('Goal', id);
      if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      goalRepo.delete(id);
      return { deleted: true, id };
    }
    if (!goals.has(id)) throw IpcError.notFound('Goal', id);
    const existing = goals.get(id);
    if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
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
