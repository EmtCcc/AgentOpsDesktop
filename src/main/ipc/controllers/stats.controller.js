'use strict';

/**
 * Stats controller — aggregated metrics for the dashboard.
 * Pulls live data from agent and task controllers.
 */

const agentController = require('./agent.controller');
const taskController = require('./task.controller');

const statsController = {
  async summary() {
    // Fetch all items (high limit) for aggregation
    const agentResult = await agentController.list(null, { limit: 10000 });
    const taskResult = await taskController.list(null, { limit: 10000 });
    const agentList = agentResult.items;
    const taskList = taskResult.items;

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
        todo: taskList.filter((t) => t.status === 'todo').length,
        in_progress: taskList.filter((t) => t.status === 'in_progress').length,
        done: taskList.filter((t) => t.status === 'done').length,
        blocked: taskList.filter((t) => t.status === 'blocked').length,
      },
    };
  },
};

module.exports = statsController;
