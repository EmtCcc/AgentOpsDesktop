'use strict';

/**
 * Goal management controller.
 * In-memory store; will be replaced by SQLite in Phase 2.1.
 */

const goals = new Map();
let nextId = 1;

const goalController = {
  async list() {
    return Array.from(goals.values());
  },

  async create(_event, goal) {
    const id = `goal-${nextId++}`;
    const record = { id, status: 'active', createdAt: Date.now(), taskIds: [], ...goal };
    goals.set(id, record);
    return record;
  },

  async update(_event, { id, updates }) {
    const existing = goals.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    goals.set(id, updated);
    return updated;
  },

  async delete(_event, id) {
    return goals.delete(id);
  },
};

goalController.schemas = {
  create: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    description: { type: 'string', maxLength: 5000 },
  },
  update: {
    id: { type: 'string', required: true },
    updates: { type: 'object', required: true },
  },
};

module.exports = goalController;
