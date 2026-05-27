'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * @param {import('better-sqlite3').Database} db
 */
function createGoalRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO goals (id, title, description, status, created_at, updated_at)
      VALUES (@id, @title, @description, @status, @created_at, @updated_at)
    `),
    update: db.prepare(`
      UPDATE goals
      SET title = @title, description = @description, status = @status, updated_at = @updated_at
      WHERE id = @id
    `),
    deleteById: db.prepare('DELETE FROM goals WHERE id = ?'),
    getById: db.prepare('SELECT * FROM goals WHERE id = ?'),
    list: db.prepare('SELECT * FROM goals ORDER BY created_at DESC'),
    listByStatus: db.prepare('SELECT * FROM goals WHERE status = ? ORDER BY created_at DESC'),
  };

  return {
    /**
     * Create a new goal.
     * @param {{ title: string, description?: string }} input
     * @returns {object}
     */
    create(input) {
      const now = new Date().toISOString();
      const row = {
        id: uuidv4(),
        title: input.title,
        description: input.description ?? null,
        status: 'active',
        created_at: now,
        updated_at: now,
      };
      stmts.insert.run(row);
      return row;
    },

    /**
     * Update an existing goal.
     * @param {string} id
     * @param {Partial<{ title: string, description: string, status: string }>} changes
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
     * Delete a goal. Cascades to tasks via FK constraint.
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
     * @param {string} [status]
     * @returns {object[]}
     */
    list(status) {
      if (status) return stmts.listByStatus.all(status);
      return stmts.list.all();
    },
  };
}

module.exports = { createGoalRepo };
