'use strict';

/**
 * Stats controller — aggregated metrics for the dashboard.
 */

const agents = require('./agent.controller');
const tasks = require('./task.controller');

const statsController = {
  async summary() {
    const agentList = await agents.list();
    const taskList = await tasks.list();

    return {
      agents: {
        total: agentList.length,
        running: agentList.filter((a) => a.status === 'running').length,
        idle: agentList.filter((a) => a.status === 'idle').length,
        error: agentList.filter((a) => a.status === 'error').length,
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
