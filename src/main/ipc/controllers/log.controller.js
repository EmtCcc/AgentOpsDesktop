'use strict';

/**
 * Log controller.
 * In-memory ring buffer (max 10k entries).
 * Pushes new entries to renderer via 'logs:new' channel.
 */

let mainWindow = null;
const logs = [];

function setMainWindow(win) {
  mainWindow = win;
}

const logController = {
  async list(_event, { agentId, limit = 200 } = {}) {
    let filtered = agentId ? logs.filter((l) => l.agentId === agentId) : logs;
    return filtered.slice(-limit);
  },

  async append(_event, entry) {
    const record = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...entry,
    };
    logs.push(record);
    if (logs.length > 10000) logs.splice(0, logs.length - 10000);
    mainWindow?.webContents.send('logs:new', record);
    return record;
  },
};

logController.schemas = {
  append: {
    agentId: { type: 'string' },
    message: { type: 'string', required: true },
    level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
    stream: { type: 'string', enum: ['stdout', 'stderr'] },
  },
};

logController.setMainWindow = setMainWindow;

module.exports = logController;
