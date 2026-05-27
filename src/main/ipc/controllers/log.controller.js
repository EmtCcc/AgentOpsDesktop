'use strict';

/**
 * Log controller.
 * Pulls logs from agent live sessions and maintains a global ring buffer.
 * Pushes new entries to renderer via 'logs:new' channel.
 */

let mainWindow = null;
const globalLogs = [];
const LOG_HARD_LIMIT = 10000;
const LOG_TRIM_TARGET = 8000;

// ── Repository (injected) ──
let taskLogRepo = null;

function setMainWindow(win) {
  mainWindow = win;
}

const logController = {
  /**
   * Set the repository for persistent storage.
   * @param {import('../../repositories/task-log.repository').TaskLogRepository} repo
   */
  setRepository(repo) {
    taskLogRepo = repo;
  },

  async list(_event, { agentId, taskId, limit = 200, offset = 0 } = {}) {
    // If taskId provided, use repository
    if (taskId && taskLogRepo) {
      return taskLogRepo.listByTask(taskId, limit);
    }

    if (agentId) {
      const agentController = require('./agent.controller');
      const session = agentController._sessions.get(agentId);
      if (!session) throw new Error(`Agent session not found: ${agentId}`);
      const logs = session.logs.slice(offset, offset + limit);
      return logs.map((l, i) => ({
        id: `${agentId}-${offset + i}`,
        agentId,
        ...l,
      }));
    }
    return globalLogs.slice(offset, offset + limit);
  },

  async append(_event, entry) {
    // If taskId provided, persist to database
    if (entry.taskId && taskLogRepo) {
      const record = taskLogRepo.append(
        entry.taskId,
        entry.stream || 'stdout',
        entry.message
      );
      mainWindow?.webContents.send('logs:new', record);
      return record;
    }

    const record = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...entry,
    };
    globalLogs.push(record);
    if (globalLogs.length > LOG_HARD_LIMIT) {
      globalLogs.splice(0, globalLogs.length - LOG_TRIM_TARGET);
    }
    mainWindow?.webContents.send('logs:new', record);
    return record;
  },
};

logController.schemas = {
  list: {
    agentId: { type: 'string' },
    taskId: { type: 'string' },
    limit: { type: 'number' },
    offset: { type: 'number' },
  },
  append: {
    agentId: { type: 'string' },
    taskId: { type: 'string' },
    message: { type: 'string', required: true },
    level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
    stream: { type: 'string', enum: ['stdout', 'stderr'] },
  },
};

logController.setMainWindow = setMainWindow;

module.exports = logController;
