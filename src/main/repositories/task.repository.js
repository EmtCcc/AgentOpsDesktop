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
        INSERT INTO tasks (id, goal_id, agent_id, squad_id, title, description, status, output_summary, output, depends_on, owner_role, started_at, completed_at, created_at, updated_at)
        VALUES (@id, @goalId, @agentId, @squadId, @title, @description, @status, @outputSummary, @output, @dependsOn, @ownerRole, @startedAt, @completedAt, @createdAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE tasks
        SET goal_id = @goalId, agent_id = @agentId, squad_id = @squadId, title = @title, description = @description,
            status = @status, output_summary = @outputSummary, output = @output, depends_on = @dependsOn,
            started_at = @startedAt, completed_at = @completedAt, updated_at = @updatedAt
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
      listBySquad: this.db.prepare('SELECT * FROM tasks WHERE squad_id = @squadId ORDER BY created_at DESC'),
      listBySquadAndStatus: this.db.prepare('SELECT * FROM tasks WHERE squad_id = @squadId AND status = @status ORDER BY created_at DESC'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      goalId: row.goal_id,
      agentId: row.agent_id,
      squadId: row.squad_id || null,
      title: row.title,
      description: row.description,
      status: row.status,
      outputSummary: row.output_summary,
      output: row.output ? JSON.parse(row.output) : null,
      dependsOn: row.depends_on ? JSON.parse(row.depends_on) : null,
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
      squadId: task.squadId || null,
      title: task.title,
      description: task.description || null,
      status: task.status || 'pending',
      outputSummary: task.outputSummary || null,
      output: task.output ? JSON.stringify(task.output) : null,
      dependsOn: task.dependsOn ? JSON.stringify(task.dependsOn) : null,
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
    const { offset = 0, limit = 20, status, goalId, ownerRole, squadId } = params;

    let rows;
    if (squadId && status) {
      rows = this._stmts.listBySquadAndStatus.all({ squadId, status });
    } else if (squadId) {
      rows = this._stmts.listBySquad.all({ squadId });
    } else if (ownerRole && goalId && status) {
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

  // ── Output / Handoff methods ──

  /**
   * Set structured output on a task.
   * @param {string} taskId
   * @param {Object} output - JSON-serializable output
   * @returns {Object} updated task
   */
  setOutput(taskId, output) {
    return this.update(taskId, { output });
  }

  /**
   * Get upstream outputs for a task based on depends_on.
   * @param {string} taskId
   * @returns {Array<{ taskId: string, output: Object }>}
   */
  getUpstreamOutputs(taskId) {
    const task = this.getById(taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) return [];

    const results = [];
    for (const depId of task.dependsOn) {
      const dep = this.getById(depId);
      if (dep && dep.output) {
        results.push({ taskId: depId, output: dep.output });
      }
    }
    return results;
  }

  /**
   * Create a handoff record between two tasks.
   */
  createHandoff(handoff) {
    const { randomUUID } = require('crypto');
    const id = handoff.id || randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO task_handoffs (id, source_task_id, target_task_id, status, output_json, created_at)
      VALUES (@id, @sourceTaskId, @targetTaskId, @status, @outputJson, @createdAt)
    `).run({
      id,
      sourceTaskId: handoff.sourceTaskId,
      targetTaskId: handoff.targetTaskId,
      status: handoff.status || 'pending',
      outputJson: handoff.output ? JSON.stringify(handoff.output) : null,
      createdAt: now,
    });
    return this.getHandoffById(id);
  }

  /**
   * Mark a handoff as delivered.
   */
  completeHandoff(handoffId, output) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE task_handoffs SET status = 'delivered', output_json = @outputJson, delivered_at = @deliveredAt
      WHERE id = @id
    `).run({
      id: handoffId,
      outputJson: output ? JSON.stringify(output) : null,
      deliveredAt: now,
    });
    return this.getHandoffById(handoffId);
  }

  /**
   * Mark a handoff as failed.
   */
  failHandoff(handoffId, error) {
    this.db.prepare(`
      UPDATE task_handoffs SET status = 'failed', error_message = @error WHERE id = @id
    `).run({ id: handoffId, error });
    return this.getHandoffById(handoffId);
  }

  getHandoffById(id) {
    const row = this.db.prepare('SELECT * FROM task_handoffs WHERE id = @id').get({ id });
    if (!row) return null;
    return {
      id: row.id,
      sourceTaskId: row.source_task_id,
      targetTaskId: row.target_task_id,
      status: row.status,
      output: row.output_json ? JSON.parse(row.output_json) : null,
      errorMessage: row.error_message,
      createdAt: new Date(row.created_at).getTime(),
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
    };
  }

  /**
   * List handoffs for a source task.
   */
  listHandoffsBySource(sourceTaskId) {
    return this.db.prepare('SELECT * FROM task_handoffs WHERE source_task_id = @sourceTaskId ORDER BY created_at')
      .all({ sourceTaskId })
      .map((row) => ({
        id: row.id,
        sourceTaskId: row.source_task_id,
        targetTaskId: row.target_task_id,
        status: row.status,
        output: row.output_json ? JSON.parse(row.output_json) : null,
        errorMessage: row.error_message,
        createdAt: new Date(row.created_at).getTime(),
        deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
      }));
  }

  /**
   * List handoffs for a target task.
   */
  listHandoffsByTarget(targetTaskId) {
    return this.db.prepare('SELECT * FROM task_handoffs WHERE target_task_id = @targetTaskId ORDER BY created_at')
      .all({ targetTaskId })
      .map((row) => ({
        id: row.id,
        sourceTaskId: row.source_task_id,
        targetTaskId: row.target_task_id,
        status: row.status,
        output: row.output_json ? JSON.parse(row.output_json) : null,
        errorMessage: row.error_message,
        createdAt: new Date(row.created_at).getTime(),
        deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
      }));
  }
}

module.exports = { TaskRepository };
