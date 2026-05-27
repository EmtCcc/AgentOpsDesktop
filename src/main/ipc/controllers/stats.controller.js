'use strict';

/**
 * Stats controller — aggregated metrics for the dashboard.
 * Pulls live data from agent and task controllers.
 */

const agentController = require('./agent.controller');
const taskController = require('./task.controller');

const statsController = {
  async summary() {
    // list() returns items array directly (pagination handled internally)
    const agentList = await agentController.list(null, { limit: 10000 });
    const taskList = await taskController.list(null, { limit: 10000 });

    return {
      agents: {
        total: agentList.length,
        running: agentList.filter((a) => a.status === 'running').length,
        idle: agentList.filter((a) => a.status === 'idle' || a.status === 'spawning').length,
        error: agentList.filter((a) => a.status === 'error').length,
        stopped: agentList.filter((a) => a.status === 'stopped' || a.status === 'completed').length,
      },
      tasks: {
        total: taskList.length,
        pending: taskList.filter((t) => t.status === 'pending').length,
        running: taskList.filter((t) => t.status === 'running').length,
        done: taskList.filter((t) => t.status === 'done').length,
        failed: taskList.filter((t) => t.status === 'failed').length,
      },
    };
  },
};

module.exports = statsController;
