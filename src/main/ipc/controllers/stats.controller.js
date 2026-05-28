'use strict';

/**
 * Stats controller — aggregated metrics for the dashboard.
 * Pulls live data from agent and task controllers.
 */

const agentController = require('./agent.controller');
const taskController = require('./task.controller');

let costRepo = null;

const statsController = {
  setCostRepository(repo) {
    costRepo = repo;
  },

  async summary() {
    const { items: agentList } = await agentController.list(null, { limit: 10000 });
    const { items: taskList } = await taskController.list(null, { limit: 10000 });

    const result = {
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
        assigned: taskList.filter((t) => t.status === 'assigned').length,
        running: taskList.filter((t) => t.status === 'running').length,
        done: taskList.filter((t) => t.status === 'done').length,
        failed: taskList.filter((t) => t.status === 'failed').length,
        blocked: taskList.filter((t) => t.status === 'blocked').length,
      },
    };

    if (costRepo) {
      try {
        const totalSpend = costRepo.getTotalSpend();
        const budgets = costRepo.listBudgets();
        const overBudget = budgets.filter((b) => b.status === 'paused' || b.status === 'stopped');
        result.costs = {
          totalSpendThisMonth: totalSpend,
          budgetCount: budgets.length,
          overBudgetCount: overBudget.length,
        };
      } catch { /* costs table may not exist yet */ }
    }

    return result;
  },
};

module.exports = statsController;
