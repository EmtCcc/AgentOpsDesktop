'use strict';

/**
 * Repository for task log operations against SQLite.
 * Task logs are append-only.
 */
class TaskLogRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO task_logs (task_id, stream, content, timestamp)
        VALUES (@taskId, @stream, @content, @timestamp)
      `),
      listByTask: this.db.prepare(`
        SELECT * FROM task_logs WHERE task_id = @taskId ORDER BY id ASC
      `),
      listByTaskLimited: this.db.prepare(`
        SELECT * FROM task_logs WHERE task_id = @taskId ORDER BY id DESC LIMIT @limit
      `),
      deleteByTask: this.db.prepare('DELETE FROM task_logs WHERE task_id = @taskId'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      taskId: row.task_id,
      stream: row.stream,
      content: row.content,
      timestamp: new Date(row.timestamp).getTime(),
    };
  }

  append(taskId, stream, content) {
    const params = {
      taskId,
      stream,
      content,
      timestamp: new Date().toISOString(),
    };
    const result = this._stmts.insert.run(params);
    return {
      id: result.lastInsertRowid,
      taskId,
      stream,
      content,
      timestamp: new Date(params.timestamp).getTime(),
    };
  }

  listByTask(taskId, limit) {
    if (limit) {
      return this._stmts.listByTaskLimited.all({ taskId, limit }).reverse().map((r) => this._toRecord(r));
    }
    return this._stmts.listByTask.all({ taskId }).map((r) => this._toRecord(r));
  }

  deleteByTask(taskId) {
    const result = this._stmts.deleteByTask.run({ taskId });
    return result.changes;
  }
}

module.exports = { TaskLogRepository };
