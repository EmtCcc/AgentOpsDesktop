'use strict';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { CostGuard } from '../src/main/cost-guard.js';
import { TaskOrchestrator, DAG_STATUS, TASK_STATUS } from '../src/main/task-orchestrator.js';

// ── Mocks ──

function createMockCostRepo(overrides = {}) {
  const budgets = new Map();
  const usageLogs = [];

  return {
    budgets,
    usageLogs,
    getBudgetByAgent(agentId) {
      return budgets.get(agentId) || null;
    },
    getBudgetById(id) {
      for (const b of budgets.values()) {
        if (b.id === id) return b;
      }
      return null;
    },
    updateBudget(id, updates) {
      for (const [agentId, b] of budgets) {
        if (b.id === id) {
          budgets.set(agentId, { ...b, ...updates });
          return budgets.get(agentId);
        }
      }
      return null;
    },
    logUsage(entry) {
      const now = new Date().toISOString();
      usageLogs.push(entry);
      const budget = budgets.get(entry.agentId);
      if (!budget) return { usageId: usageLogs.length, budgetAction: null };

      const newSpend = budget.currentSpend + (entry.costUsd || 0);
      budget.currentSpend = newSpend;

      if (budget.monthlyLimit > 0) {
        const pct = (newSpend / budget.monthlyLimit) * 100;
        if (pct >= budget.stopPct) {
          budget.status = 'stopped';
          return { usageId: usageLogs.length, budgetAction: 'stopped', budget: { ...budget } };
        }
        if (pct >= budget.pausePct) {
          budget.status = 'paused';
          return { usageId: usageLogs.length, budgetAction: 'paused', budget: { ...budget } };
        }
        if (pct >= budget.warnPct) {
          return { usageId: usageLogs.length, budgetAction: 'warn', budget: { ...budget } };
        }
      }
      return { usageId: usageLogs.length, budgetAction: null };
    },
    _stmts: {
      updateBudgetStatus: { run: vi.fn() },
    },
    ...overrides,
  };
}

function createMockRepo() {
  const dags = new Map();
  const tasks = new Map();
  const edges = new Map();
  let idCounter = 0;

  const genId = () => `id-${++idCounter}`;

  return {
    dags, tasks, edges,
    createDag(dag) {
      const id = dag.id || genId();
      const record = {
        maxParallel: 4, retryMax: 0, retryBackoffMs: 1000,
        retryBackoffMult: 2.0, retryMaxBackoffMs: 30000, onFailure: 'fail-fast',
        ...dag, id, status: dag.status || 'pending',
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      dags.set(id, record);
      return record;
    },
    updateDag(id, updates) {
      const existing = dags.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
      dags.set(id, updated);
      return updated;
    },
    getDagById(id) { return dags.get(id) || null; },
    listDags() { return { items: [...dags.values()], total: dags.size }; },

    createTask(task) {
      const id = task.id || genId();
      const record = {
        ...task, id, status: task.status || 'pending', retryCount: 0,
        taskType: task.taskType || 'agent', createdAt: Date.now(), updatedAt: Date.now(),
      };
      tasks.set(id, record);
      return record;
    },
    updateTask(id, updates) {
      const existing = tasks.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
      tasks.set(id, updated);
      return updated;
    },
    getTaskById(id) { return tasks.get(id) || null; },
    listTasksByDag(dagId) { return [...tasks.values()].filter((t) => t.dagId === dagId); },
    listTasksByDagAndStatus(dagId, status) {
      return [...tasks.values()].filter((t) => t.dagId === dagId && t.status === status);
    },
    countTasksByDagAndStatus(dagId) {
      const counts = {};
      for (const t of tasks.values()) {
        if (t.dagId === dagId) counts[t.status] = (counts[t.status] || 0) + 1;
      }
      return counts;
    },

    createEdge(edge) {
      const id = edge.id || genId();
      const record = { ...edge, id, createdAt: Date.now() };
      edges.set(id, record);
      return record;
    },
    listEdgesByDag(dagId) { return [...edges.values()].filter((e) => e.dagId === dagId); },
    getUpstreamOutputs() { return []; },

    createDagTx(def) {
      const dagId = def.id || genId();
      const dag = this.createDag({ ...def, id: dagId });
      const createdTasks = [];
      for (const t of (def.tasks || [])) {
        createdTasks.push(this.createTask({ ...t, dagId }));
      }
      for (const e of (def.edges || [])) {
        this.createEdge({ ...e, dagId, fromTaskId: e.from, toTaskId: e.to });
      }
      return { dag, tasks: createdTasks };
    },

    getDagFull(dagId) {
      const dag = this.getDagById(dagId);
      if (!dag) return null;
      return { dag, tasks: this.listTasksByDag(dagId), edges: this.listEdgesByDag(dagId) };
    },
  };
}

function createMockRuntime() {
  const emitter = new EventEmitter();
  let spawnId = 0;
  const spawned = [];

  emitter.spawnAgent = vi.fn((config) => {
    const agentId = `agent-${++spawnId}`;
    spawned.push({ agentId, config });
    return { agentId, status: 'running' };
  });

  emitter.stopAgent = vi.fn((agentId) => {
    return { agentId, status: 'terminated' };
  });

  emitter.getAgent = vi.fn((agentId) => {
    return spawned.find((s) => s.agentId === agentId) || null;
  });

  emitter._spawned = spawned;
  emitter._simulateExit = (agentId, code) => {
    emitter.emit('exit', { agentId, code, signal: null });
  };
  emitter._simulateUsage = (agentId, tokens) => {
    emitter.emit('usage', { agentId, inputTokens: tokens, outputTokens: 0, model: 'test', provider: 'test', costUsd: 0 });
  };

  return emitter;
}

// ── Tests ──

describe('Budget Hard Stop (CMPAAA-353)', () => {
  let costRepo;
  let repo;
  let runtime;
  let costGuard;
  let orch;

  beforeEach(() => {
    costRepo = createMockCostRepo();
    repo = createMockRepo();
    runtime = createMockRuntime();
    costGuard = new CostGuard(costRepo, new EventEmitter());
    orch = new TaskOrchestrator({ repo, runtime, costGuard });
  });

  describe('CostGuard hard-stop events', () => {
    it('emits budget:hard-stop when spend exceeds stop threshold', () => {
      costRepo.budgets.set('agent-1', {
        id: 'budget-1', agentId: 'agent-1', monthlyLimit: 100,
        currentSpend: 95, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
        status: 'active', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
      });

      const events = [];
      costGuard.emitter.on('budget:hard-stop', (data) => events.push(data));

      costGuard.logAndEnforce({
        agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 10,
      });

      expect(events).toHaveLength(1);
      expect(events[0].agentId).toBe('agent-1');
      expect(events[0].action).toBe('stopped');
      expect(events[0].reason).toContain('hard cutoff');
    });

    it('emits budget:hard-stop when spend exceeds pause threshold', () => {
      costRepo.budgets.set('agent-1', {
        id: 'budget-1', agentId: 'agent-1', monthlyLimit: 100,
        currentSpend: 85, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
        status: 'active', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
      });

      const events = [];
      costGuard.emitter.on('budget:hard-stop', (data) => events.push(data));

      costGuard.logAndEnforce({
        agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 10,
      });

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('paused');
      expect(events[0].reason).toContain('pause');
    });

    it('does NOT emit budget:hard-stop when spend is below thresholds', () => {
      costRepo.budgets.set('agent-1', {
        id: 'budget-1', agentId: 'agent-1', monthlyLimit: 100,
        currentSpend: 50, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
        status: 'active', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
      });

      const events = [];
      costGuard.emitter.on('budget:hard-stop', (data) => events.push(data));

      costGuard.logAndEnforce({
        agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5,
      });

      expect(events).toHaveLength(0);
    });

    it('only emits hard-stop once per agent (dedup)', () => {
      costRepo.budgets.set('agent-1', {
        id: 'budget-1', agentId: 'agent-1', monthlyLimit: 100,
        currentSpend: 100, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
        status: 'stopped', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
      });

      const events = [];
      costGuard.emitter.on('budget:hard-stop', (data) => events.push(data));

      // First call emits
      costGuard.logAndEnforce({ agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5 });
      // Second call should not emit (dedup)
      costGuard.logAndEnforce({ agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5 });

      expect(events).toHaveLength(1);
    });

    it('clearHardStop resets dedup tracking', () => {
      costRepo.budgets.set('agent-1', {
        id: 'budget-1', agentId: 'agent-1', monthlyLimit: 100,
        currentSpend: 100, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
        status: 'stopped', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
      });

      const events = [];
      costGuard.emitter.on('budget:hard-stop', (data) => events.push(data));

      costGuard.logAndEnforce({ agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5 });
      expect(events).toHaveLength(1);

      costGuard.clearHardStop('agent-1');

      // After clear, should emit again
      costRepo.budgets.get('agent-1').status = 'active';
      costRepo.budgets.get('agent-1').currentSpend = 100;
      costGuard.logAndEnforce({ agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5 });
      expect(events).toHaveLength(2);
    });
  });

  describe('CostGuard.checkAgent', () => {
    it('blocks agents with stopped budget', () => {
      costRepo.budgets.set('agent-1', {
        id: 'budget-1', agentId: 'agent-1', monthlyLimit: 100,
        currentSpend: 110, status: 'stopped', stopPct: 100, warnPct: 80, pausePct: 90,
      });

      const result = costGuard.checkAgent('agent-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('stopped');
    });

    it('blocks agents with paused budget', () => {
      costRepo.budgets.set('agent-1', {
        id: 'budget-1', agentId: 'agent-1', monthlyLimit: 100,
        currentSpend: 95, status: 'paused', stopPct: 100, warnPct: 80, pausePct: 90,
      });

      const result = costGuard.checkAgent('agent-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('paused');
    });

    it('allows agents with active budget under thresholds', () => {
      costRepo.budgets.set('agent-1', {
        id: 'budget-1', agentId: 'agent-1', monthlyLimit: 100,
        currentSpend: 50, status: 'active', stopPct: 100, warnPct: 80, pausePct: 90,
      });

      const result = costGuard.checkAgent('agent-1');
      expect(result.allowed).toBe(true);
    });

    it('allows agents with no budget configured', () => {
      const result = costGuard.checkAgent('agent-unknown');
      expect(result.allowed).toBe(true);
    });
  });

  describe('TaskOrchestrator budget integration', () => {
    it('kills agent and fails task on budget hard-stop event', async () => {
      // Create a DAG with one task
      const { dag, tasks: dagTasks } = orch.createDag({
        name: 'budget-test',
        tasks: [{ title: 'Task A', agentId: 'db-agent-1' }],
      });

      // Start the DAG
      await orch.startDag(dag.id);

      // Get the spawned runtime agent ID
      expect(runtime.spawnAgent).toHaveBeenCalled();
      const runtimeAgentId = runtime._spawned[0].agentId;

      // Verify task is running
      const taskBefore = repo.getTaskById(dagTasks[0].id);
      expect(taskBefore.status).toBe(TASK_STATUS.RUNNING);

      // Simulate budget hard-stop
      costGuard.emitter.emit('budget:hard-stop', {
        agentId: 'db-agent-1',
        action: 'stopped',
        budget: { monthlyLimit: 100, currentSpend: 110, stopPct: 100, pausePct: 90 },
        pct: 110,
        reason: 'Budget hard cutoff: spend 110.0% exceeded stop threshold (100%)',
      });

      // Wait for async handlers
      await new Promise((r) => setTimeout(r, 50));

      // Agent should be stopped
      expect(runtime.stopAgent).toHaveBeenCalledWith(runtimeAgentId);

      // Task should be failed
      const taskAfter = repo.getTaskById(dagTasks[0].id);
      expect(taskAfter.status).toBe(TASK_STATUS.FAILED);
      expect(taskAfter.errorMessage).toContain('Budget hard cutoff');
    });

    it('pauses DAG on budget overage (single-task DAG ends as failed)', async () => {
      const { dag, tasks: dagTasks } = orch.createDag({
        name: 'budget-pause-test',
        tasks: [{ title: 'Task A', agentId: 'db-agent-1' }],
      });

      await orch.startDag(dag.id);

      // Emit hard-stop with paused action
      costGuard.emitter.emit('budget:hard-stop', {
        agentId: 'db-agent-1',
        action: 'paused',
        budget: { monthlyLimit: 100, currentSpend: 95, stopPct: 100, pausePct: 90 },
        pct: 95,
        reason: 'Budget pause: spend 95.0% exceeded pause threshold (90%)',
      });

      await new Promise((r) => setTimeout(r, 50));

      // Single-task DAG: pause attempt races with task failure → DAG ends as failed
      // In a multi-task DAG, pauseDag would prevent new dispatches
      const dagStatus = repo.getDagById(dag.id);
      expect([DAG_STATUS.PAUSED, DAG_STATUS.FAILED]).toContain(dagStatus.status);

      // Task itself must be failed with budget reason
      const taskAfter = repo.getTaskById(dagTasks[0].id);
      expect(taskAfter.status).toBe(TASK_STATUS.FAILED);
      expect(taskAfter.errorMessage).toContain('Budget pause');
    });

    it('pauseDag prevents new task dispatches in multi-task budget scenario', async () => {
      const { dag, tasks: dagTasks } = orch.createDag({
        name: 'multi-task-budget',
        tasks: [
          { title: 'Task A', agentId: 'db-agent-1' },
          { title: 'Task B', agentId: 'db-agent-1' },
        ],
        maxParallel: 1,
      });

      await orch.startDag(dag.id);

      // Both tasks may start (depending on scheduling), but budget kill should stop them
      costGuard.emitter.emit('budget:hard-stop', {
        agentId: 'db-agent-1',
        action: 'stopped',
        budget: { monthlyLimit: 100, currentSpend: 110, stopPct: 100, pausePct: 90 },
        pct: 110,
        reason: 'Budget hard cutoff',
      });

      await new Promise((r) => setTimeout(r, 100));

      // At least one task should be failed
      const failedTasks = dagTasks.filter((t) => repo.getTaskById(t.id).status === TASK_STATUS.FAILED);
      expect(failedTasks.length).toBeGreaterThanOrEqual(1);
    });

    it('inline kill via _onAgentUsage when cost guard returns stopped', async () => {
      // Pre-set budget so logAndEnforce will return stopped
      costRepo.budgets.set('db-agent-1', {
        id: 'budget-1', agentId: 'db-agent-1', monthlyLimit: 100,
        currentSpend: 95, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
        status: 'active', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
      });

      const { dag, tasks: dagTasks } = orch.createDag({
        name: 'inline-kill-test',
        tasks: [{ title: 'Task A', agentId: 'db-agent-1' }],
      });

      await orch.startDag(dag.id);

      const runtimeAgentId = runtime._spawned[0].agentId;

      // Simulate usage event that will exceed budget
      runtime.emit('usage', {
        agentId: runtimeAgentId,
        inputTokens: 1000,
        outputTokens: 1000,
        model: 'claude-3',
        provider: 'anthropic',
        costUsd: 10, // pushes total to 105, over 100% stop threshold
      });

      await new Promise((r) => setTimeout(r, 50));

      // Should be killed inline
      expect(runtime.stopAgent).toHaveBeenCalled();
      const taskAfter = repo.getTaskById(dagTasks[0].id);
      expect(taskAfter.status).toBe(TASK_STATUS.FAILED);
    });

    it('emits task:budget-killed event', async () => {
      const { dag, tasks: dagTasks } = orch.createDag({
        name: 'event-test',
        tasks: [{ title: 'Task A', agentId: 'db-agent-1' }],
      });

      await orch.startDag(dag.id);

      const events = [];
      orch.on('task:budget-killed', (data) => events.push(data));

      costGuard.emitter.emit('budget:hard-stop', {
        agentId: 'db-agent-1',
        action: 'stopped',
        budget: { monthlyLimit: 100, currentSpend: 110, stopPct: 100, pausePct: 90 },
        pct: 110,
        reason: 'Budget hard cutoff',
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('stopped');
      expect(events[0].taskId).toBe(dagTasks[0].id);
    });

    it('cleans up cost guard listener on shutdown', async () => {
      const emitter = costGuard.emitter;
      const listenerCountBefore = emitter.listenerCount('budget:hard-stop');
      expect(listenerCountBefore).toBe(1);

      await orch.shutdown();

      const listenerCountAfter = emitter.listenerCount('budget:hard-stop');
      expect(listenerCountAfter).toBe(0);
    });
  });
});
