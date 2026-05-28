'use strict';

const { IpcError } = require('../errors');

let costRepo = null;

const costController = {
  setRepository(repo) {
    costRepo = repo;
  },

  // ── Budget CRUD ──

  async listBudgets(event, params = {}) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    return costRepo.listBudgets();
  },

  async getBudget(event, { id }) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    const budget = costRepo.getBudgetById(id);
    if (!budget) throw IpcError.notFound('Budget', id);
    return budget;
  },

  async getBudgetByAgent(event, { agentId }) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    return costRepo.getBudgetByAgent(agentId);
  },

  async createBudget(event, budget) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    if (!budget.agentId) throw IpcError.validation('agentId is required');
    const existing = costRepo.getBudgetByAgent(budget.agentId);
    if (existing) throw IpcError.conflict('Budget already exists for this agent');
    return costRepo.createBudget(budget);
  },

  async updateBudget(event, { id, updates }) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    const budget = costRepo.updateBudget(id, updates);
    if (!budget) throw IpcError.notFound('Budget', id);
    return budget;
  },

  async deleteBudget(event, { id }) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    const deleted = costRepo.deleteBudget(id);
    if (!deleted) throw IpcError.notFound('Budget', id);
    return { deleted: true, id };
  },

  // ── Usage Logs ──

  async logUsage(event, entry) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    if (!entry.agentId) throw IpcError.validation('agentId is required');
    return costRepo.logUsage(entry);
  },

  async listUsage(event, { agentId, taskId, limit }) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    if (taskId) return costRepo.listUsageByTask(taskId);
    if (agentId) return costRepo.listUsageByAgent(agentId, limit || 50);
    throw IpcError.validation('agentId or taskId is required');
  },

  // ── Cost Reports ──

  async getCostReport(event, params = {}) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    const { agentId, goalId, since, until } = params;

    if (agentId) {
      const spend = costRepo.getSpendByAgent(agentId, since);
      const budget = costRepo.getBudgetByAgent(agentId);
      const usage = costRepo.listUsageByAgent(agentId, 100);
      return { agentId, totalSpend: spend, budget, usage };
    }

    if (goalId) {
      const byGoal = costRepo.getSpendByGoal(since);
      const goalData = byGoal.find((g) => g.goal_id === goalId);
      return { goalId, totalCost: goalData?.total_cost || 0, totalTokens: goalData?.total_tokens || 0 };
    }

    // Global report
    const totalSpend = costRepo.getTotalSpend(since);
    const byGoal = costRepo.getSpendByGoal(since);
    const budgets = costRepo.listBudgets();
    return { totalSpend, byGoal, budgets };
  },

  async resetBudgets(event) {
    if (!costRepo) throw IpcError.internal('Cost repository not initialized');
    const count = costRepo.resetMonthlyBudgets();
    return { reset: count };
  },
};

costController.schemas = {
  listBudgets: {},
  getBudget: {
    id: { type: 'string', required: true },
  },
  getBudgetByAgent: {
    agentId: { type: 'string', required: true },
  },
  createBudget: {
    agentId: { type: 'string', required: true },
    monthlyLimit: { type: 'number', required: true },
    currency: { type: 'string' },
    warnPct: { type: 'number' },
    pausePct: { type: 'number' },
    stopPct: { type: 'number' },
  },
  updateBudget: {
    id: { type: 'string', required: true },
    updates: { type: 'object', required: true },
  },
  deleteBudget: {
    id: { type: 'string', required: true },
  },
  logUsage: {
    agentId: { type: 'string', required: true },
    taskId: { type: 'string' },
    inputTokens: { type: 'number' },
    outputTokens: { type: 'number' },
    costUsd: { type: 'number' },
    model: { type: 'string' },
    provider: { type: 'string' },
  },
  listUsage: {
    agentId: { type: 'string' },
    taskId: { type: 'string' },
    limit: { type: 'number' },
  },
  getCostReport: {
    agentId: { type: 'string' },
    goalId: { type: 'string' },
    since: { type: 'string' },
    until: { type: 'string' },
  },
  resetBudgets: {},
};

module.exports = costController;
