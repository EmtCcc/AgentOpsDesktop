'use strict';

/**
 * Task management controller.
 * In-memory store; will be replaced by SQLite in Phase 2.1.
 * Maintains bidirectional link with goals via goalId.
 */

const goalController = require('./goal.controller');

const tasks = new Map();
let nextId = 1;

const taskController = {
  async list(_event, { goalId } = {}) {
    const all = Array.from(tasks.values());
    if (goalId) return all.filter((t) => t.goalId === goalId);
    return all;
  },

  async get(_event, { id }) {
    return tasks.get(id) || null;
  },

  async create(_event, task) {
    const id = `task-${nextId++}`;
    const record = { id, status: 'pending', createdAt: Date.now(), ...task };
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
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    tasks.set(id, updated);
    return updated;
  },

  async delete(_event, id) {
    return tasks.delete(id);
  },
};

taskController.schemas = {
  create: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    description: { type: 'string', maxLength: 5000 },
    goalId: { type: 'string' },
    assigneeAgentId: { type: 'string' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: { type: 'object', required: true },
  },
};

taskController.store = tasks;

module.exports = taskController;
