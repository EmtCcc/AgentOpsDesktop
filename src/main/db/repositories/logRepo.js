'use strict';

/**
 * @param {import('better-sqlite3').Database} db
 */
function createLogRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO task_logs (task_id, stream, content, timestamp)
      VALUES (@task_id, @stream, @content, @timestamp)
    `),
    getByTask: db.prepare(`
      SELECT * FROM task_logs
      WHERE task_id = ?
      ORDER BY id ASC
    `),
    getByTaskPaged: db.prepare(`
      SELECT * FROM task_logs
      WHERE task_id = ?
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `),
    deleteByTask: db.prepare('DELETE FROM task_logs WHERE task_id = ?'),
    countByTask: db.prepare('SELECT COUNT(*) as count FROM task_logs WHERE task_id = ?'),
  };

  return {
    /**
     * Append a log entry for a task.
     * @param {{ task_id: string, stream: 'stdout'|'stderr'|'system', content: string }} input
     * @returns {object} The inserted log row.
     */
    append(input) {
      const row = {
        task_id: input.task_id,
        stream: input.stream,
        content: input.content,
        timestamp: new Date().toISOString(),
      };
      const result = stmts.insert.run(row);
      return { id: result.lastInsertRowid, ...row };
    },

    /**
     * Get all logs for a task.
     * @param {string} taskId
     * @returns {object[]}
     */
    getByTask(taskId) {
      return stmts.getByTask.all(taskId);
    },

    /**
     * Get paginated logs for a task.
     * @param {string} taskId
     * @param {number} [offset=0]
     * @param {number} [limit=200]
     * @returns {object[]}
     */
    getByTaskPaged(taskId, offset = 0, limit = 200) {
      return stmts.getByTaskPaged.all(taskId, limit, offset);
    },

    /**
     * Clear all logs for a task.
     * @param {string} taskId
     * @returns {boolean}
     */
    clearByTask(taskId) {
      const result = stmts.deleteByTask.run(taskId);
      return result.changes > 0;
    },

    /**
     * Count log entries for a task.
     * @param {string} taskId
     * @returns {number}
     */
    countByTask(taskId) {
      return stmts.countByTask.get(taskId).count;
    },
  };
}

module.exports = { createLogRepo };
