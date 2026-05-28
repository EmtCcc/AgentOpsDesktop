'use strict';

const logger = require('./logger');

/**
 * Budget enforcement guard.
 * Checks agent budgets before task execution and applies pause/stop actions.
 */
class CostGuard {
  /**
   * @param {import('./repositories/cost.repository').CostRepository} costRepo
   * @param {EventEmitter} [emitter] — optional emitter for budget events
   */
  constructor(costRepo, emitter) {
    this.costRepo = costRepo;
    this.emitter = emitter;
  }

  /**
   * Check if an agent is allowed to run.
   * Returns { allowed: boolean, reason?: string, budget?: object }
   */
  checkAgent(agentId) {
    const budget = this.costRepo.getBudgetByAgent(agentId);
    if (!budget) return { allowed: true };

    if (budget.status === 'stopped') {
      return { allowed: false, reason: 'Budget exceeded (stopped)', budget };
    }
    if (budget.status === 'paused') {
      return { allowed: false, reason: 'Budget limit reached (paused)', budget };
    }

    // Also check spend percentage even if status hasn't been updated yet
    if (budget.monthlyLimit > 0) {
      const pct = (budget.currentSpend / budget.monthlyLimit) * 100;
      if (pct >= budget.stopPct) {
        this.costRepo.updateBudget(budget.id, {});
        // Force status update
        this.costRepo._stmts.updateBudgetStatus.run({ id: budget.id, status: 'stopped', updatedAt: new Date().toISOString() });
        return { allowed: false, reason: `Budget exceeded (${pct.toFixed(1)}%)`, budget };
      }
    }

    return { allowed: true, budget };
  }

  /**
   * Log usage and enforce budget thresholds.
   * Returns { logged: boolean, action: 'ok'|'warn'|'paused'|'stopped', budget? }
   */
  logAndEnforce(entry) {
    const result = this.costRepo.logUsage(entry);

    if (result.budgetAction) {
      const budget = result.budget;
      const pct = budget.monthlyLimit > 0
        ? ((budget.currentSpend / budget.monthlyLimit) * 100).toFixed(1)
        : '0';

      logger.info('cost-guard.threshold', {
        agentId: entry.agentId,
        action: result.budgetAction,
        spend: budget.currentSpend,
        limit: budget.monthlyLimit,
        pct,
      });

      if (this.emitter) {
        this.emitter.emit('budget:threshold', {
          agentId: entry.agentId,
          action: result.budgetAction,
          budget,
          pct: parseFloat(pct),
        });
      }
    }

    return {
      logged: true,
      action: result.budgetAction || 'ok',
      budget: result.budget,
    };
  }

  /**
   * Get budget summary for an agent.
   */
  getAgentSummary(agentId) {
    const budget = this.costRepo.getBudgetByAgent(agentId);
    if (!budget) return null;

    const pct = budget.monthlyLimit > 0
      ? (budget.currentSpend / budget.monthlyLimit) * 100
      : 0;

    return {
      ...budget,
      spendPct: pct,
      remaining: Math.max(0, budget.monthlyLimit - budget.currentSpend),
      isOverWarn: pct >= budget.warnPct,
      isOverPause: pct >= budget.pausePct,
      isOverStop: pct >= budget.stopPct,
    };
  }
}

module.exports = { CostGuard };
