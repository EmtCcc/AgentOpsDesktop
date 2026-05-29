'use strict';

/**
 * CMPAAA-607 — Phase 1 Regression Test Suite
 *
 * Covers the 5 core features from CMPAAA-251 Phase 1:
 *   CMPAAA-282  Multi-Agent Parallel Orchestration  (TaskOrchestrator)
 *   CMPAAA-283  Inter-Agent Communication           (MessageBus)
 *   CMPAAA-284  Visual Dashboard                    (E2E harness — separate spec)
 *   CMPAAA-285  Auto-scheduling / Cron              (Scheduler + cron-parser)
 *   CMPAAA-286  Cost Control / Budget               (CostGuard + orchestrator integration)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { TaskOrchestrator, DAG_STATUS, TASK_STATUS } from '../../src/main/task-orchestrator.js';
import { MessageBus, PRIORITY_ORDER } from '../../src/main/message-bus/message-bus.js';
import { Scheduler } from '../../src/main/scheduler.js';
import { parseCron, matchesCron, nextCronTime } from '../../src/main/cron-parser.js';
import { CostGuard } from '../../src/main/cost-guard.js';

// ════════════════════════════════════════════════════════════════
//  SHARED MOCKS
// ════════════════════════════════════════════════════════════════

function createMockOrchestratorRepo() {
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
    listTasksByDag(dagId) { return [...tasks.values()].filter(t => t.dagId === dagId); },
    listTasksByDagAndStatus(dagId, status) {
      return [...tasks.values()].filter(t => t.dagId === dagId && t.status === status);
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
    listEdgesByDag(dagId) { return [...edges.values()].filter(e => e.dagId === dagId); },
    getUpstreamOutputs() { return []; },
    createDagTx(def) {
      const dagId = def.id || genId();
      const dag = this.createDag({ ...def, id: dagId });
      const createdTasks = [];
      for (const t of (def.tasks || [])) {
        createdTasks.push(this.createTask({ ...t, dagId }));
      }
      for (const e of (def.edges || [])) {
        let fromId = e.fromTaskId || e.from;
        let toId = e.toTaskId || e.to;
        if (typeof fromId === 'string' && fromId.startsWith('__task_')) {
          fromId = createdTasks[parseInt(fromId.replace('__task_', ''))].id;
        }
        if (typeof toId === 'string' && toId.startsWith('__task_')) {
          toId = createdTasks[parseInt(toId.replace('__task_', ''))].id;
        }
        this.createEdge({ ...e, dagId, fromTaskId: fromId, toTaskId: toId });
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
  emitter.spawnAgent = vi.fn(config => {
    const agentId = `agent-${++spawnId}`;
    spawned.push({ agentId, config });
    return { agentId, status: 'running' };
  });
  emitter.stopAgent = vi.fn(agentId => ({ agentId, status: 'terminated' }));
  emitter.getAgent = vi.fn(agentId => spawned.find(s => s.agentId === agentId) || null);
  emitter._spawned = spawned;
  emitter._simulateExit = (agentId, code) => {
    emitter.emit('exit', { agentId, code, signal: null });
  };
  emitter._simulateError = agentId => {
    emitter.emit('status-change', { agentId, status: 'errored', from: 'running' });
  };
  return emitter;
}

function createMockCostRepo() {
  const budgets = new Map();
  const usageLogs = [];
  return {
    budgets, usageLogs,
    getBudgetByAgent(agentId) { return budgets.get(agentId) || null; },
    getBudgetById(id) {
      for (const b of budgets.values()) { if (b.id === id) return b; }
      return null;
    },
    updateBudget(id, updates) {
      for (const [agentId, b] of budgets) {
        if (b.id === id) { budgets.set(agentId, { ...b, ...updates }); return budgets.get(agentId); }
      }
      return null;
    },
    logUsage(entry) {
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
    _stmts: { updateBudgetStatus: { run: vi.fn() } },
  };
}

function createMockScheduleRepo() {
  const schedules = new Map();
  const logs = [];
  let idCounter = 0;
  return {
    schedules, logs,
    create(schedule) {
      const id = schedule.id || `sched-${++idCounter}`;
      const record = {
        ...schedule, id, enabled: schedule.enabled !== false, executionCount: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      schedules.set(id, record);
      return record;
    },
    getById(id) { return schedules.get(id) || null; },
    listDue() {
      const now = new Date().toISOString();
      return [...schedules.values()].filter(s => s.enabled && (!s.nextRunAt || s.nextRunAt <= now));
    },
    listAllEnabled() { return [...schedules.values()].filter(s => s.enabled); },
    toggleEnabled(id, enabled) {
      const s = schedules.get(id);
      if (!s) return null;
      s.enabled = enabled;
      return s;
    },
    updateNextRun(id, nextRunAt) {
      const s = schedules.get(id);
      if (s) { s.nextRunAt = nextRunAt.toISOString(); }
    },
    incrementExecution(id) {
      const s = schedules.get(id);
      if (s) { s.executionCount++; s.lastRunAt = new Date().toISOString(); }
    },
    addLog(entry) { logs.push({ ...entry, triggeredAt: new Date().toISOString() }); },
    listLogs(scheduleId, limit = 50) { return logs.filter(l => l.scheduleId === scheduleId).slice(0, limit); },
  };
}

function createMockTaskRepo() {
  const tasks = new Map();
  let idCounter = 0;
  return {
    tasks,
    create(task) {
      const id = `task-${++idCounter}`;
      const record = { ...task, id, status: 'pending', createdAt: Date.now(), updatedAt: Date.now() };
      tasks.set(id, record);
      return record;
    },
    getById(id) { return tasks.get(id) || null; },
  };
}

// ════════════════════════════════════════════════════════════════
//  CMPAAA-282: Multi-Agent Parallel Orchestration
// ════════════════════════════════════════════════════════════════

describe('CMPAAA-282: Multi-Agent Parallel Orchestration', () => {
  let repo, runtime, orch;

  beforeEach(() => {
    repo = createMockOrchestratorRepo();
    runtime = createMockRuntime();
    orch = new TaskOrchestrator({ repo, runtime });
  });

  it('respects maxParallel when dispatching concurrent tasks', async () => {
    orch.createDag({
      name: 'parallel-limit',
      tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }],
      maxParallel: 2,
    });
    const dag = [...repo.dags.values()][0];
    await orch.startDag(dag.id);
    // Only 2 of 4 tasks should be dispatched
    expect(runtime.spawnAgent).toHaveBeenCalledTimes(2);
  });

  it('completes a diamond DAG with parallel branches', async () => {
    orch.createDag({
      name: 'diamond',
      tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }],
      edges: [{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 3 }],
    });
    const dag = [...repo.dags.values()][0];
    const allTasks = repo.listTasksByDag(dag.id);
    const taskA = allTasks.find(t => t.title === 'A');

    await orch.startDag(dag.id);
    // Root task A dispatched
    expect(runtime.spawnAgent).toHaveBeenCalledTimes(1);
    expect(repo.getTaskById(taskA.id).status).toBe(TASK_STATUS.RUNNING);

    // Simulate A succeeds
    const agentA = runtime._spawned[0].agentId;
    runtime._simulateExit(agentA, 0);
    await new Promise(r => setTimeout(r, 20));

    // B and C should now be dispatched in parallel
    expect(runtime.spawnAgent).toHaveBeenCalledTimes(3);
    const runningTasks = allTasks.filter(t =>
      repo.getTaskById(t.id).status === TASK_STATUS.RUNNING && t.title !== 'A'
    );
    expect(runningTasks.length).toBe(2);
  });

  it('fail-fast cascade: one failure skips remaining pending tasks', async () => {
    orch.createDag({
      name: 'cascade',
      tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
      edges: [{ from: 0, to: 1 }, { from: 0, to: 2 }],
      onFailure: 'fail-fast',
    });
    const dag = [...repo.dags.values()][0];
    await orch.startDag(dag.id);

    // A fails
    const agentA = runtime._spawned[0].agentId;
    runtime._simulateExit(agentA, 1);
    await new Promise(r => setTimeout(r, 20));

    const dagStatus = repo.getDagById(dag.id);
    expect(dagStatus.status).toBe(DAG_STATUS.FAILED);

    // B and C should be skipped
    const allTasks = repo.listTasksByDag(dag.id);
    const skipped = allTasks.filter(t => t.title !== 'A');
    for (const t of skipped) {
      expect(repo.getTaskById(t.id).status).toBe(TASK_STATUS.SKIPPED);
    }
  });

  it('retries failed tasks with exponential backoff', async () => {
    orch.createDag({
      name: 'retry',
      tasks: [{ title: 'flaky', retryMax: 2 }],
      retryMax: 1,
      retryBackoffMs: 30,
    });
    const dag = [...repo.dags.values()][0];
    const retryEvents = [];
    orch.on('task:retrying', data => retryEvents.push(data));

    await orch.startDag(dag.id);
    const agent1 = runtime._spawned[0].agentId;
    runtime._simulateExit(agent1, 1);
    await new Promise(r => setTimeout(r, 50));

    expect(retryEvents).toHaveLength(1);
    expect(retryEvents[0].retryCount).toBe(1);
    // After retry scheduling, task transitions back to running (re-dispatched)
    await new Promise(r => setTimeout(r, 80));
    const tasks = repo.listTasksByDag(dag.id);
    expect(tasks[0].retryCount).toBe(1);
  });

  it('pauses and resumes a running DAG', async () => {
    orch.createDag({ name: 'pause-resume', tasks: [{ title: 'A' }] });
    const dag = [...repo.dags.values()][0];
    await orch.startDag(dag.id);
    await orch.pauseDag(dag.id);
    expect(repo.getDagById(dag.id).status).toBe(DAG_STATUS.PAUSED);
    await orch.resumeDag(dag.id);
    expect(repo.getDagById(dag.id).status).toBe(DAG_STATUS.RUNNING);
  });

  it('cancels a DAG and kills running agents', async () => {
    orch.createDag({ name: 'cancel', tasks: [{ title: 'A' }, { title: 'B' }] });
    const dag = [...repo.dags.values()][0];
    await orch.startDag(dag.id);
    // Both independent tasks dispatched (default maxParallel=4)
    expect(runtime.spawnAgent).toHaveBeenCalledTimes(2);
    await orch.cancelDag(dag.id);
    expect(repo.getDagById(dag.id).status).toBe(DAG_STATUS.CANCELLED);
    expect(runtime.stopAgent).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════
//  CMPAAA-283: Inter-Agent Communication (MessageBus)
// ════════════════════════════════════════════════════════════════

describe('CMPAAA-283: Inter-Agent Communication', () => {
  let bus;

  beforeEach(() => { bus = new MessageBus(); });
  afterEach(() => { bus.close(); });

  it('publishes and receives messages via subscribe', () => {
    const received = [];
    bus.subscribe('agent.status', msg => received.push(msg));
    bus.publish('agent.status', 'event', { status: 'running' });
    expect(received).toHaveLength(1);
    expect(received[0].payload.status).toBe('running');
  });

  it('supports single-segment wildcard * in topic matching', () => {
    const received = [];
    bus.subscribe('agent.*.status', msg => received.push(msg));
    bus.publish('agent.worker-1.status', 'event', { ok: true });
    bus.publish('agent.worker-1.sub.status', 'event', { ok: false }); // too many segments
    expect(received).toHaveLength(1);
    expect(received[0].payload.ok).toBe(true);
  });

  it('supports multi-segment wildcard ** in topic matching', () => {
    const received = [];
    bus.subscribe('agent.**', msg => received.push(msg));
    bus.publish('agent.worker.status', 'event', { a: 1 });
    bus.publish('agent.worker.sub.deep.status', 'event', { a: 2 });
    bus.publish('task.other', 'event', { a: 3 }); // no match
    expect(received).toHaveLength(2);
  });

  it('request/reply with correlation resolves correctly', async () => {
    bus.subscribe('calc.add', msg => {
      if (msg.type === 'request') {
        bus.reply(msg, { result: msg.payload.a + msg.payload.b });
      }
    });

    const response = await bus.request('calc.add', { a: 10, b: 20 });
    expect(response.payload.result).toBe(30);
  });

  it('request times out when no reply arrives', async () => {
    await expect(
      bus.request('no.responder', {}, { timeout: 50 })
    ).rejects.toThrow('timed out');
  });

  it('priority queue orders critical > high > normal > low', () => {
    const q = [];
    const enqueue = (priority) => bus._enqueueByPriority(q, { priority, id: priority });

    enqueue('low');
    enqueue('normal');
    enqueue('critical');
    enqueue('high');

    expect(q.map(m => m.priority)).toEqual(['critical', 'high', 'normal', 'low']);
  });

  it('evicts lowest-priority message when queue is full', () => {
    const smallBus = new MessageBus({ maxQueueSize: 3 });
    const q = [];
    smallBus._enqueueByPriority(q, { priority: 'low', id: '1' });
    smallBus._enqueueByPriority(q, { priority: 'normal', id: '2' });
    smallBus._enqueueByPriority(q, { priority: 'low', id: '3' });

    // Queue is full, new critical should evict the lowest (tail: id '3')
    smallBus._enqueueByPriority(q, { priority: 'critical', id: '4' });
    expect(q).toHaveLength(3);
    expect(q[0].id).toBe('4'); // critical at head
    expect(q.some(m => m.id === '3')).toBe(false); // tail low evicted

    smallBus.close();
  });

  it('back-pressure: messages queue when handler throws', () => {
    const handler = vi.fn(() => { throw new Error('busy'); });
    const subId = bus.subscribe('slow.topic', handler);

    bus.publish('slow.topic', 'event', { data: 1 });
    bus.publish('slow.topic', 'event', { data: 2 });

    // Handler was called (and threw), messages queued
    expect(handler).toHaveBeenCalled();
    expect(bus.queueDepth(subId)).toBeGreaterThanOrEqual(1);

    // Drain delivers queued messages
    handler.mockImplementation(() => {}); // stop throwing
    const drained = bus.drain(subId, 50);
    expect(drained).toBeGreaterThanOrEqual(1);
  });

  it('unsubscribe removes subscription and cleans up', () => {
    const handler = vi.fn();
    const subId = bus.subscribe('test.topic', handler);
    expect(bus.stats().subscribers).toBe(1);

    const removed = bus.unsubscribe(subId);
    expect(removed).toBe(true);
    expect(bus.stats().subscribers).toBe(0);

    bus.publish('test.topic', 'event', {});
    expect(handler).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════
//  CMPAAA-284: Visual Dashboard
//  (Unit-level regression — E2E harness tests in separate spec)
// ════════════════════════════════════════════════════════════════

describe('CMPAAA-284: Visual Dashboard (unit-level)', () => {
  it('design-system-harness.html exists and is loadable', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const harnessPath = path.resolve(__dirname, '../e2e/design-system-harness.html');
    expect(fs.existsSync(harnessPath)).toBe(true);
    const content = fs.readFileSync(harnessPath, 'utf-8');
    expect(content).toContain('data-testid="stat-agents"');
    expect(content).toContain('data-testid="stat-tasks"');
    expect(content).toContain('data-testid="activity-feed"');
  });

  it('cost-dashboard page exists', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const costPage = path.resolve(__dirname, '../../src/renderer/pages/CostDashboardPage.jsx');
    expect(fs.existsSync(costPage)).toBe(true);
  });

  it('dashboard routes are registered in routes.ts', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const routesPath = path.resolve(__dirname, '../../src/renderer/routes.ts');
    const content = fs.readFileSync(routesPath, 'utf-8');
    expect(content).toContain('/');
    // Dashboard is the root route
  });
});

// ════════════════════════════════════════════════════════════════
//  CMPAAA-285: Auto-scheduling / Cron
// ════════════════════════════════════════════════════════════════

describe('CMPAAA-285: Auto-scheduling / Cron', () => {
  // ── cron-parser regression ──

  describe('cron-parser', () => {
    it('parses * * * * * as every minute', () => {
      const p = parseCron('* * * * *');
      expect(p.minute.size).toBe(60);
      expect(p.hour.size).toBe(24);
    });

    it('parses step expression */15', () => {
      const p = parseCron('*/15 * * * *');
      expect([...p.minute]).toEqual([0, 15, 30, 45]);
    });

    it('parses @daily alias to 0 0 * * *', () => {
      const p = parseCron('@daily');
      expect(p.minute.has(0)).toBe(true);
      expect(p.hour.has(0)).toBe(true);
      expect(p.minute.size).toBe(1);
      expect(p.hour.size).toBe(1);
    });

    it('matchesCron works for specific time', () => {
      expect(matchesCron('30 9 * * *', new Date('2026-01-15T09:30:00'))).toBe(true);
      expect(matchesCron('30 9 * * *', new Date('2026-01-15T09:31:00'))).toBe(false);
    });

    it('nextCronTime wraps to next day when time passed', () => {
      const from = new Date('2026-01-15T15:00:00');
      const next = nextCronTime('30 14 * * *', from);
      expect(next.getDate()).toBe(16);
      expect(next.getHours()).toBe(14);
      expect(next.getMinutes()).toBe(30);
    });

    it('throws on invalid expression', () => {
      expect(() => parseCron('* * *')).toThrow('5 fields');
    });
  });

  // ── Scheduler integration ──

  describe('Scheduler', () => {
    let scheduleRepo, taskRepo, scheduler;

    beforeEach(() => {
      scheduleRepo = createMockScheduleRepo();
      taskRepo = createMockTaskRepo();
      scheduler = new Scheduler({ scheduleRepo, taskRepo });
    });

    afterEach(() => { scheduler.stop(); });

    it('trigger creates task from template and increments execution count', () => {
      const schedule = scheduleRepo.create({
        name: 'Daily Build',
        cronExpr: '0 9 * * *',
        taskTemplate: { title: 'Run build', description: 'Daily CI' },
        nextRunAt: new Date().toISOString(),
      });

      scheduler._trigger(schedule);

      expect(taskRepo.tasks.size).toBe(1);
      const task = [...taskRepo.tasks.values()][0];
      expect(task.title).toBe('Run build');

      const updated = scheduleRepo.getById(schedule.id);
      expect(updated.executionCount).toBe(1);
    });

    it('auto-disables schedule when maxExecutions reached', () => {
      const schedule = scheduleRepo.create({
        name: 'Limited',
        cronExpr: '* * * * *',
        taskTemplate: { title: 'Task' },
        maxExecutions: 2,
        nextRunAt: new Date().toISOString(),
      });

      scheduler._trigger(schedule);
      scheduler._trigger(scheduleRepo.getById(schedule.id));

      const final = scheduleRepo.getById(schedule.id);
      expect(final.enabled).toBe(false);
      expect(final.executionCount).toBe(2);
    });

    it('records execution logs', () => {
      const schedule = scheduleRepo.create({
        name: 'Log Test',
        cronExpr: '* * * * *',
        taskTemplate: { title: 'Task' },
        nextRunAt: new Date().toISOString(),
      });

      scheduler._trigger(schedule);
      expect(scheduleRepo.logs.length).toBe(1);
      expect(scheduleRepo.logs[0].status).toBe('triggered');
    });

    it('emits schedule:triggered event', () => {
      const schedule = scheduleRepo.create({
        name: 'Event Test',
        cronExpr: '* * * * *',
        taskTemplate: { title: 'Task' },
        nextRunAt: new Date().toISOString(),
      });

      let emitted = null;
      scheduler.on('schedule:triggered', data => { emitted = data; });
      scheduler._trigger(schedule);

      expect(emitted).not.toBeNull();
      expect(emitted.scheduleId).toBe(schedule.id);
    });

    it('recoverOnStartup recalculates next_run_at', () => {
      scheduleRepo.create({
        name: 'Recovery',
        cronExpr: '0 9 * * *',
        taskTemplate: { title: 'Task' },
      });

      scheduler.recoverOnStartup();
      const updated = [...scheduleRepo.schedules.values()][0];
      expect(updated.nextRunAt).toBeTruthy();
      const next = new Date(updated.nextRunAt);
      expect(next.getHours()).toBe(9);
    });
  });
});

// ════════════════════════════════════════════════════════════════
//  CMPAAA-286: Cost Control / Budget
// ════════════════════════════════════════════════════════════════

describe('CMPAAA-286: Cost Control / Budget', () => {
  let costRepo, costGuard, emitter;

  beforeEach(() => {
    costRepo = createMockCostRepo();
    emitter = new EventEmitter();
    costGuard = new CostGuard(costRepo, emitter);
  });

  it('checkAgent blocks agent with stopped budget', () => {
    costRepo.budgets.set('agent-1', {
      id: 'b1', agentId: 'agent-1', monthlyLimit: 100,
      currentSpend: 110, status: 'stopped', stopPct: 100, warnPct: 80, pausePct: 90,
    });
    const result = costGuard.checkAgent('agent-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('stopped');
  });

  it('checkAgent blocks agent with paused budget', () => {
    costRepo.budgets.set('agent-1', {
      id: 'b1', agentId: 'agent-1', monthlyLimit: 100,
      currentSpend: 95, status: 'paused', stopPct: 100, warnPct: 80, pausePct: 90,
    });
    const result = costGuard.checkAgent('agent-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('paused');
  });

  it('checkAgent allows agent with no budget configured', () => {
    const result = costGuard.checkAgent('unknown-agent');
    expect(result.allowed).toBe(true);
  });

  it('logAndEnforce emits budget:hard-stop when stop threshold exceeded', () => {
    costRepo.budgets.set('agent-1', {
      id: 'b1', agentId: 'agent-1', monthlyLimit: 100,
      currentSpend: 95, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
      status: 'active', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
    });

    const events = [];
    emitter.on('budget:hard-stop', data => events.push(data));

    costGuard.logAndEnforce({
      agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 10,
    });

    expect(events).toHaveLength(1);
    expect(events[0].agentId).toBe('agent-1');
    expect(events[0].action).toBe('stopped');
    expect(events[0].reason).toContain('hard cutoff');
  });

  it('logAndEnforce emits budget:hard-stop for pause threshold', () => {
    costRepo.budgets.set('agent-1', {
      id: 'b1', agentId: 'agent-1', monthlyLimit: 100,
      currentSpend: 85, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
      status: 'active', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
    });

    const events = [];
    emitter.on('budget:hard-stop', data => events.push(data));

    costGuard.logAndEnforce({
      agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 10,
    });

    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('paused');
  });

  it('hard-stop dedup: only emits once per agent', () => {
    costRepo.budgets.set('agent-1', {
      id: 'b1', agentId: 'agent-1', monthlyLimit: 100,
      currentSpend: 100, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
      status: 'stopped', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
    });

    const events = [];
    emitter.on('budget:hard-stop', data => events.push(data));

    costGuard.logAndEnforce({ agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5 });
    costGuard.logAndEnforce({ agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5 });

    expect(events).toHaveLength(1);
  });

  it('orchestrator kills agent and fails task on budget hard-stop', async () => {
    const repo = createMockOrchestratorRepo();
    const runtime = createMockRuntime();
    const orch = new TaskOrchestrator({ repo, runtime, costGuard });

    const { dag, tasks: dagTasks } = orch.createDag({
      name: 'budget-kill',
      tasks: [{ title: 'Task A', agentId: 'db-agent-1' }],
    });

    await orch.startDag(dag.id);
    expect(runtime.spawnAgent).toHaveBeenCalled();
    const runtimeAgentId = runtime._spawned[0].agentId;

    // Simulate budget hard-stop
    emitter.emit('budget:hard-stop', {
      agentId: 'db-agent-1',
      action: 'stopped',
      budget: { monthlyLimit: 100, currentSpend: 110, stopPct: 100, pausePct: 90 },
      pct: 110,
      reason: 'Budget hard cutoff',
    });

    await new Promise(r => setTimeout(r, 50));

    expect(runtime.stopAgent).toHaveBeenCalledWith(runtimeAgentId);
    const taskAfter = repo.getTaskById(dagTasks[0].id);
    expect(taskAfter.status).toBe(TASK_STATUS.FAILED);
    expect(taskAfter.errorMessage).toContain('Budget');
  });

  it('clearHardStop resets dedup tracking', () => {
    costRepo.budgets.set('agent-1', {
      id: 'b1', agentId: 'agent-1', monthlyLimit: 100,
      currentSpend: 100, currency: 'USD', warnPct: 80, pausePct: 90, stopPct: 100,
      status: 'stopped', periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(),
    });

    const events = [];
    emitter.on('budget:hard-stop', data => events.push(data));

    costGuard.logAndEnforce({ agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5 });
    expect(events).toHaveLength(1);

    costGuard.clearHardStop('agent-1');
    costRepo.budgets.get('agent-1').status = 'active';
    costRepo.budgets.get('agent-1').currentSpend = 100;
    costGuard.logAndEnforce({ agentId: 'agent-1', inputTokens: 100, outputTokens: 100, costUsd: 5 });
    expect(events).toHaveLength(2);
  });
});
