'use strict';

const { IpcError } = require('../errors');

let scheduleRepo = null;
let scheduler = null;

const scheduleController = {
  setRepository(repo) {
    scheduleRepo = repo;
  },

  setScheduler(sched) {
    scheduler = sched;
  },

  async list(event, params = {}) {
    if (!scheduleRepo) throw IpcError.internal('Schedule repository not initialized');
    return scheduleRepo.list(params);
  },

  async get(event, { id }) {
    if (!scheduleRepo) throw IpcError.internal('Schedule repository not initialized');
    const schedule = scheduleRepo.getById(id);
    if (!schedule) throw IpcError.notFound('Schedule', id);
    return schedule;
  },

  async create(event, schedule) {
    if (!scheduleRepo) throw IpcError.internal('Schedule repository not initialized');
    const { nextCronTime } = require('../../cron-parser');
    const nextRun = nextCronTime(schedule.cronExpr);
    const created = scheduleRepo.create({
      ...schedule,
      nextRunAt: nextRun.toISOString(),
    });
    return created;
  },

  async update(event, { id, updates }) {
    if (!scheduleRepo) throw IpcError.internal('Schedule repository not initialized');
    const existing = scheduleRepo.getById(id);
    if (!existing) throw IpcError.notFound('Schedule', id);

    // If cron expression changed, recalculate next_run_at
    if (updates.cronExpr && updates.cronExpr !== existing.cronExpr) {
      const { nextCronTime } = require('../../cron-parser');
      updates.nextRunAt = nextCronTime(updates.cronExpr).toISOString();
    }

    return scheduleRepo.update(id, updates);
  },

  async delete(event, { id }) {
    if (!scheduleRepo) throw IpcError.internal('Schedule repository not initialized');
    const deleted = scheduleRepo.delete(id);
    if (!deleted) throw IpcError.notFound('Schedule', id);
    return { deleted: true, id };
  },

  async pause(event, { id }) {
    if (!scheduleRepo) throw IpcError.internal('Schedule repository not initialized');
    const existing = scheduleRepo.getById(id);
    if (!existing) throw IpcError.notFound('Schedule', id);
    return scheduleRepo.toggleEnabled(id, false);
  },

  async resume(event, { id }) {
    if (!scheduleRepo) throw IpcError.internal('Schedule repository not initialized');
    const existing = scheduleRepo.getById(id);
    if (!existing) throw IpcError.notFound('Schedule', id);
    const { nextCronTime } = require('../../cron-parser');
    const nextRun = nextCronTime(existing.cronExpr);
    scheduleRepo.updateNextRun(id, nextRun);
    return scheduleRepo.toggleEnabled(id, true);
  },

  async triggerNow(event, { id }) {
    if (!scheduler) throw IpcError.internal('Scheduler not initialized');
    return scheduler.triggerNow(id);
  },

  async listLogs(event, { id, limit }) {
    if (!scheduleRepo) throw IpcError.internal('Schedule repository not initialized');
    const existing = scheduleRepo.getById(id);
    if (!existing) throw IpcError.notFound('Schedule', id);
    return scheduleRepo.listLogs(id, limit || 50);
  },
};

scheduleController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    cronExpr: { type: 'string', required: true, minLength: 1 },
    goalId: { type: 'string' },
    agentId: { type: 'string' },
    taskTemplate: { type: 'object' },
    maxExecutions: { type: 'number' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['name', 'cronExpr', 'goalId', 'agentId', 'taskTemplate', 'maxExecutions', 'enabled'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        return true;
      },
    },
  },
  delete: {
    id: { type: 'string', required: true },
  },
  pause: {
    id: { type: 'string', required: true },
  },
  resume: {
    id: { type: 'string', required: true },
  },
  triggerNow: {
    id: { type: 'string', required: true },
  },
  listLogs: {
    id: { type: 'string', required: true },
    limit: { type: 'number' },
  },
};

module.exports = scheduleController;
