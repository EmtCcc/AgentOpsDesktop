import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { TaskOrchestrator, DAG_STATUS, TASK_STATUS } from '../src/main/task-orchestrator.js';

// ── Mocks ──

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
        maxParallel: 4,
        retryMax: 0,
        retryBackoffMs: 1000,
        retryBackoffMult: 2.0,
        retryMaxBackoffMs: 30000,
        onFailure: 'fail-fast',
        ...dag,
        id,
        status: dag.status || 'pending',
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
      const record = { ...task, id, status: task.status || 'pending', retryCount: 0, taskType: task.taskType || 'agent', createdAt: Date.now(), updatedAt: Date.now() };
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
        if (t.dagId === dagId) {
          counts[t.status] = (counts[t.status] || 0) + 1;
        }
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
    listEdgesByFromTask(taskId) { return [...edges.values()].filter((e) => e.fromTaskId === taskId); },
    listEdgesByToTask(taskId) { return [...edges.values()].filter((e) => e.toTaskId === taskId); },

    getUpstreamOutputs(taskId) {
      const incomingEdges = [...edges.values()].filter((e) => e.toTaskId === taskId);
      const results = [];
      for (const edge of incomingEdges) {
        const task = tasks.get(edge.fromTaskId);
        if (task && task.output) {
          results.push({
            taskId: task.id,
            output: task.output,
            dataKey: edge.dataKey || null,
          });
        }
      }
      return results;
    },

    getDownstreamTasks(taskId) {
      return [...edges.values()].filter((e) => e.fromTaskId === taskId).map((e) => e.toTaskId);
    },

    createDagTx(def) {
      const dagId = def.id || genId();
      const dag = this.createDag({ ...def, id: dagId });
      const createdTasks = [];
      for (const t of (def.tasks || [])) {
        createdTasks.push(this.createTask({ ...t, dagId }));
      }
      const createdEdges = [];
      for (const e of (def.edges || [])) {
        // Resolve numeric indices to __task_N format, then to actual task IDs
        let fromId = e.fromTaskId || e.from;
        let toId = e.toTaskId || e.to;
        if (typeof fromId === 'number') fromId = `__task_${fromId}`;
        if (typeof toId === 'number') toId = `__task_${toId}`;
        if (typeof fromId === 'string' && fromId.startsWith('__task_')) {
          fromId = createdTasks[parseInt(fromId.replace('__task_', ''))].id;
        }
        if (typeof toId === 'string' && toId.startsWith('__task_')) {
          toId = createdTasks[parseInt(toId.replace('__task_', ''))].id;
        }
        createdEdges.push(this.createEdge({ ...e, dagId, fromTaskId: fromId, toTaskId: toId }));
      }
      return { dag, tasks: createdTasks, edges: createdEdges };
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

  emitter._spawned = spawned;
  emitter._simulateExit = (agentId, code, output) => {
    emitter.emit('exit', { agentId, code, signal: null, output: output || null });
  };
  emitter._simulateError = (agentId) => {
    emitter.emit('status-change', { agentId, status: 'errored', from: 'running' });
  };

  return emitter;
}

// ── Tests ──

describe('Task Handoff Logic', () => {
  let repo;
  let runtime;
  let orch;

  beforeEach(() => {
    repo = createMockRepo();
    runtime = createMockRuntime();
    orch = new TaskOrchestrator({ repo, runtime });
  });

  describe('Structured output capture', () => {
    it('should persist output when a task succeeds with output', async () => {
      const { dag, tasks: dagTasks } = repo.createDagTx({
        name: 'test-dag',
        tasks: [{ title: 'Task A', taskType: 'agent' }],
      });

      await orch.startDag(dag.id);

      const agentId = runtime._spawned[0].agentId;
      const output = { result: 'hello', data: [1, 2, 3] };
      runtime._simulateExit(agentId, 0, output);

      const task = repo.getTaskById(dagTasks[0].id);
      expect(task.status).toBe(TASK_STATUS.SUCCEEDED);
      expect(task.output).toEqual(output);
    });

    it('should handle null output on success', async () => {
      const { dag, tasks: dagTasks } = repo.createDagTx({
        name: 'test-dag',
        tasks: [{ title: 'Task A', taskType: 'agent' }],
      });

      await orch.startDag(dag.id);

      const agentId = runtime._spawned[0].agentId;
      runtime._simulateExit(agentId, 0, null);

      const task = repo.getTaskById(dagTasks[0].id);
      expect(task.status).toBe(TASK_STATUS.SUCCEEDED);
      expect(task.output).toBeNull();
    });
  });

  describe('A→B pipeline with output injection', () => {
    it('should inject TASK_INPUT env var when dispatching downstream task', async () => {
      const { dag, tasks: dagTasks } = repo.createDagTx({
        name: 'pipeline-dag',
        tasks: [
          { title: 'Task A', taskType: 'agent' },
          { title: 'Task B', taskType: 'agent' },
        ],
        edges: [{ from: 0, to: 1 }],
      });

      await orch.startDag(dag.id);

      // Task A should be dispatched first
      expect(runtime._spawned).toHaveLength(1);
      expect(runtime._spawned[0].config.env).not.toHaveProperty('TASK_INPUT');

      // Complete Task A with output
      const agentIdA = runtime._spawned[0].agentId;
      const outputA = { extracted: 'data', count: 42 };
      runtime._simulateExit(agentIdA, 0, outputA);
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      // Task B should now be dispatched with TASK_INPUT
      expect(runtime._spawned).toHaveLength(2);
      const configB = runtime._spawned[1].config;
      expect(configB.env).toHaveProperty('TASK_INPUT');
      const taskInput = JSON.parse(configB.env.TASK_INPUT);
      expect(taskInput).toHaveProperty(dagTasks[0].id);
      expect(taskInput[dagTasks[0].id]).toEqual(outputA);
    });

    it('should use dataKey for TASK_INPUT key when edge has dataKey', async () => {
      const { dag, tasks: dagTasks } = repo.createDagTx({
        name: 'pipeline-dag',
        tasks: [
          { title: 'Task A', taskType: 'agent' },
          { title: 'Task B', taskType: 'agent' },
        ],
        edges: [{ from: 0, to: 1, dataKey: 'analysisResult' }],
      });

      await orch.startDag(dag.id);

      const agentIdA = runtime._spawned[0].agentId;
      const outputA = { score: 95 };
      runtime._simulateExit(agentIdA, 0, outputA);
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      expect(runtime._spawned).toHaveLength(2);
      const taskInput = JSON.parse(runtime._spawned[1].config.env.TASK_INPUT);
      expect(taskInput).toHaveProperty('analysisResult');
      expect(taskInput.analysisResult).toEqual(outputA);
    });

    it('should support full A→B pipeline end-to-end', async () => {
      const events = [];
      orch.on('task:succeeded', (e) => events.push({ type: 'task:succeeded', ...e }));
      orch.on('dag:succeeded', (e) => events.push({ type: 'dag:succeeded', ...e }));

      const { dag, tasks: dagTasks } = repo.createDagTx({
        name: 'e2e-pipeline',
        tasks: [
          { title: 'Producer', taskType: 'agent' },
          { title: 'Consumer', taskType: 'agent' },
        ],
        edges: [{ from: 0, to: 1 }],
      });

      await orch.startDag(dag.id);

      // Complete Producer
      const agentA = runtime._spawned[0].agentId;
      runtime._simulateExit(agentA, 0, { items: ['a', 'b', 'c'] });
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      // Complete Consumer
      const agentB = runtime._spawned[1].agentId;
      runtime._simulateExit(agentB, 0, { processed: 3 });
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      // DAG should succeed
      const dagRecord = repo.getDagById(dag.id);
      expect(dagRecord.status).toBe(DAG_STATUS.SUCCEEDED);

      // Both tasks should have output
      expect(repo.getTaskById(dagTasks[0].id).output).toEqual({ items: ['a', 'b', 'c'] });
      expect(repo.getTaskById(dagTasks[1].id).output).toEqual({ processed: 3 });
    });
  });

  describe('Upstream failure blocks downstream', () => {
    it('should not dispatch downstream task when upstream fails', async () => {
      const { dag } = repo.createDagTx({
        name: 'fail-pipeline',
        tasks: [
          { title: 'Task A', taskType: 'agent' },
          { title: 'Task B', taskType: 'agent' },
        ],
        edges: [{ from: 0, to: 1 }],
        onFailure: 'fail-fast',
      });

      await orch.startDag(dag.id);

      // Task A fails
      const agentIdA = runtime._spawned[0].agentId;
      runtime._simulateExit(agentIdA, 1);
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      // Task B should NOT be dispatched (skipped by fail-fast)
      expect(runtime._spawned).toHaveLength(1);

      const dagRecord = repo.getDagById(dag.id);
      expect(dagRecord.status).toBe(DAG_STATUS.FAILED);
    });

    it('should skip downstream in best-effort mode when upstream fails', async () => {
      const { dag, tasks: dagTasks } = repo.createDagTx({
        name: 'best-effort-pipeline',
        tasks: [
          { title: 'Task A', taskType: 'agent' },
          { title: 'Task B', taskType: 'agent' },
          { title: 'Task C', taskType: 'agent' }, // independent
        ],
        edges: [{ from: 0, to: 1 }],
        onFailure: 'best-effort',
      });

      await orch.startDag(dag.id);

      // Task A fails
      const agentIdA = runtime._spawned[0].agentId;
      runtime._simulateExit(agentIdA, 1);
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      // Task B should be skipped, Task C should still run
      expect(runtime._spawned).toHaveLength(2); // A + C

      const taskB = repo.getTaskById(dagTasks[1].id);
      expect(taskB.status).toBe(TASK_STATUS.SKIPPED);

      const taskC = repo.getTaskById(dagTasks[2].id);
      expect(taskC.status).toBe(TASK_STATUS.RUNNING);
    });
  });

  describe('Multi-input convergence', () => {
    it('should wait for all upstream tasks before dispatching downstream', async () => {
      const { dag, tasks: dagTasks } = repo.createDagTx({
        name: 'fan-in-dag',
        tasks: [
          { title: 'Task A', taskType: 'agent' },
          { title: 'Task B', taskType: 'agent' },
          { title: 'Task C (converge)', taskType: 'agent' },
        ],
        edges: [
          { from: 0, to: 2 },
          { from: 1, to: 2 },
        ],
      });

      await orch.startDag(dag.id);

      // A and B should both be dispatched (parallel)
      expect(runtime._spawned).toHaveLength(2);

      // Complete A with output
      runtime._simulateExit(runtime._spawned[0].agentId, 0, { from: 'A' });
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      // C should NOT be dispatched yet (B still running)
      expect(runtime._spawned).toHaveLength(2);

      // Complete B with output
      runtime._simulateExit(runtime._spawned[1].agentId, 0, { from: 'B' });
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      // Now C should be dispatched with both outputs in TASK_INPUT
      expect(runtime._spawned).toHaveLength(3);
      const taskInput = JSON.parse(runtime._spawned[2].config.env.TASK_INPUT);
      expect(Object.keys(taskInput)).toHaveLength(2);
    });
  });

  describe('Edge cases', () => {
    it('should not inject TASK_INPUT when no upstream has output', async () => {
      const { dag } = repo.createDagTx({
        name: 'no-output-pipeline',
        tasks: [
          { title: 'Task A', taskType: 'noop' },
          { title: 'Task B', taskType: 'agent' },
        ],
        edges: [{ from: 0, to: 1 }],
      });

      await orch.startDag(dag.id);

      // A is noop (succeeds immediately with no output), then B is dispatched
      expect(runtime._spawned).toHaveLength(1);
      expect(runtime._spawned[0].config.env).not.toHaveProperty('TASK_INPUT');
    });

    it('should handle noop tasks as upstream', async () => {
      const { dag, tasks: dagTasks } = repo.createDagTx({
        name: 'noop-upstream',
        tasks: [
          { title: 'Noop A', taskType: 'noop' },
          { title: 'Agent B', taskType: 'agent' },
        ],
        edges: [{ from: 0, to: 1 }],
      });

      await orch.startDag(dag.id);
      await new Promise(r => setTimeout(r, 0)); // flush noop completion + scheduling

      // B should be dispatched (noop completed immediately)
      expect(runtime._spawned).toHaveLength(1);

      // Complete B
      runtime._simulateExit(runtime._spawned[0].agentId, 0, { done: true });
      await new Promise(r => setTimeout(r, 0)); // flush async _schedule

      const dagRecord = repo.getDagById(dag.id);
      expect(dagRecord.status).toBe(DAG_STATUS.SUCCEEDED);
    });
  });
});
