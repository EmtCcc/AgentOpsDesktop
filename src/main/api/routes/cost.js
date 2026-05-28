'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const cost = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
};

const createBudgetSchema = {
  agentId: { type: 'string', required: true },
  monthlyLimit: { type: 'number', required: true },
  currency: { type: 'string' },
  warnPct: { type: 'number' },
  pausePct: { type: 'number' },
  stopPct: { type: 'number' },
};

const updateBudgetSchema = {
  monthlyLimit: { type: 'number' },
  currency: { type: 'string' },
  warnPct: { type: 'number' },
  pausePct: { type: 'number' },
  stopPct: { type: 'number' },
};

const logUsageSchema = {
  agentId: { type: 'string', required: true },
  taskId: { type: 'string' },
  inputTokens: { type: 'number' },
  outputTokens: { type: 'number' },
  costUsd: { type: 'number' },
  model: { type: 'string' },
  provider: { type: 'string' },
};

const reportQuerySchema = {
  agentId: { type: 'string' },
  goalId: { type: 'string' },
  since: { type: 'string' },
  until: { type: 'string' },
};

// ── Budget CRUD ──

cost.get('/budgets', async (c) => {
  const repo = c.get('repos').costs;
  const budgets = repo.listBudgets();
  return c.json({ ok: true, data: budgets });
});

cost.get('/budgets/:id', async (c) => {
  const repo = c.get('repos').costs;
  const budget = repo.getBudgetById(c.req.param('id'));
  if (!budget) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } }, 404);
  return c.json({ ok: true, data: budget });
});

cost.get('/budgets/agent/:agentId', async (c) => {
  const repo = c.get('repos').costs;
  const budget = repo.getBudgetByAgent(c.req.param('agentId'));
  if (!budget) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } }, 404);
  return c.json({ ok: true, data: budget });
});

cost.post('/budgets', validateRequest({ body: createBudgetSchema }), async (c) => {
  const repo = c.get('repos').costs;
  const body = c.get('validatedBody');
  const existing = repo.getBudgetByAgent(body.agentId);
  if (existing) return c.json({ ok: false, error: { code: 'CONFLICT', message: 'Budget already exists for this agent' } }, 409);
  const budget = repo.createBudget(body);
  return c.json({ ok: true, data: budget }, 201);
});

cost.patch('/budgets/:id', validateRequest({ body: updateBudgetSchema }), async (c) => {
  const repo = c.get('repos').costs;
  const body = c.get('validatedBody');
  const budget = repo.updateBudget(c.req.param('id'), body);
  if (!budget) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } }, 404);
  return c.json({ ok: true, data: budget });
});

cost.delete('/budgets/:id', async (c) => {
  const repo = c.get('repos').costs;
  const deleted = repo.deleteBudget(c.req.param('id'));
  if (!deleted) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } }, 404);
  return c.json({ ok: true, data: { deleted: true, id: c.req.param('id') } });
});

// ── Budget Actions ──

cost.post('/budgets/:id/reset', async (c) => {
  const repo = c.get('repos').costs;
  const budget = repo.getBudgetById(c.req.param('id'));
  if (!budget) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } }, 404);
  repo.resetMonthlyBudgets();
  const updated = repo.getBudgetById(c.req.param('id'));
  return c.json({ ok: true, data: updated });
});

// ── Usage Logging ──

cost.post('/usage', validateRequest({ body: logUsageSchema }), async (c) => {
  const repo = c.get('repos').costs;
  const body = c.get('validatedBody');
  const result = repo.logUsage(body);
  return c.json({ ok: true, data: result }, 201);
});

cost.get('/usage', validateRequest({ query: { agentId: { type: 'string' }, taskId: { type: 'string' }, limit: { type: 'number', min: 1, max: 500 } } }), async (c) => {
  const repo = c.get('repos').costs;
  const { agentId, taskId, limit } = c.req.query();
  if (taskId) {
    return c.json({ ok: true, data: repo.listUsageByTask(taskId) });
  }
  if (agentId) {
    return c.json({ ok: true, data: repo.listUsageByAgent(agentId, limit ? parseInt(limit, 10) : 50) });
  }
  return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'agentId or taskId required' } }, 422);
});

// ── Cost Reports ──

cost.get('/reports', validateRequest({ query: reportQuerySchema }), async (c) => {
  const repo = c.get('repos').costs;
  const { agentId, goalId, since, until } = c.req.query();

  if (agentId) {
    const spend = repo.getSpendByAgent(agentId, since);
    const budget = repo.getBudgetByAgent(agentId);
    const usage = repo.listUsageByAgent(agentId, 100);
    return c.json({ ok: true, data: { agentId, totalSpend: spend, budget, usage } });
  }

  if (goalId) {
    const byGoal = repo.getSpendByGoal(since);
    const goalData = byGoal.find((g) => g.goal_id === goalId);
    return c.json({ ok: true, data: { goalId, totalCost: goalData?.total_cost || 0, totalTokens: goalData?.total_tokens || 0 } });
  }

  const totalSpend = repo.getTotalSpend(since);
  const byGoal = repo.getSpendByGoal(since);
  const budgets = repo.listBudgets();
  return c.json({ ok: true, data: { totalSpend, byGoal, budgets } });
});

cost.get('/reports/agent/:agentId/period', validateRequest({ query: { since: { type: 'string' }, until: { type: 'string' } } }), async (c) => {
  const repo = c.get('repos').costs;
  const agentId = c.req.param('agentId');
  const { since, until } = c.req.query();
  const data = repo.getSpendByPeriod(agentId, since, until);
  return c.json({ ok: true, data });
});

module.exports = cost;
