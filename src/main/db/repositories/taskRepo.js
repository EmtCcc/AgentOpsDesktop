'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * @param {import('better-sqlite3').Database} db
 */
function createTaskRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO tasks (id, goal_id, agent_id, title, description, status, output_summary, started_at, completed_at, created_at, updated_at)
      VALUES (@id, @goal_id, @agent_id, @title, @description, @status, @output_summary, @started_at, @completed_at, @created_at, @updated_at)
    `),
    update: db.prepare(`
      UPDATE tasks
      SET goal_id = @goal_id, agent_id = @agent_id, title = @title, description = @description,
          status = @status, output_summary = @output_summary, started_at = @started_at,
          completed_at = @completed_at, updated_at = @updated_at
      WHERE id = @id
    `),
    deleteById: db.prepare('DELETE FROM tasks WHERE id = ?'),
    getById: db.prepare('SELECT * FROM tasks WHERE id = ?'),
    list: db.prepare('SELECT * FROM tasks ORDER BY created_at DESC'),
    listByGoal: db.prepare('SELECT * FROM tasks WHERE goal_id = ? ORDER BY created_at DESC'),
    listByAgent: db.prepare('SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC'),
    listByStatus: db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC'),
  };

  return {
    /**
     * Create a new task.
     * @param {{ goal_id: string, agent_id?: string, title: string, description?: string }} input
     * @returns {object}
     */
    create(input) {
      const now = new Date().toISOString();
      const row = {
        id: uuidv4(),
        goal_id: input.goal_id,
        agent_id: input.agent_id ?? null,
        title: input.title,
        description: input.description ?? null,
        status: 'pending',
        output_summary: null,
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      };
      stmts.insert.run(row);
      return row;
    },

    /**
     * Update an existing task.
     * @param {string} id
     * @param {Partial<{ goal_id: string, agent_id: string, title: string, description: string, status: string, output_summary: string, started_at: string, completed_at: string }>} changes
     * @returns {object|null}
     */
    update(id, changes) {
      const existing = stmts.getById.get(id);
      if (!existing) return null;

      const row = {
        ...existing,
        ...changes,
        id,
        updated_at: new Date().toISOString(),
      };
      stmts.update.run(row);
      return stmts.getById.get(id);
    },

    /**
     * Delete a task. Cascades to task_logs via FK constraint.
     * @param {string} id
     * @returns {boolean}
     */
    delete(id) {
      const result = stmts.deleteById.run(id);
      return result.changes > 0;
    },

    /**
     * @param {string} id
     * @returns {object|undefined}
     */
    getById(id) {
      return stmts.getById.get(id);
    },

    /**
     * List tasks with optional filters.
     * @param {{ goal_id?: string, agent_id?: string, status?: string }} [filters]
     * @returns {object[]}
     */
    list(filters) {
      if (filters?.goal_id) return stmts.listByGoal.all(filters.goal_id);
      if (filters?.agent_id) return stmts.listByAgent.all(filters.agent_id);
      if (filters?.status) return stmts.listByStatus.all(filters.status);
      return stmts.list.all();
    },
  };
}

module.exports = { createTaskRepo };
