'use strict';

/**
 * Task management controller — CRUD and status updates.
 *
 * Placeholder implementations. Real data layer will use
 * local SQLite via the Paperclip client adapter.
 */

/** @type {Map<string, object>} */
const tasks = new Map();

const taskController = {
  /**
   * Create a new task.
   */
  async create(_event, payload) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const task = {
      taskId,
      title: payload.title,
      description: payload.description || '',
      goalId: payload.goalId || null,
      status: 'todo',
      assigneeAgentId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tasks.set(taskId, task);
    return task;
  },

  /**
   * Get a task by ID.
   */
  async get(_event, payload) {
    const task = tasks.get(payload.taskId);
    if (!task) {
      throw new Error(`Task not found: ${payload.taskId}`);
    }
    return task;
  },

  /**
   * List all tasks, optionally filtered by goalId.
   */
  async list(_event, payload) {
    let results = Array.from(tasks.values());
    if (payload?.goalId) {
      results = results.filter(t => t.goalId === payload.goalId);
    }
    return results;
  },

  /**
   * Update task fields (status, assignee, metadata).
   */
  async update(_event, payload) {
    const task = tasks.get(payload.taskId);
    if (!task) {
      throw new Error(`Task not found: ${payload.taskId}`);
    }

    if (payload.status) task.status = payload.status;
    if (payload.assigneeAgentId !== undefined) task.assigneeAgentId = payload.assigneeAgentId;
    if (payload.metadata) task.metadata = { ...task.metadata, ...payload.metadata };
    task.updatedAt = Date.now();

    return task;
  },

  /**
   * Delete a task.
   */
  async remove(_event, payload) {
    if (!tasks.has(payload.taskId)) {
      throw new Error(`Task not found: ${payload.taskId}`);
    }
    tasks.delete(payload.taskId);
    return { deleted: true, taskId: payload.taskId };
  },
};

// Validation schemas
taskController.schemas = {
  create: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    description: { type: 'string', maxLength: 5000 },
    goalId: { type: 'string' },
  },
  get: {
    taskId: { type: 'string', required: true },
  },
  list: {
    goalId: { type: 'string' },
  },
  update: {
    taskId: { type: 'string', required: true },
    status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'blocked'] },
    assigneeAgentId: { type: 'string' },
    metadata: { type: 'object' },
  },
  remove: {
    taskId: { type: 'string', required: true },
  },
};

module.exports = taskController;
