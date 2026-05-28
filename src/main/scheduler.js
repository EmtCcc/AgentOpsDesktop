'use strict';

const { EventEmitter } = require('events');
const { nextCronTime } = require('./cron-parser');
const logger = require('./logger');

/**
 * Scheduler engine — polls for due schedules and triggers task creation.
 */
class Scheduler extends EventEmitter {
  /**
   * @param {object} opts
   * @param {import('./repositories/schedule.repository').ScheduleRepository} opts.scheduleRepo
   * @param {import('./repositories/task.repository').TaskRepository} opts.taskRepo
   */
  constructor({ scheduleRepo, taskRepo }) {
    super();
    this.scheduleRepo = scheduleRepo;
    this.taskRepo = taskRepo;
    this._timer = null;
    this._running = false;
    this._tickIntervalMs = 30_000; // 30s
  }

  /**
   * Start the scheduler polling loop.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._timer = setInterval(() => this._tick(), this._tickIntervalMs);
    logger.info('scheduler.started', { intervalMs: this._tickIntervalMs });
  }

  /**
   * Stop the scheduler.
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
    logger.info('scheduler.stopped');
  }

  /**
   * Recover schedules on startup — recalculate next_run_at for all enabled schedules.
   */
  recoverOnStartup() {
    const enabled = this.scheduleRepo.listAllEnabled();
    let recovered = 0;
    for (const schedule of enabled) {
      try {
        const next = nextCronTime(schedule.cronExpr);
        this.scheduleRepo.updateNextRun(schedule.id, next);
        recovered++;
      } catch (err) {
        logger.warn('scheduler.recover.failed', { scheduleId: schedule.id, error: err.message });
      }
    }
    logger.info('scheduler.recovered', { count: recovered });
  }

  /**
   * Core tick — find due schedules and trigger them.
   */
  _tick() {
    try {
      const due = this.scheduleRepo.listDue();
      for (const schedule of due) {
        this._trigger(schedule);
      }
    } catch (err) {
      logger.error('scheduler.tick.error', { error: err.message });
    }
  }

  /**
   * Trigger a single schedule — create a task and update state.
   */
  _trigger(schedule) {
    try {
      const template = schedule.taskTemplate || {};
      const task = this.taskRepo.create({
        title: template.title || `Scheduled: ${schedule.name}`,
        description: template.description || null,
        goalId: schedule.goalId || template.goalId || null,
        assigneeAgentId: schedule.agentId || template.assigneeAgentId || null,
        ownerRole: 'admin',
      });

      // Record execution
      this.scheduleRepo.incrementExecution(schedule.id);
      this.scheduleRepo.addLog({
        scheduleId: schedule.id,
        taskId: task.id,
        status: 'triggered',
      });

      // Calculate next run
      const nextRun = nextCronTime(schedule.cronExpr);
      this.scheduleRepo.updateNextRun(schedule.id, nextRun);

      // Auto-disable if max executions reached
      const updated = this.scheduleRepo.getById(schedule.id);
      if (updated.maxExecutions != null && updated.executionCount >= updated.maxExecutions) {
        this.scheduleRepo.toggleEnabled(schedule.id, false);
        this.scheduleRepo.addLog({
          scheduleId: schedule.id,
          status: 'skipped',
          error: 'Max executions reached, schedule auto-disabled',
        });
        this.emit('schedule:disabled', { scheduleId: schedule.id, reason: 'max_executions' });
        logger.info('scheduler.auto-disabled', { scheduleId: schedule.id });
      }

      this.emit('schedule:triggered', { scheduleId: schedule.id, taskId: task.id });
      logger.info('scheduler.triggered', { scheduleId: schedule.id, taskId: task.id });
    } catch (err) {
      this.scheduleRepo.addLog({
        scheduleId: schedule.id,
        status: 'failed',
        error: err.message,
      });
      this.emit('schedule:failed', { scheduleId: schedule.id, error: err.message });
      logger.error('scheduler.trigger.failed', { scheduleId: schedule.id, error: err.message });
    }
  }

  /**
   * Manually trigger a schedule (for testing / on-demand).
   */
  triggerNow(scheduleId) {
    const schedule = this.scheduleRepo.getById(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);
    this._trigger(schedule);
    return this.scheduleRepo.getById(scheduleId);
  }
}

module.exports = { Scheduler };
