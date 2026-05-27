'use strict';

/**
 * Log controller.
 * Pulls logs from agent live sessions and maintains a global ring buffer.
 * Pushes new entries to renderer via 'logs:new' channel.
 */

let mainWindow = null;
const globalLogs = [];

function setMainWindow(win) {
  mainWindow = win;
}

const logController = {
  async list(_event, { agentId, limit = 200, offset = 0 } = {}) {
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
    const record = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...entry,
    };
    globalLogs.push(record);
    if (globalLogs.length > 10000) globalLogs.splice(0, globalLogs.length - 10000);
    mainWindow?.webContents.send('logs:new', record);
    return record;
  },
};

logController.schemas = {
  list: {
    agentId: { type: 'string' },
    limit: { type: 'number' },
    offset: { type: 'number' },
  },
  append: {
    agentId: { type: 'string' },
    message: { type: 'string', required: true },
    level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
    stream: { type: 'string', enum: ['stdout', 'stderr'] },
  },
};

logController.setMainWindow = setMainWindow;

module.exports = logController;
