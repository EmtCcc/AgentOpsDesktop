'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for schedule (cron) persistence.
 * Manages schedules and schedule_logs tables.
 */
class ScheduleRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insertSchedule: this.db.prepare(`
        INSERT INTO schedules (id, name, cron_expr, enabled, goal_id, agent_id,
          task_template, max_executions, execution_count, last_run_at, next_run_at,
          created_at, updated_at)
        VALUES (@id, @name, @cronExpr, @enabled, @goalId, @agentId,
          @taskTemplate, @maxExecutions, @executionCount, @lastRunAt, @nextRunAt,
          @createdAt, @updatedAt)
      `),
      updateSchedule: this.db.prepare(`
        UPDATE schedules SET name = @name, cron_expr = @cronExpr, enabled = @enabled,
          goal_id = @goalId, agent_id = @agentId, task_template = @taskTemplate,
          max_executions = @maxExecutions, execution_count = @executionCount,
          last_run_at = @lastRunAt, next_run_at = @nextRunAt, updated_at = @updatedAt
        WHERE id = @id
      `),
      deleteSchedule: this.db.prepare('DELETE FROM schedules WHERE id = @id'),
      getScheduleById: this.db.prepare('SELECT * FROM schedules WHERE id = @id'),
      listSchedules: this.db.prepare('SELECT * FROM schedules ORDER BY created_at DESC'),
      listEnabled: this.db.prepare('SELECT * FROM schedules WHERE enabled = 1 AND (next_run_at IS NULL OR next_run_at <= @now) ORDER BY next_run_at'),
      listAllEnabled: this.db.prepare('SELECT * FROM schedules WHERE enabled = 1 ORDER BY next_run_at'),
      toggleEnabled: this.db.prepare('UPDATE schedules SET enabled = @enabled, updated_at = @now WHERE id = @id'),
      updateNextRun: this.db.prepare('UPDATE schedules SET next_run_at = @nextRunAt, updated_at = @now WHERE id = @id'),
      incrementExecution: this.db.prepare('UPDATE schedules SET execution_count = execution_count + 1, last_run_at = @lastRunAt, updated_at = @now WHERE id = @id'),

      // Logs
      insertLog: this.db.prepare(`
        INSERT INTO schedule_logs (schedule_id, task_id, status, error, triggered_at)
        VALUES (@scheduleId, @taskId, @status, @error, @triggeredAt)
      `),
      listLogs: this.db.prepare('SELECT * FROM schedule_logs WHERE schedule_id = @scheduleId ORDER BY triggered_at DESC LIMIT @limit'),
    };
  }

  // ── Mapping helpers ──

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      cronExpr: row.cron_expr,
      enabled: row.enabled === 1,
      goalId: row.goal_id,
      agentId: row.agent_id,
      taskTemplate: row.task_template ? JSON.parse(row.task_template) : {},
      maxExecutions: row.max_executions,
      executionCount: row.execution_count,
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  _toDbParams(schedule) {
    const now = new Date().toISOString();
    return {
      id: schedule.id || randomUUID(),
      name: schedule.name,
      cronExpr: schedule.cronExpr,
      enabled: schedule.enabled !== false ? 1 : 0,
      goalId: schedule.goalId || null,
      agentId: schedule.agentId || null,
      taskTemplate: schedule.taskTemplate ? JSON.stringify(schedule.taskTemplate) : '{}',
      maxExecutions: schedule.maxExecutions ?? null,
      executionCount: schedule.executionCount ?? 0,
      lastRunAt: schedule.lastRunAt || null,
      nextRunAt: schedule.nextRunAt || null,
      createdAt: schedule.createdAt || now,
      updatedAt: now,
    };
  }

  _logToRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      taskId: row.task_id,
      status: row.status,
      error: row.error,
      triggeredAt: row.triggered_at,
    };
  }

  // ── CRUD ──

  create(schedule) {
    const params = this._toDbParams(schedule);
    this._stmts.insertSchedule.run(params);
    return this._toRecord(this._stmts.getScheduleById.get({ id: params.id }));
  }

  getById(id) {
    return this._toRecord(this._stmts.getScheduleById.get({ id }));
  }

  update(id, updates) {
    const existing = this._stmts.getScheduleById.get({ id });
    if (!existing) return null;
    const merged = { ...this._toRecord(existing), ...updates, id };
    const params = this._toDbParams(merged);
    this._stmts.updateSchedule.run(params);
    return this._toRecord(this._stmts.getScheduleById.get({ id }));
  }

  delete(id) {
    const result = this._stmts.deleteSchedule.run({ id });
    return result.changes > 0;
  }

  list(params = {}) {
    const { offset = 0, limit = 20 } = params;
    const rows = this._stmts.listSchedules.all();
    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._toRecord(r));
    return { items, total, offset, limit };
  }

  // ── Scheduler-specific ──

  listDue(now) {
    const nowStr = (now || new Date()).toISOString();
    return this._stmts.listEnabled.all({ now: nowStr }).map((r) => this._toRecord(r));
  }

  listAllEnabled() {
    return this._stmts.listAllEnabled.all().map((r) => this._toRecord(r));
  }

  toggleEnabled(id, enabled) {
    const now = new Date().toISOString();
    this._stmts.toggleEnabled.run({ id, enabled: enabled ? 1 : 0, now });
    return this._toRecord(this._stmts.getScheduleById.get({ id }));
  }

  updateNextRun(id, nextRunAt) {
    const now = new Date().toISOString();
    this._stmts.updateNextRun.run({ id, nextRunAt: nextRunAt.toISOString(), now });
  }

  incrementExecution(id) {
    const now = new Date().toISOString();
    this._stmts.incrementExecution.run({ id, lastRunAt: now, now });
  }

  // ── Logs ──

  addLog(entry) {
    const now = new Date().toISOString();
    this._stmts.insertLog.run({
      scheduleId: entry.scheduleId,
      taskId: entry.taskId || null,
      status: entry.status,
      error: entry.error || null,
      triggeredAt: now,
    });
  }

  listLogs(scheduleId, limit = 50) {
    return this._stmts.listLogs.all({ scheduleId, limit }).map((r) => this._logToRecord(r));
  }
}

module.exports = { ScheduleRepository };
