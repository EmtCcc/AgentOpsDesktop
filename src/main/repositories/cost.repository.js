'use strict';

const { randomUUID } = require('crypto');

class CostRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      // Budget CRUD
      insertBudget: this.db.prepare(`
        INSERT INTO agent_budgets (id, agent_id, monthly_limit, current_spend, currency, warn_pct, pause_pct, stop_pct, period_start, period_end, status, created_at, updated_at)
        VALUES (@id, @agentId, @monthlyLimit, @currentSpend, @currency, @warnPct, @pausePct, @stopPct, @periodStart, @periodEnd, @status, @createdAt, @updatedAt)
      `),
      updateBudget: this.db.prepare(`
        UPDATE agent_budgets
        SET monthly_limit = @monthlyLimit, currency = @currency, warn_pct = @warnPct, pause_pct = @pausePct, stop_pct = @stopPct, updated_at = @updatedAt
        WHERE id = @id
      `),
      updateBudgetSpend: this.db.prepare(`
        UPDATE agent_budgets SET current_spend = @currentSpend, updated_at = @updatedAt WHERE id = @id
      `),
      updateBudgetStatus: this.db.prepare(`
        UPDATE agent_budgets SET status = @status, updated_at = @updatedAt WHERE id = @id
      `),
      resetBudgetPeriod: this.db.prepare(`
        UPDATE agent_budgets SET current_spend = 0, period_start = @periodStart, period_end = @periodEnd, status = 'active', updated_at = @updatedAt WHERE id = @id
      `),
      deleteBudget: this.db.prepare('DELETE FROM agent_budgets WHERE id = @id'),
      getBudgetById: this.db.prepare('SELECT * FROM agent_budgets WHERE id = @id'),
      getBudgetByAgent: this.db.prepare('SELECT * FROM agent_budgets WHERE agent_id = @agentId'),
      listBudgets: this.db.prepare('SELECT * FROM agent_budgets ORDER BY created_at DESC'),

      // Usage logs
      insertUsage: this.db.prepare(`
        INSERT INTO agent_usage_logs (agent_id, task_id, input_tokens, output_tokens, total_tokens, cost_usd, model, provider, created_at)
        VALUES (@agentId, @taskId, @inputTokens, @outputTokens, @totalTokens, @costUsd, @model, @provider, @createdAt)
      `),
      listUsageByAgent: this.db.prepare(`
        SELECT * FROM agent_usage_logs WHERE agent_id = @agentId ORDER BY created_at DESC LIMIT @limit
      `),
      listUsageByTask: this.db.prepare(`
        SELECT * FROM agent_usage_logs WHERE task_id = @taskId ORDER BY created_at DESC
      `),

      // Aggregations
      sumSpendByAgent: this.db.prepare(`
        SELECT COALESCE(SUM(cost_usd), 0) as total FROM agent_usage_logs WHERE agent_id = @agentId AND created_at >= @since
      `),
      sumSpendByGoal: this.db.prepare(`
        SELECT t.goal_id, COALESCE(SUM(u.cost_usd), 0) as total_cost, COALESCE(SUM(u.total_tokens), 0) as total_tokens
        FROM agent_usage_logs u JOIN tasks t ON u.task_id = t.id
        WHERE u.created_at >= @since
        GROUP BY t.goal_id
      `),
      sumSpendByPeriod: this.db.prepare(`
        SELECT date(created_at) as day, COALESCE(SUM(cost_usd), 0) as total_cost, COALESCE(SUM(total_tokens), 0) as total_tokens
        FROM agent_usage_logs
        WHERE agent_id = @agentId AND created_at >= @since AND created_at <= @until
        GROUP BY date(created_at)
        ORDER BY day
      `),
      totalSpend: this.db.prepare(`
        SELECT COALESCE(SUM(cost_usd), 0) as total FROM agent_usage_logs WHERE created_at >= @since
      `),

      // Per-model aggregation
      sumSpendByModel: this.db.prepare(`
        SELECT model, COALESCE(SUM(cost_usd), 0) as total_cost,
               COALESCE(SUM(input_tokens), 0) as total_input_tokens,
               COALESCE(SUM(output_tokens), 0) as total_output_tokens,
               COALESCE(SUM(total_tokens), 0) as total_tokens,
               COUNT(*) as request_count
        FROM agent_usage_logs
        WHERE created_at >= @since
        GROUP BY model
        ORDER BY total_cost DESC
      `),

      // Per-task cost breakdown
      sumSpendByTask: this.db.prepare(`
        SELECT u.task_id, t.title as task_title, a.name as agent_name,
               COALESCE(SUM(u.cost_usd), 0) as total_cost,
               COALESCE(SUM(u.total_tokens), 0) as total_tokens,
               COUNT(*) as request_count
        FROM agent_usage_logs u
        LEFT JOIN tasks t ON u.task_id = t.id
        LEFT JOIN agents a ON u.agent_id = a.id
        WHERE u.created_at >= @since AND u.task_id IS NOT NULL
        GROUP BY u.task_id
        ORDER BY total_cost DESC
        LIMIT @limit
      `),

      // Per-agent token breakdown
      sumTokensByAgent: this.db.prepare(`
        SELECT u.agent_id, a.name as agent_name,
               COALESCE(SUM(u.input_tokens), 0) as total_input_tokens,
               COALESCE(SUM(u.output_tokens), 0) as total_output_tokens,
               COALESCE(SUM(u.total_tokens), 0) as total_tokens,
               COALESCE(SUM(u.cost_usd), 0) as total_cost,
               COUNT(*) as request_count
        FROM agent_usage_logs u
        LEFT JOIN agents a ON u.agent_id = a.id
        WHERE u.created_at >= @since
        GROUP BY u.agent_id
        ORDER BY total_cost DESC
      `),

      // Daily trends across all agents
      sumSpendByPeriodAll: this.db.prepare(`
        SELECT date(created_at) as day, COALESCE(SUM(cost_usd), 0) as total_cost,
               COALESCE(SUM(total_tokens), 0) as total_tokens,
               COUNT(*) as request_count
        FROM agent_usage_logs
        WHERE created_at >= @since AND created_at <= @until
        GROUP BY date(created_at)
        ORDER BY day
      `),
    };
  }

  _toBudget(row) {
    if (!row) return null;
    return {
      id: row.id,
      agentId: row.agent_id,
      monthlyLimit: row.monthly_limit,
      currentSpend: row.current_spend,
      currency: row.currency,
      warnPct: row.warn_pct,
      pausePct: row.pause_pct,
      stopPct: row.stop_pct,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _toUsage(row) {
    if (!row) return null;
    return {
      id: row.id,
      agentId: row.agent_id,
      taskId: row.task_id,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      costUsd: row.cost_usd,
      model: row.model,
      provider: row.provider,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  // ── Budget CRUD ──

  createBudget(budget) {
    const now = new Date().toISOString();
    const periodStart = budget.periodStart || this._monthStart();
    const periodEnd = budget.periodEnd || this._monthEnd();
    const params = {
      id: budget.id || randomUUID(),
      agentId: budget.agentId,
      monthlyLimit: budget.monthlyLimit || 0,
      currentSpend: 0,
      currency: budget.currency || 'USD',
      warnPct: budget.warnPct ?? 80,
      pausePct: budget.pausePct ?? 90,
      stopPct: budget.stopPct ?? 100,
      periodStart,
      periodEnd,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this._stmts.insertBudget.run(params);
    return this._toBudget(this._stmts.getBudgetById.get({ id: params.id }));
  }

  updateBudget(id, updates) {
    const existing = this._stmts.getBudgetById.get({ id });
    if (!existing) return null;
    const now = new Date().toISOString();
    this._stmts.updateBudget.run({
      id,
      monthlyLimit: updates.monthlyLimit ?? existing.monthly_limit,
      currency: updates.currency ?? existing.currency,
      warnPct: updates.warnPct ?? existing.warn_pct,
      pausePct: updates.pausePct ?? existing.pause_pct,
      stopPct: updates.stopPct ?? existing.stop_pct,
      updatedAt: now,
    });
    return this._toBudget(this._stmts.getBudgetById.get({ id }));
  }

  deleteBudget(id) {
    return this._stmts.deleteBudget.run({ id }).changes > 0;
  }

  getBudgetById(id) {
    return this._toBudget(this._stmts.getBudgetById.get({ id }));
  }

  getBudgetByAgent(agentId) {
    return this._toBudget(this._stmts.getBudgetByAgent.get({ agentId }));
  }

  listBudgets() {
    return this._stmts.listBudgets.all().map((r) => this._toBudget(r));
  }

  // ── Usage Logging ──

  logUsage(entry) {
    const now = new Date().toISOString();
    const params = {
      agentId: entry.agentId,
      taskId: entry.taskId || null,
      inputTokens: entry.inputTokens || 0,
      outputTokens: entry.outputTokens || 0,
      totalTokens: (entry.inputTokens || 0) + (entry.outputTokens || 0),
      costUsd: entry.costUsd || 0,
      model: entry.model || null,
      provider: entry.provider || null,
      createdAt: entry.createdAt || now,
    };
    const result = this._stmts.insertUsage.run(params);

    // Update budget spend
    const budget = this.getBudgetByAgent(entry.agentId);
    if (budget) {
      const newSpend = budget.currentSpend + params.costUsd;
      this._stmts.updateBudgetSpend.run({ id: budget.id, currentSpend: newSpend, updatedAt: now });

      // Check thresholds
      if (budget.monthlyLimit > 0) {
        const pct = (newSpend / budget.monthlyLimit) * 100;
        if (pct >= budget.stopPct && budget.status !== 'stopped') {
          this._stmts.updateBudgetStatus.run({ id: budget.id, status: 'stopped', updatedAt: now });
          return { usageId: result.lastInsertRowid, budgetAction: 'stopped', budget: this._toBudget(this._stmts.getBudgetById.get({ id: budget.id })) };
        }
        if (pct >= budget.pausePct && budget.status !== 'paused') {
          this._stmts.updateBudgetStatus.run({ id: budget.id, status: 'paused', updatedAt: now });
          return { usageId: result.lastInsertRowid, budgetAction: 'paused', budget: this._toBudget(this._stmts.getBudgetById.get({ id: budget.id })) };
        }
        if (pct >= budget.warnPct) {
          return { usageId: result.lastInsertRowid, budgetAction: 'warn', budget: this._toBudget(this._stmts.getBudgetById.get({ id: budget.id })) };
        }
      }
    }

    return { usageId: result.lastInsertRowid, budgetAction: null };
  }

  listUsageByAgent(agentId, limit = 50) {
    return this._stmts.listUsageByAgent.all({ agentId, limit }).map((r) => this._toUsage(r));
  }

  listUsageByTask(taskId) {
    return this._stmts.listUsageByTask.all({ taskId }).map((r) => this._toUsage(r));
  }

  // ── Cost Reports ──

  getSpendByAgent(agentId, since) {
    const row = this._stmts.sumSpendByAgent.get({ agentId, since: since || this._monthStart() });
    return row ? row.total : 0;
  }

  getSpendByGoal(since) {
    return this._stmts.sumSpendByGoal.all({ since: since || this._monthStart() });
  }

  getSpendByPeriod(agentId, since, until) {
    return this._stmts.sumSpendByPeriod.all({
      agentId,
      since: since || this._monthStart(),
      until: until || new Date().toISOString(),
    });
  }

  getTotalSpend(since) {
    const row = this._stmts.totalSpend.get({ since: since || this._monthStart() });
    return row ? row.total : 0;
  }

  getSpendByModel(since) {
    return this._stmts.sumSpendByModel.all({ since: since || this._monthStart() });
  }

  getSpendByTask(since, limit = 25) {
    return this._stmts.sumSpendByTask.all({ since: since || this._monthStart(), limit });
  }

  getTokensByAgent(since) {
    return this._stmts.sumTokensByAgent.all({ since: since || this._monthStart() }).map((r) => ({
      agentId: r.agent_id,
      agentName: r.agent_name,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens,
      totalTokens: r.total_tokens,
      totalCost: r.total_cost,
      requestCount: r.request_count,
    }));
  }

  getSpendByPeriodAll(since, until) {
    return this._stmts.sumSpendByPeriodAll.all({
      since: since || this._monthStart(),
      until: until || new Date().toISOString(),
    });
  }

  // ── Period Management ──

  resetMonthlyBudgets() {
    const now = new Date().toISOString();
    const periodStart = this._monthStart();
    const periodEnd = this._monthEnd();
    const budgets = this._stmts.listBudgets.all();
    for (const b of budgets) {
      this._stmts.resetBudgetPeriod.run({ id: b.id, periodStart, periodEnd, updatedAt: now });
    }
    return budgets.length;
  }

  _monthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }

  _monthEnd() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  }
}

module.exports = { CostRepository };
