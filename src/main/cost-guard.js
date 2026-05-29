'use strict';

const logger = require('./logger');

/**
 * Budget enforcement guard.
 * Checks agent budgets before task execution and applies pause/stop actions.
 *
 * Hard cutoff: when an agent's spend exceeds stopPct, CostGuard emits
 * 'budget:hard-stop' which the TaskOrchestrator listens for to kill the
 * agent process and pause the task. This is a system-level guarantee,
 * distinct from Paperclip's soft policy-based approach.
 */
class CostGuard {
  /**
   * @param {import('./repositories/cost.repository').CostRepository} costRepo
   * @param {EventEmitter} [emitter] — optional emitter for budget events
   */
  constructor(costRepo, emitter) {
    this.costRepo = costRepo;
    this.emitter = emitter;
    // Track which agents have already been hard-stopped to avoid double-kill
    this._hardStoppedAgents = new Set();
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
   *
   * When action is 'stopped' or 'paused', emits 'budget:hard-stop' so the
   * orchestrator can kill the agent process immediately.
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

        // Hard cutoff: kill agent process when budget is exceeded
        if (result.budgetAction === 'stopped' || result.budgetAction === 'paused') {
          if (!this._hardStoppedAgents.has(entry.agentId)) {
            this._hardStoppedAgents.add(entry.agentId);
            const reason = result.budgetAction === 'stopped'
              ? `Budget hard cutoff: spend at ${pct}% exceeded stop threshold (${budget.stopPct}%)`
              : `Budget pause: spend at ${pct}% exceeded pause threshold (${budget.pausePct}%)`;

            this.emitter.emit('budget:hard-stop', {
              agentId: entry.agentId,
              action: result.budgetAction,
              budget,
              pct: parseFloat(pct),
              reason,
            });

            logger.warn('cost-guard.hard-stop', {
              agentId: entry.agentId,
              action: result.budgetAction,
              pct,
              reason,
            });
          }
        }
      }
    }

    return {
      logged: true,
      action: result.budgetAction || 'ok',
      budget: result.budget,
    };
  }

  /**
   * Clear hard-stop tracking for an agent (e.g. after budget reset).
   */
  clearHardStop(agentId) {
    this._hardStoppedAgents.delete(agentId);
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
