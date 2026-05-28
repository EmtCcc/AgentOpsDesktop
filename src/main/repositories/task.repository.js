'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for task CRUD operations against SQLite.
 */
class TaskRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO tasks (id, goal_id, agent_id, title, description, status, output_summary, owner_role, started_at, completed_at, created_at, updated_at)
        VALUES (@id, @goalId, @agentId, @title, @description, @status, @outputSummary, @ownerRole, @startedAt, @completedAt, @createdAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE tasks
        SET goal_id = @goalId, agent_id = @agentId, title = @title, description = @description,
            status = @status, output_summary = @outputSummary, started_at = @startedAt,
            completed_at = @completedAt, updated_at = @updatedAt
        WHERE id = @id
      `),
      delete: this.db.prepare('DELETE FROM tasks WHERE id = @id'),
      getById: this.db.prepare('SELECT * FROM tasks WHERE id = @id'),
      list: this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC'),
      listByGoal: this.db.prepare('SELECT * FROM tasks WHERE goal_id = @goalId ORDER BY created_at DESC'),
      listByStatus: this.db.prepare('SELECT * FROM tasks WHERE status = @status ORDER BY created_at DESC'),
      listByGoalAndStatus: this.db.prepare('SELECT * FROM tasks WHERE goal_id = @goalId AND status = @status ORDER BY created_at DESC'),
      listByOwner: this.db.prepare('SELECT * FROM tasks WHERE owner_role = @ownerRole ORDER BY created_at DESC'),
      listByOwnerAndStatus: this.db.prepare('SELECT * FROM tasks WHERE owner_role = @ownerRole AND status = @status ORDER BY created_at DESC'),
      listByOwnerAndGoal: this.db.prepare('SELECT * FROM tasks WHERE owner_role = @ownerRole AND goal_id = @goalId ORDER BY created_at DESC'),
      listByOwnerAndGoalAndStatus: this.db.prepare('SELECT * FROM tasks WHERE owner_role = @ownerRole AND goal_id = @goalId AND status = @status ORDER BY created_at DESC'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      goalId: row.goal_id,
      agentId: row.agent_id,
      title: row.title,
      description: row.description,
      status: row.status,
      outputSummary: row.output_summary,
      ownerRole: row.owner_role || null,
      startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _toDbParams(task) {
    const now = new Date().toISOString();
    return {
      id: task.id || randomUUID(),
      goalId: task.goalId || null,
      agentId: task.agentId || null,
      title: task.title,
      description: task.description || null,
      status: task.status || 'pending',
      outputSummary: task.outputSummary || null,
      ownerRole: task.ownerRole || null,
      startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
      completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
      createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : now,
      updatedAt: now,
    };
  }

  create(task) {
    const params = this._toDbParams(task);
    this._stmts.insert.run(params);
    return this.getById(params.id);
  }

  update(id, updates) {
    const existing = this._stmts.getById.get({ id });
    if (!existing) return null;

    const merged = { ...this._toRecord(existing), ...updates, id };

    // Auto-set timestamps on status transitions
    if (updates.status === 'running' && !merged.startedAt) {
      merged.startedAt = Date.now();
    }
    if (updates.status === 'done' || updates.status === 'failed') {
      merged.completedAt = Date.now();
    }

    const params = this._toDbParams(merged);
    this._stmts.update.run(params);
    return this._toRecord(this._stmts.getById.get({ id }));
  }

  delete(id) {
    const result = this._stmts.delete.run({ id });
    return result.changes > 0;
  }

  getById(id) {
    const row = this._stmts.getById.get({ id });
    return this._toRecord(row);
  }

  list(params = {}) {
    const { offset = 0, limit = 20, status, goalId, ownerRole } = params;

    let rows;
    if (ownerRole && goalId && status) {
      rows = this._stmts.listByOwnerAndGoalAndStatus.all({ ownerRole, goalId, status });
    } else if (ownerRole && goalId) {
      rows = this._stmts.listByOwnerAndGoal.all({ ownerRole, goalId });
    } else if (ownerRole && status) {
      rows = this._stmts.listByOwnerAndStatus.all({ ownerRole, status });
    } else if (ownerRole) {
      rows = this._stmts.listByOwner.all({ ownerRole });
    } else if (goalId && status) {
      rows = this._stmts.listByGoalAndStatus.all({ goalId, status });
    } else if (goalId) {
      rows = this._stmts.listByGoal.all({ goalId });
    } else if (status) {
      rows = this._stmts.listByStatus.all({ status });
    } else {
      rows = this._stmts.list.all();
    }

    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._toRecord(r));

    return { items, total, offset, limit, hasMore: offset + limit < total };
  }
}

module.exports = { TaskRepository };
