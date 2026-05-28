'use strict';

const { EventEmitter } = require('events');
const logger = require('./logger');

// ── Status constants ──

const DAG_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
};

const TASK_STATUS = {
  PENDING: 'pending',
  READY: 'ready',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
};

const VALID_DAG_TRANSITIONS = {
  [DAG_STATUS.PENDING]:   [DAG_STATUS.RUNNING, DAG_STATUS.CANCELLED],
  [DAG_STATUS.RUNNING]:   [DAG_STATUS.SUCCEEDED, DAG_STATUS.FAILED, DAG_STATUS.CANCELLED, DAG_STATUS.PAUSED],
  [DAG_STATUS.PAUSED]:    [DAG_STATUS.RUNNING, DAG_STATUS.CANCELLED],
  [DAG_STATUS.SUCCEEDED]: [],
  [DAG_STATUS.FAILED]:    [],
  [DAG_STATUS.CANCELLED]: [],
};

const VALID_TASK_TRANSITIONS = {
  [TASK_STATUS.PENDING]:   [TASK_STATUS.READY, TASK_STATUS.CANCELLED, TASK_STATUS.SKIPPED],
  [TASK_STATUS.READY]:     [TASK_STATUS.RUNNING, TASK_STATUS.CANCELLED, TASK_STATUS.SKIPPED],
  [TASK_STATUS.RUNNING]:   [TASK_STATUS.SUCCEEDED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED],
  [TASK_STATUS.SUCCEEDED]: [],
  [TASK_STATUS.FAILED]:    [TASK_STATUS.SKIPPED],
  [TASK_STATUS.SKIPPED]:   [],
  [TASK_STATUS.CANCELLED]: [],
};

/**
 * Task Orchestrator — DAG-based task execution engine.
 *
 * Manages task dependency graphs, schedules parallel execution,
 * handles retries with exponential backoff, and tracks state.
 */
class TaskOrchestrator extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {import('./repositories/orchestrator.repository').OrchestratorRepository} opts.repo
   * @param {import('./agent-runtime').AgentRuntime} opts.runtime
   */
  constructor({ repo, runtime }) {
    super();
    this.repo = repo;
    this.runtime = runtime;

    // In-memory execution state per active DAG
    this._dags = new Map(); // dagId -> DagContext
    // Per-DAG serialization (promise chain)
    this._dagLocks = new Map(); // dagId -> Promise
    // Reverse lookup: agentRuntimeId -> { dagId, taskId }
    this._agentTaskMap = new Map();

    // Bind runtime event handlers
    if (this.runtime) {
      this._onAgentExit = this._onAgentExit.bind(this);
      this._onAgentStatusChange = this._onAgentStatusChange.bind(this);
      this.runtime.on('exit', this._onAgentExit);
      this.runtime.on('status-change', this._onAgentStatusChange);
    }
  }

  // ── State machine helpers ──

  _validateDagTransition(current, next) {
    const allowed = VALID_DAG_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      throw new Error(`Invalid DAG transition: ${current} -> ${next}`);
    }
  }

  _validateTaskTransition(current, next) {
    const allowed = VALID_TASK_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      throw new Error(`Invalid task transition: ${current} -> ${next}`);
    }
  }

  // ── DAG creation ──

  /**
   * Create a DAG from a definition.
   * @param {Object} definition
   * @param {string} definition.name
   * @param {string} [definition.description]
   * @param {Array} definition.tasks - [{ title, description?, taskType?, agentConfig?, retryMax? }]
   * @param {Array} [definition.edges] - [{ from, to, edgeType?, dataKey? }] (task indices or IDs)
   * @param {number} [definition.maxParallel=4]
   * @param {number} [definition.retryMax=0]
   * @param {string} [definition.onFailure='fail-fast']
   * @returns {Object} Created DAG with tasks and edges
   */
  createDag(definition) {
    const { tasks = [], edges = [] } = definition;

    if (tasks.length === 0) {
      throw new Error('DAG must have at least one task');
    }

    // Assign temporary IDs for edge resolution
    const taskIds = tasks.map((t, i) => t.id || `__task_${i}`);

    // Validate and resolve edges
    const resolvedEdges = edges.map((e, i) => {
      const fromId = typeof e.from === 'number' ? taskIds[e.from] : e.from;
      const toId = typeof e.to === 'number' ? taskIds[e.to] : e.to;

      if (!fromId || !toId) {
        throw new Error(`Edge ${i}: invalid from/to reference`);
      }
      if (!taskIds.includes(fromId)) {
        throw new Error(`Edge ${i}: from task "${fromId}" not found`);
      }
      if (!taskIds.includes(toId)) {
        throw new Error(`Edge ${i}: to task "${toId}" not found`);
      }
      if (fromId === toId) {
        throw new Error(`Edge ${i}: self-loop detected`);
      }

      return { fromTaskId: fromId, toTaskId: toId, edgeType: e.edgeType || 'dependency', dataKey: e.dataKey || null };
    });

    // Cycle detection via Kahn's algorithm
    const cycleResult = this._detectCycle(taskIds, resolvedEdges);
    if (cycleResult.hasCycle) {
      throw new Error(`Cycle detected in DAG: ${cycleResult.cyclePath.join(' -> ')}`);
    }

    // Persist via transaction
    const result = this.repo.createDagTx({
      ...definition,
      tasks: tasks.map((t, i) => ({ ...t, id: taskIds[i] })),
      edges: resolvedEdges,
    });

    this.emit('dag:created', { dagId: result.dag.id, dag: result.dag });
    logger.info('orchestrator.dag-created', { dagId: result.dag.id, taskCount: result.tasks.length });

    return result;
  }

  // ── Graph analysis ──

  /**
   * Detect cycles using Kahn's algorithm.
   * @returns {{ hasCycle: boolean, cyclePath?: string[] }}
   */
  _detectCycle(taskIds, edges) {
    const inDegree = new Map();
    const adjacency = new Map();

    for (const id of taskIds) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    for (const edge of edges) {
      adjacency.get(edge.fromTaskId).push(edge.toTaskId);
      inDegree.set(edge.toTaskId, (inDegree.get(edge.toTaskId) || 0) + 1);
    }

    // Kahn's algorithm
    const queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted = [];
    while (queue.length > 0) {
      const node = queue.shift();
      sorted.push(node);
      for (const neighbor of adjacency.get(node)) {
        const newDeg = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    if (sorted.length === taskIds.length) {
      return { hasCycle: false };
    }

    // Find a node involved in the cycle for the error message
    const cycleNodes = taskIds.filter((id) => !sorted.includes(id));
    return { hasCycle: true, cyclePath: cycleNodes };
  }

  /**
   * Build in-memory DagContext from DB state.
   */
  _buildGraph(dagId) {
    const tasks = this.repo.listTasksByDag(dagId);
    const edges = this.repo.listEdgesByDag(dagId);

    const adjacency = new Map(); // taskId -> Set<dependentTaskId>
    const inDegree = new Map();  // taskId -> unresolved dependency count

    for (const task of tasks) {
      adjacency.set(task.id, new Set());
      inDegree.set(task.id, 0);
    }

    for (const edge of edges) {
      adjacency.get(edge.fromTaskId).add(edge.toTaskId);
      inDegree.set(edge.toTaskId, (inDegree.get(edge.toTaskId) || 0) + 1);
    }

    // Subtract already-completed dependencies
    const completedStatuses = new Set([TASK_STATUS.SUCCEEDED, TASK_STATUS.SKIPPED]);
    for (const task of tasks) {
      if (completedStatuses.has(task.status)) {
        for (const dependent of adjacency.get(task.id) || []) {
          inDegree.set(dependent, inDegree.get(dependent) - 1);
        }
      }
    }

    const dag = this.repo.getDagById(dagId);
    return {
      dagId,
      adjacency,
      inDegree,
      taskAgentMap: new Map(), // taskId -> agentRuntimeId
      config: {
        maxParallel: dag.maxParallel,
        retryMax: dag.retryMax,
        retryBackoffMs: dag.retryBackoffMs,
        retryBackoffMult: dag.retryBackoffMult,
        retryMaxBackoffMs: dag.retryMaxBackoffMs,
        onFailure: dag.onFailure,
      },
      dag,
    };
  }

  /**
   * Get tasks ready for execution (in-degree 0 and pending).
   */
  _getReadyTasks(ctx) {
    const ready = [];
    for (const [taskId, deg] of ctx.inDegree) {
      if (deg === 0) {
        const task = this.repo.getTaskById(taskId);
        if (task && task.status === TASK_STATUS.PENDING) {
          ready.push(taskId);
        }
      }
    }
    return ready;
  }

  // ── DAG lifecycle ──

  /**
   * Start executing a DAG.
   */
  async startDag(dagId) {
    const dag = this.repo.getDagById(dagId);
    if (!dag) throw new Error(`DAG not found: ${dagId}`);

    const current = dag.status;
    if (current === DAG_STATUS.RUNNING) return dag;
    this._validateDagTransition(current, DAG_STATUS.RUNNING);

    // Update DAG status
    this.repo.updateDag(dagId, { status: DAG_STATUS.RUNNING, startedAt: Date.now() });
    this.emit('dag:started', { dagId });
    logger.info('orchestrator.dag-started', { dagId });

    // Build in-memory graph
    const ctx = this._buildGraph(dagId);
    this._dags.set(dagId, ctx);

    // Schedule initial ready tasks
    await this._schedule(dagId);
  }

  /**
   * Pause a running DAG. Running tasks continue, no new dispatches.
   */
  async pauseDag(dagId) {
    const dag = this.repo.getDagById(dagId);
    if (!dag) throw new Error(`DAG not found: ${dagId}`);

    this._validateDagTransition(dag.status, DAG_STATUS.PAUSED);
    this.repo.updateDag(dagId, { status: DAG_STATUS.PAUSED });
    this.emit('dag:paused', { dagId });
    logger.info('orchestrator.dag-paused', { dagId });
  }

  /**
   * Resume a paused DAG.
   */
  async resumeDag(dagId) {
    const dag = this.repo.getDagById(dagId);
    if (!dag) throw new Error(`DAG not found: ${dagId}`);

    this._validateDagTransition(dag.status, DAG_STATUS.RUNNING);
    this.repo.updateDag(dagId, { status: DAG_STATUS.RUNNING });
    this.emit('dag:resumed', { dagId });
    logger.info('orchestrator.dag-resumed', { dagId });

    // Rebuild context if needed and schedule
    if (!this._dags.has(dagId)) {
      const ctx = this._buildGraph(dagId);
      this._dags.set(dagId, ctx);
    }
    await this._schedule(dagId);
  }

  /**
   * Cancel a DAG. Kill running agents, cancel pending tasks.
   */
  async cancelDag(dagId) {
    const dag = this.repo.getDagById(dagId);
    if (!dag) throw new Error(`DAG not found: ${dagId}`);

    if (dag.status === DAG_STATUS.SUCCEEDED || dag.status === DAG_STATUS.FAILED || dag.status === DAG_STATUS.CANCELLED) {
      throw new Error(`Cannot cancel DAG in status: ${dag.status}`);
    }

    // Kill running agents
    const ctx = this._dags.get(dagId);
    if (ctx) {
      for (const [_taskId, agentRuntimeId] of ctx.taskAgentMap) {
        try {
          this.runtime.stopAgent(agentRuntimeId);
        } catch (err) {
          logger.warn('orchestrator.kill-agent-failed', { agentRuntimeId, error: err.message });
        }
        this._agentTaskMap.delete(agentRuntimeId);
      }
    }

    // Cancel all non-terminal tasks
    const tasks = this.repo.listTasksByDag(dagId);
    const terminalStatuses = new Set([TASK_STATUS.SUCCEEDED, TASK_STATUS.FAILED, TASK_STATUS.SKIPPED, TASK_STATUS.CANCELLED]);
    for (const task of tasks) {
      if (!terminalStatuses.has(task.status)) {
        this.repo.updateTask(task.id, {
          status: TASK_STATUS.CANCELLED,
          completedAt: Date.now(),
        });
        this.emit('task:cancelled', { dagId, taskId: task.id });
      }
    }

    this.repo.updateDag(dagId, { status: DAG_STATUS.CANCELLED, completedAt: Date.now() });
    this._dags.delete(dagId);
    this._dagLocks.delete(dagId);
    this.emit('dag:cancelled', { dagId });
    logger.info('orchestrator.dag-cancelled', { dagId });
  }

  /**
   * Get full DAG status with progress.
   */
  getDagStatus(dagId) {
    const full = this.repo.getDagFull(dagId);
    if (!full) return null;

    const counts = this.repo.countTasksByDagAndStatus(dagId);
    const total = full.tasks.length;
    const completed = (counts.succeeded || 0) + (counts.skipped || 0);
    const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      ...full,
      progress: {
        totalTasks: total,
        completedTasks: counts.succeeded || 0,
        failedTasks: counts.failed || 0,
        skippedTasks: counts.skipped || 0,
        runningTasks: counts.running || 0,
        pendingTasks: counts.pending || 0,
        percentComplete,
      },
    };
  }

  // ── Scheduling ──

  /**
   * Core scheduling loop. Serialized per DAG via promise chain.
   */
  async _schedule(dagId) {
    const prevLock = this._dagLocks.get(dagId) || Promise.resolve();
    const lock = prevLock.then(() => this._doSchedule(dagId));
    this._dagLocks.set(dagId, lock.catch(() => {}));
    return lock;
  }

  async _doSchedule(dagId) {
    const ctx = this._dags.get(dagId);
    if (!ctx) return;

    const dag = this.repo.getDagById(dagId);
    if (!dag || dag.status !== DAG_STATUS.RUNNING) return;

    // Count currently running tasks
    const counts = this.repo.countTasksByDagAndStatus(dagId);
    const runningCount = counts.running || 0;
    const availableSlots = ctx.config.maxParallel - runningCount;

    if (availableSlots <= 0) return;

    // Get ready tasks
    const readyTasks = this._getReadyTasks(ctx);
    const toDispatch = readyTasks.slice(0, availableSlots);

    for (const taskId of toDispatch) {
      await this._dispatchTask(dagId, taskId);
    }

    // Check if DAG is terminal
    await this._checkDagCompletion(dagId);
  }

  /**
   * Check if a DAG has reached a terminal state.
   */
  async _checkDagCompletion(dagId) {
    const ctx = this._dags.get(dagId);
    if (!ctx) return;

    const counts = this.repo.countTasksByDagAndStatus(dagId);
    const total = this.repo.listTasksByDag(dagId).length;
    const terminal = (counts.succeeded || 0) + (counts.failed || 0) + (counts.skipped || 0) + (counts.cancelled || 0);

    if (terminal < total) return; // Still have work to do

    const failedCount = counts.failed || 0;
    const newStatus = failedCount > 0 ? DAG_STATUS.FAILED : DAG_STATUS.SUCCEEDED;

    this.repo.updateDag(dagId, { status: newStatus, completedAt: Date.now() });
    this._dags.delete(dagId);
    this._dagLocks.delete(dagId);

    this.emit(`dag:${newStatus}`, { dagId });
    this._emitProgress(dagId);
    logger.info(`orchestrator.dag-${newStatus}`, { dagId });
  }

  /**
   * Dispatch a single task for execution.
   */
  async _dispatchTask(dagId, taskId) {
    const ctx = this._dags.get(dagId);
    if (!ctx) return;

    const task = this.repo.getTaskById(taskId);
    if (!task || task.status !== TASK_STATUS.PENDING) return;

    // Transition: pending -> ready -> running
    this.repo.updateTask(taskId, { status: TASK_STATUS.RUNNING, startedAt: Date.now() });
    this.emit('task:running', { dagId, taskId });
    this._emitProgress(dagId);

    const taskType = task.taskType || 'agent';

    if (taskType === 'noop') {
      // No-op tasks succeed immediately
      await this._completeTask(dagId, taskId, TASK_STATUS.SUCCEEDED, null);
      return;
    }

    if (taskType === 'manual') {
      // Manual tasks wait for external completion
      this.emit('task:waiting-external', { dagId, taskId });
      logger.info('orchestrator.manual-task-waiting', { dagId, taskId });
      return;
    }

    // Agent task — spawn via runtime
    if (!this.runtime) {
      await this._completeTask(dagId, taskId, TASK_STATUS.FAILED, null, 'No agent runtime available');
      return;
    }

    try {
      const config = task.agentConfig || {};
      const result = this.runtime.spawnAgent({
        execPath: config.execPath,
        args: config.args || [],
        cwd: config.cwd || process.cwd(),
        env: config.env || {},
        label: config.label || task.title,
        resourceLimits: config.resourceLimits,
        recovery: config.recovery,
      });

      ctx.taskAgentMap.set(taskId, result.agentId);
      this._agentTaskMap.set(result.agentId, { dagId, taskId });
      this.emit('task:dispatched', { dagId, taskId, agentId: result.agentId });
      logger.info('orchestrator.task-dispatched', { dagId, taskId, agentId: result.agentId });
    } catch (err) {
      await this._completeTask(dagId, taskId, TASK_STATUS.FAILED, null, err.message);
    }
  }

  /**
   * Complete a task and handle downstream effects.
   */
  async _completeTask(dagId, taskId, status, output, error) {
    const ctx = this._dags.get(dagId);

    // Persist task completion
    this.repo.updateTask(taskId, {
      status,
      output: output || null,
      errorMessage: error || null,
      completedAt: Date.now(),
    });

    // Clean up agent mapping
    if (ctx) {
      const agentRuntimeId = ctx.taskAgentMap.get(taskId);
      if (agentRuntimeId) {
        this._agentTaskMap.delete(agentRuntimeId);
        ctx.taskAgentMap.delete(taskId);
      }
    }

    this.emit(`task:${status}`, { dagId, taskId, output, error });
    this._emitProgress(dagId);

    if (status === TASK_STATUS.SUCCEEDED) {
      // Unblock dependents
      if (ctx) {
        const dependents = ctx.adjacency.get(taskId) || new Set();
        for (const depTaskId of dependents) {
          const currentDeg = ctx.inDegree.get(depTaskId) || 0;
          ctx.inDegree.set(depTaskId, Math.max(0, currentDeg - 1));
        }
      }
      // Fire-and-forget: don't await — avoids deadlock when called from _doSchedule (noop path)
      this._schedule(dagId).catch((err) => {
        logger.error('orchestrator.post-complete-schedule-failed', { dagId, taskId, error: err.message });
      });
    } else if (status === TASK_STATUS.FAILED) {
      await this._handleTaskFailure(dagId, taskId, error);
    }
  }

  /**
   * Handle task failure: retry or cascade.
   */
  async _handleTaskFailure(dagId, taskId, _error) {
    const task = this.repo.getTaskById(taskId);
    const ctx = this._dags.get(dagId);
    if (!ctx) return;

    // Check retries
    const taskRetryMax = task.retryMax ?? ctx.config.retryMax;
    if (task.retryCount < taskRetryMax) {
      const newRetryCount = task.retryCount + 1;
      const backoff = Math.min(
        ctx.config.retryBackoffMs * Math.pow(ctx.config.retryBackoffMult, newRetryCount - 1),
        ctx.config.retryMaxBackoffMs,
      );

      this.repo.updateTask(taskId, {
        status: TASK_STATUS.PENDING,
        retryCount: newRetryCount,
        errorMessage: null,
        completedAt: null,
      });

      this.emit('task:retrying', { dagId, taskId, retryCount: newRetryCount, backoffMs: backoff });
      logger.info('orchestrator.task-retrying', { dagId, taskId, retryCount: newRetryCount, backoffMs: backoff });

      // Schedule retry after backoff
      setTimeout(() => {
        this._schedule(dagId).catch((err) => {
          logger.error('orchestrator.retry-schedule-failed', { dagId, taskId, error: err.message });
        });
      }, backoff);
      return;
    }

    // Retries exhausted — cascade failure
    if (ctx.config.onFailure === 'fail-fast') {
      // Cancel all pending/ready tasks
      const tasks = this.repo.listTasksByDag(dagId);
      for (const t of tasks) {
        if (t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.READY) {
          this.repo.updateTask(t.id, { status: TASK_STATUS.SKIPPED, completedAt: Date.now() });
          this.emit('task:skipped', { dagId, taskId: t.id });
        }
      }
      // DAG fails
      this.repo.updateDag(dagId, { status: DAG_STATUS.FAILED, completedAt: Date.now() });
      this._dags.delete(dagId);
      this._dagLocks.delete(dagId);
      this.emit('dag:failed', { dagId });
      this._emitProgress(dagId);
      logger.info('orchestrator.dag-failed', { dagId, reason: 'fail-fast' });
    } else {
      // best-effort: skip only direct dependents (BFS)
      const toSkip = new Set();
      const queue = [taskId];
      while (queue.length > 0) {
        const current = queue.shift();
        const dependents = ctx.adjacency.get(current) || new Set();
        for (const depId of dependents) {
          if (!toSkip.has(depId)) {
            const depTask = this.repo.getTaskById(depId);
            if (depTask && (depTask.status === TASK_STATUS.PENDING || depTask.status === TASK_STATUS.READY)) {
              toSkip.add(depId);
              queue.push(depId);
            }
          }
        }
      }

      for (const skipId of toSkip) {
        this.repo.updateTask(skipId, { status: TASK_STATUS.SKIPPED, completedAt: Date.now() });
        this.emit('task:skipped', { dagId, taskId: skipId });

        // Update inDegree for downstream
        const dependents = ctx.adjacency.get(skipId) || new Set();
        for (const depId of dependents) {
          const currentDeg = ctx.inDegree.get(depId) || 0;
          ctx.inDegree.set(depId, Math.max(0, currentDeg - 1));
        }
      }

      this._emitProgress(dagId);
      // Continue scheduling independent branches
      await this._schedule(dagId);
    }
  }

  // ── Agent runtime event handlers ──

  _onAgentExit(data) {
    const { agentId, code } = data;
    const mapping = this._agentTaskMap.get(agentId);
    if (!mapping) return;

    const { dagId, taskId } = mapping;
    const success = code === 0;
    const status = success ? TASK_STATUS.SUCCEEDED : TASK_STATUS.FAILED;
    const error = success ? null : `Agent exited with code ${code}`;

    this._completeTask(dagId, taskId, status, null, error).catch((err) => {
      logger.error('orchestrator.complete-task-failed', { dagId, taskId, error: err.message });
    });
  }

  _onAgentStatusChange(data) {
    const { agentId, status, from } = data;
    if (status !== 'errored') return;

    const mapping = this._agentTaskMap.get(agentId);
    if (!mapping) return;

    const { dagId, taskId } = mapping;
    this._completeTask(dagId, taskId, TASK_STATUS.FAILED, null, `Agent errored (was ${from})`).catch((err) => {
      logger.error('orchestrator.complete-task-failed', { dagId, taskId, error: err.message });
    });
  }

  // ── Progress events ──

  _emitProgress(dagId) {
    const status = this.getDagStatus(dagId);
    if (status) {
      this.emit('dag:progress', { dagId, ...status.progress });
    }
  }

  // ── Startup recovery ──

  /**
   * Recover DAGs that were running when the app last exited.
   */
  recoverOnStartup() {
    const runningDags = this.repo.listDags({ status: DAG_STATUS.RUNNING });
    const pausedDags = this.repo.listDags({ status: DAG_STATUS.PAUSED });

    for (const dag of [...runningDags.items, ...pausedDags.items]) {
      try {
        const ctx = this._buildGraph(dag.id);
        this._dags.set(dag.id, ctx);

        // Mark tasks that were running as failed (their agents are dead)
        const runningTasks = this.repo.listTasksByDagAndStatus(dag.id, TASK_STATUS.RUNNING);
        for (const task of runningTasks) {
          this.repo.updateTask(task.id, {
            status: TASK_STATUS.FAILED,
            errorMessage: 'App restarted while task was running',
            completedAt: Date.now(),
          });
          // Update inDegree
          const dependents = ctx.adjacency.get(task.id) || new Set();
          for (const depId of dependents) {
            const currentDeg = ctx.inDegree.get(depId) || 0;
            ctx.inDegree.set(depId, Math.max(0, currentDeg - 1));
          }
        }

        // Resume scheduling if DAG was running
        if (dag.status === DAG_STATUS.RUNNING) {
          this._schedule(dag.id).catch((err) => {
            logger.error('orchestrator.recovery-schedule-failed', { dagId: dag.id, error: err.message });
          });
        }

        logger.info('orchestrator.recovery', { dagId: dag.id, status: dag.status });
      } catch (err) {
        logger.error('orchestrator.recovery-failed', { dagId: dag.id, error: err.message });
      }
    }
  }

  /**
   * Graceful shutdown. Cancel all running DAGs.
   */
  async shutdown() {
    for (const [dagId] of this._dags) {
      try {
        await this.cancelDag(dagId);
      } catch (err) {
        logger.error('orchestrator.shutdown-cancel-failed', { dagId, error: err.message });
      }
    }

    // Unbind runtime listeners
    if (this.runtime) {
      this.runtime.removeListener('exit', this._onAgentExit);
      this.runtime.removeListener('status-change', this._onAgentStatusChange);
    }
  }
}

module.exports = { TaskOrchestrator, DAG_STATUS, TASK_STATUS };
