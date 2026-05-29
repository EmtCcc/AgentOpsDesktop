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
    getUpstreamOutputs(taskId) {
      // Find edges where this task is the target
      const incomingEdges = [...edges.values()].filter((e) => e.toTaskId === taskId);
      return incomingEdges
        .map((e) => {
          const srcTask = tasks.get(e.fromTaskId);
          return {
            taskId: e.fromTaskId,
            output: srcTask?.output_json || null,
            dataKey: e.data_key || e.dataKey || null,
          };
        })
        .filter((o) => o.output != null);
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
        // Resolve from/to shorthand and __task_N references
        let fromId = e.fromTaskId || e.from;
        let toId = e.toTaskId || e.to;
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
  emitter._simulateExit = (agentId, code) => {
    emitter.emit('exit', { agentId, code, signal: null });
  };
  emitter._simulateError = (agentId) => {
    emitter.emit('status-change', { agentId, status: 'errored', from: 'running' });
  };

  return emitter;
}

// ── Tests ──

describe('TaskOrchestrator', () => {
  let repo;
  let runtime;
  let orch;

  beforeEach(() => {
    repo = createMockRepo();
    runtime = createMockRuntime();
    orch = new TaskOrchestrator({ repo, runtime });
  });

  describe('createDag', () => {
    it('should create a simple DAG', () => {
      const result = orch.createDag({
        name: 'test',
        tasks: [{ title: 'A' }, { title: 'B' }],
        edges: [{ from: 0, to: 1 }],
      });

      expect(result.dag.name).toBe('test');
      expect(result.tasks).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('should reject empty tasks', () => {
      expect(() => orch.createDag({ name: 'test', tasks: [] })).toThrow('at least one task');
    });

    it('should reject self-loops', () => {
      expect(() => orch.createDag({
        name: 'test',
        tasks: [{ title: 'A' }],
        edges: [{ from: 0, to: 0 }],
      })).toThrow('self-loop');
    });

    it('should reject cycles', () => {
      expect(() => orch.createDag({
        name: 'test',
        tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
        edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 0 }],
      })).toThrow('Cycle detected');
    });

    it('should accept valid DAG with multiple edges', () => {
      const result = orch.createDag({
        name: 'diamond',
        tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }],
        edges: [{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 3 }],
      });
      expect(result.edges).toHaveLength(4);
    });
  });

  describe('DAG lifecycle', () => {
    it('should start a DAG and dispatch root tasks', async () => {
      orch.createDag({
        name: 'test',
        tasks: [{ title: 'A' }, { title: 'B' }],
        edges: [{ from: 0, to: 1 }],
      });

      const dag = [...repo.dags.values()][0];
      await orch.startDag(dag.id);

      expect(repo.getDagById(dag.id).status).toBe('running');
      expect(runtime.spawnAgent).toHaveBeenCalledTimes(1);
    });

    it('should pause and resume a DAG', async () => {
      orch.createDag({
        name: 'test',
        tasks: [{ title: 'A' }],
      });

      const dag = [...repo.dags.values()][0];
      await orch.startDag(dag.id);
      await orch.pauseDag(dag.id);
      expect(repo.getDagById(dag.id).status).toBe('paused');

      await orch.resumeDag(dag.id);
      expect(repo.getDagById(dag.id).status).toBe('running');
    });

    it('should cancel a DAG', async () => {
      orch.createDag({
        name: 'test',
        tasks: [{ title: 'A' }, { title: 'B' }],
      });

      const dag = [...repo.dags.values()][0];
      await orch.startDag(dag.id);
      await orch.cancelDag(dag.id);

      expect(repo.getDagById(dag.id).status).toBe('cancelled');
    });
  });

  describe('Task execution flow', () => {
    it('should complete a linear DAG end-to-end', async () => {
      orch.createDag({
        name: 'linear',
        tasks: [{ title: 'A' }, { title: 'B' }],
        edges: [{ from: 0, to: 1 }],
      });

      const dag = [...repo.dags.values()][0];
      const allTasks = repo.listTasksByDag(dag.id);
      const taskA = allTasks.find((t) => t.title === 'A');
      const taskB = allTasks.find((t) => t.title === 'B');

      const completedTasks = [];
      orch.on('task:completed', (data) => completedTasks.push(data));
      orch.on('task:running', () => {});

      await orch.startDag(dag.id);

      // Task A should be dispatched
      expect(runtime.spawnAgent).toHaveBeenCalledTimes(1);
      expect(repo.getTaskById(taskA.id).status).toBe('running');

      // Simulate agent A completing
      const agentId = runtime._spawned[0].agentId;
      runtime._simulateExit(agentId, 0);

      // Wait for async scheduling
      await new Promise((r) => setTimeout(r, 10));

      // Task A should be completed, Task B should be dispatched
      expect(repo.getTaskById(taskA.id).status).toBe('succeeded');
      expect(runtime.spawnAgent).toHaveBeenCalledTimes(2);
      expect(repo.getTaskById(taskB.id).status).toBe('running');
    });

    it('should handle noop tasks immediately', async () => {
      orch.createDag({
        name: 'noop-test',
        tasks: [{ title: 'noop-step', taskType: 'noop' }, { title: 'after' }],
        edges: [{ from: 0, to: 1 }],
      });

      const dag = [...repo.dags.values()][0];
      await orch.startDag(dag.id);

      // noop should complete immediately, after should be dispatched
      const tasks = repo.listTasksByDag(dag.id);
      const noopTask = tasks.find((t) => t.taskType === 'noop');
      expect(repo.getTaskById(noopTask.id).status).toBe('succeeded');
      expect(runtime.spawnAgent).toHaveBeenCalledTimes(1);
    });

    it('should emit progress events', async () => {
      orch.createDag({
        name: 'progress-test',
        tasks: [{ title: 'A' }],
      });

      const progressEvents = [];
      orch.on('dag:progress', (data) => progressEvents.push(data));

      const dag = [...repo.dags.values()][0];
      await orch.startDag(dag.id);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('totalTasks');
      expect(progressEvents[0]).toHaveProperty('percentComplete');
    });
  });

  describe('Retry logic', () => {
    it('should retry failed tasks with backoff', async () => {
      orch.createDag({
        name: 'retry-test',
        tasks: [{ title: 'flaky', retryMax: 2 }],
        retryMax: 1,
        retryBackoffMs: 50,
      });

      const dag = [...repo.dags.values()][0];
      const retryEvents = [];
      orch.on('task:retrying', (data) => retryEvents.push(data));

      await orch.startDag(dag.id);

      // First failure
      const agentId1 = runtime._spawned[0].agentId;
      runtime._simulateExit(agentId1, 1);

      await new Promise((r) => setTimeout(r, 20));
      expect(retryEvents).toHaveLength(1);
      expect(retryEvents[0].retryCount).toBe(1);

      // Task should be reset to pending
      const tasks = repo.listTasksByDag(dag.id);
      expect(tasks[0].status).toBe('pending');
    });
  });

  describe('getDagStatus', () => {
    it('should return full status with progress', async () => {
      orch.createDag({
        name: 'status-test',
        tasks: [{ title: 'A' }, { title: 'B' }],
      });

      const dag = [...repo.dags.values()][0];
      const status = orch.getDagStatus(dag.id);

      expect(status.dag.name).toBe('status-test');
      expect(status.tasks).toHaveLength(2);
      expect(status.progress.totalTasks).toBe(2);
      expect(status.progress.percentComplete).toBe(0);
    });

    it('should return null for non-existent DAG', () => {
      expect(orch.getDagStatus('nonexistent')).toBeNull();
    });
  });

  describe('State transitions', () => {
    it('should reject invalid DAG transitions', async () => {
      orch.createDag({ name: 'test', tasks: [{ title: 'A' }] });
      const dag = [...repo.dags.values()][0];

      // Can't pause a pending DAG
      await expect(orch.pauseDag(dag.id)).rejects.toThrow('Invalid DAG transition');
    });

    it('should reject starting an already-running DAG gracefully', async () => {
      orch.createDag({ name: 'test', tasks: [{ title: 'A' }] });
      const dag = [...repo.dags.values()][0];

      await orch.startDag(dag.id);
      // Starting again should be a no-op
      await orch.startDag(dag.id);
      expect(repo.getDagById(dag.id).status).toBe('running');
    });
  });

  describe('Concurrency control', () => {
    it('should respect maxParallel', async () => {
      orch.createDag({
        name: 'parallel-test',
        tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
        maxParallel: 2,
      });

      const dag = [...repo.dags.values()][0];
      await orch.startDag(dag.id);

      // Should only dispatch 2 tasks (maxParallel=2)
      expect(runtime.spawnAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Agent failure handling', () => {
    it('should fail task when agent exits non-zero', async () => {
      orch.createDag({
        name: 'fail-test',
        tasks: [{ title: 'A' }],
      });

      const dag = [...repo.dags.values()][0];
      const failedEvents = [];
      orch.on('task:failed', (data) => failedEvents.push(data));

      await orch.startDag(dag.id);

      const agentId = runtime._spawned[0].agentId;
      runtime._simulateExit(agentId, 1);

      await new Promise((r) => setTimeout(r, 10));

      expect(failedEvents).toHaveLength(1);
      expect(repo.getTaskById(repo.listTasksByDag(dag.id)[0].id).status).toBe('failed');
    });

    it('should fail task when agent errors', async () => {
      orch.createDag({
        name: 'error-test',
        tasks: [{ title: 'A' }],
      });

      const dag = [...repo.dags.values()][0];
      await orch.startDag(dag.id);

      const agentId = runtime._spawned[0].agentId;
      runtime._simulateError(agentId);

      await new Promise((r) => setTimeout(r, 10));

      expect(repo.getTaskById(repo.listTasksByDag(dag.id)[0].id).status).toBe('failed');
    });
  });

  describe('Events', () => {
    it('should emit dag:created on creation', () => {
      const events = [];
      orch.on('dag:created', (data) => events.push(data));

      orch.createDag({ name: 'test', tasks: [{ title: 'A' }] });
      expect(events).toHaveLength(1);
      expect(events[0].dag.name).toBe('test');
    });

    it('should emit dag:started on start', async () => {
      orch.createDag({ name: 'test', tasks: [{ title: 'A' }] });
      const dag = [...repo.dags.values()][0];

      const events = [];
      orch.on('dag:started', (data) => events.push(data));

      await orch.startDag(dag.id);
      expect(events).toHaveLength(1);
    });
  });

  describe('Squad leader-only spawn', () => {
    function createMockSquadRepo(members, instructions) {
      return {
        getById: (id) => ({ id, name: 'test-squad', leaderId: members[0]?.agentId, instructions }),
        getSquadWithMembers: (id) => ({
          id, name: 'test-squad', leaderId: members[0]?.agentId, instructions,
          members,
        }),
        listMembers: () => members,
      };
    }

    it('should spawn only the leader, not a random member', async () => {
      const members = [
        { squadId: 'sq1', agentId: 'leader-1', role: 'leader' },
        { squadId: 'sq1', agentId: 'member-1', role: 'member' },
        { squadId: 'sq1', agentId: 'member-2', role: 'member' },
      ];
      const squadRepo = createMockSquadRepo(members, 'Do the thing');
      orch = new TaskOrchestrator({ repo, runtime, squadRepo });

      orch.createDag({
        name: 'test',
        tasks: [{ title: 'SquadTask', squadId: 'sq1' }],
      });
      const dag = [...repo.dags.values()][0];

      await orch.startDag(dag.id);
      await new Promise((r) => setTimeout(r, 10));

      // Only one agent should be spawned
      expect(runtime._spawned).toHaveLength(1);
      // It must be the leader
      const task = repo.listTasksByDag(dag.id)[0];
      expect(task.agentId).toBe('leader-1');
    });

    it('should inject roster and instructions into spawn env', async () => {
      const members = [
        { squadId: 'sq1', agentId: 'leader-1', role: 'leader' },
        { squadId: 'sq1', agentId: 'member-1', role: 'member' },
      ];
      const squadRepo = createMockSquadRepo(members, 'Build the widget');
      orch = new TaskOrchestrator({ repo, runtime, squadRepo });

      orch.createDag({
        name: 'test',
        tasks: [{ title: 'SquadTask', squadId: 'sq1' }],
      });
      const dag = [...repo.dags.values()][0];

      await orch.startDag(dag.id);
      await new Promise((r) => setTimeout(r, 10));

      const spawned = runtime._spawned[0];
      expect(spawned.config.env.AGENT_ROSTER).toBeDefined();
      const roster = JSON.parse(spawned.config.env.AGENT_ROSTER);
      expect(roster).toHaveLength(2);
      expect(roster[0]).toEqual({ agentId: 'leader-1', role: 'leader' });
      expect(roster[1]).toEqual({ agentId: 'member-1', role: 'member' });
      expect(spawned.config.env.AGENT_ROLE).toBe('leader');
      expect(spawned.config.env.AGENT_SQUAD_INSTRUCTIONS).toBe('Build the widget');
      expect(spawned.config.squadId).toBe('sq1');
      expect(spawned.config.instructions).toBe('Build the widget');
    });

    it('should fall back to first member if no leader role found', async () => {
      const members = [
        { squadId: 'sq1', agentId: 'alpha', role: 'member' },
        { squadId: 'sq1', agentId: 'beta', role: 'member' },
      ];
      const squadRepo = createMockSquadRepo(members);
      orch = new TaskOrchestrator({ repo, runtime, squadRepo });

      orch.createDag({
        name: 'test',
        tasks: [{ title: 'SquadTask', squadId: 'sq1' }],
      });
      const dag = [...repo.dags.values()][0];

      await orch.startDag(dag.id);
      await new Promise((r) => setTimeout(r, 10));

      const task = repo.listTasksByDag(dag.id)[0];
      expect(task.agentId).toBe('alpha'); // first member as fallback
    });

    it('should fail task if squad has no members', async () => {
      const squadRepo = createMockSquadRepo([]);
      orch = new TaskOrchestrator({ repo, runtime, squadRepo });

      orch.createDag({
        name: 'test',
        tasks: [{ title: 'SquadTask', squadId: 'sq1' }],
      });
      const dag = [...repo.dags.values()][0];

      await orch.startDag(dag.id);
      await new Promise((r) => setTimeout(r, 10));

      const task = repo.listTasksByDag(dag.id)[0];
      expect(task.status).toBe('failed');
      expect(task.errorMessage).toContain('no members');
    });

    it('should emit task:squad-resolved with role=leader', async () => {
      const members = [
        { squadId: 'sq1', agentId: 'leader-1', role: 'leader' },
      ];
      const squadRepo = createMockSquadRepo(members);
      orch = new TaskOrchestrator({ repo, runtime, squadRepo });

      orch.createDag({
        name: 'test',
        tasks: [{ title: 'SquadTask', squadId: 'sq1' }],
      });
      const dag = [...repo.dags.values()][0];

      const events = [];
      orch.on('task:squad-resolved', (data) => events.push(data));

      await orch.startDag(dag.id);
      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect(events[0].agentId).toBe('leader-1');
      expect(events[0].role).toBe('leader');
      expect(events[0].squadId).toBe('sq1');
    });
  });
});
