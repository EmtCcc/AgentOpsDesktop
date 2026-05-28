'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for DAG orchestrator persistence.
 * Manages dags, dag_tasks, and dag_edges tables.
 */
class OrchestratorRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      // ── DAG operations ──
      insertDag: this.db.prepare(`
        INSERT INTO dags (id, name, description, status, max_parallel, retry_max,
          retry_backoff_ms, retry_backoff_mult, retry_max_backoff_ms, on_failure,
          started_at, completed_at, created_at, updated_at)
        VALUES (@id, @name, @description, @status, @maxParallel, @retryMax,
          @retryBackoffMs, @retryBackoffMult, @retryMaxBackoffMs, @onFailure,
          @startedAt, @completedAt, @createdAt, @updatedAt)
      `),
      updateDag: this.db.prepare(`
        UPDATE dags SET name = @name, description = @description, status = @status,
          max_parallel = @maxParallel, retry_max = @retryMax,
          retry_backoff_ms = @retryBackoffMs, retry_backoff_mult = @retryBackoffMult,
          retry_max_backoff_ms = @retryMaxBackoffMs, on_failure = @onFailure,
          started_at = @startedAt, completed_at = @completedAt, updated_at = @updatedAt
        WHERE id = @id
      `),
      deleteDag: this.db.prepare('DELETE FROM dags WHERE id = @id'),
      getDagById: this.db.prepare('SELECT * FROM dags WHERE id = @id'),
      listDags: this.db.prepare('SELECT * FROM dags ORDER BY created_at DESC'),
      listDagsByStatus: this.db.prepare('SELECT * FROM dags WHERE status = @status ORDER BY created_at DESC'),

      // ── DAG task operations ──
      insertTask: this.db.prepare(`
        INSERT INTO dag_tasks (id, dag_id, agent_id, title, description, task_type,
          status, agent_config_json, retry_count, retry_max, output_json, error_message,
          started_at, completed_at, created_at, updated_at)
        VALUES (@id, @dagId, @agentId, @title, @description, @taskType,
          @status, @agentConfigJson, @retryCount, @retryMax, @outputJson, @errorMessage,
          @startedAt, @completedAt, @createdAt, @updatedAt)
      `),
      updateTask: this.db.prepare(`
        UPDATE dag_tasks SET agent_id = @agentId, title = @title, description = @description,
          task_type = @taskType, status = @status, agent_config_json = @agentConfigJson,
          retry_count = @retryCount, retry_max = @retryMax, output_json = @outputJson,
          error_message = @errorMessage, started_at = @startedAt, completed_at = @completedAt,
          updated_at = @updatedAt
        WHERE id = @id
      `),
      getTaskById: this.db.prepare('SELECT * FROM dag_tasks WHERE id = @id'),
      listTasksByDag: this.db.prepare('SELECT * FROM dag_tasks WHERE dag_id = @dagId ORDER BY created_at'),
      listTasksByDagAndStatus: this.db.prepare('SELECT * FROM dag_tasks WHERE dag_id = @dagId AND status = @status'),
      countTasksByDagAndStatus: this.db.prepare('SELECT status, COUNT(*) as count FROM dag_tasks WHERE dag_id = @dagId GROUP BY status'),

      // ── Edge operations ──
      insertEdge: this.db.prepare(`
        INSERT INTO dag_edges (id, dag_id, from_task_id, to_task_id, edge_type, data_key, created_at)
        VALUES (@id, @dagId, @fromTaskId, @toTaskId, @edgeType, @dataKey, @createdAt)
      `),
      deleteEdgesByDag: this.db.prepare('DELETE FROM dag_edges WHERE dag_id = @dagId'),
      getEdgeById: this.db.prepare('SELECT * FROM dag_edges WHERE id = @id'),
      listEdgesByDag: this.db.prepare('SELECT * FROM dag_edges WHERE dag_id = @dagId'),
      listEdgesByFromTask: this.db.prepare('SELECT * FROM dag_edges WHERE from_task_id = @taskId'),
      listEdgesByToTask: this.db.prepare('SELECT * FROM dag_edges WHERE to_task_id = @taskId'),
    };
  }

  // ── Mapping helpers ──

  _dagToRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      maxParallel: row.max_parallel,
      retryMax: row.retry_max,
      retryBackoffMs: row.retry_backoff_ms,
      retryBackoffMult: row.retry_backoff_mult,
      retryMaxBackoffMs: row.retry_max_backoff_ms,
      onFailure: row.on_failure,
      startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _dagToDbParams(dag) {
    const now = new Date().toISOString();
    return {
      id: dag.id || randomUUID(),
      name: dag.name,
      description: dag.description || null,
      status: dag.status || 'pending',
      maxParallel: dag.maxParallel ?? 4,
      retryMax: dag.retryMax ?? 0,
      retryBackoffMs: dag.retryBackoffMs ?? 1000,
      retryBackoffMult: dag.retryBackoffMult ?? 2.0,
      retryMaxBackoffMs: dag.retryMaxBackoffMs ?? 30000,
      onFailure: dag.onFailure || 'fail-fast',
      startedAt: dag.startedAt ? new Date(dag.startedAt).toISOString() : null,
      completedAt: dag.completedAt ? new Date(dag.completedAt).toISOString() : null,
      createdAt: dag.createdAt ? new Date(dag.createdAt).toISOString() : now,
      updatedAt: now,
    };
  }

  _taskToRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      dagId: row.dag_id,
      agentId: row.agent_id,
      title: row.title,
      description: row.description,
      taskType: row.task_type,
      status: row.status,
      agentConfig: row.agent_config_json ? JSON.parse(row.agent_config_json) : {},
      retryCount: row.retry_count,
      retryMax: row.retry_max,
      output: row.output_json ? JSON.parse(row.output_json) : null,
      errorMessage: row.error_message,
      startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _taskToDbParams(task) {
    const now = new Date().toISOString();
    return {
      id: task.id || randomUUID(),
      dagId: task.dagId,
      agentId: task.agentId || null,
      title: task.title,
      description: task.description || null,
      taskType: task.taskType || 'agent',
      status: task.status || 'pending',
      agentConfigJson: task.agentConfig ? JSON.stringify(task.agentConfig) : '{}',
      retryCount: task.retryCount ?? 0,
      retryMax: task.retryMax ?? null,
      outputJson: task.output ? JSON.stringify(task.output) : null,
      errorMessage: task.errorMessage || null,
      startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
      completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
      createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : now,
      updatedAt: now,
    };
  }

  _edgeToRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      dagId: row.dag_id,
      fromTaskId: row.from_task_id,
      toTaskId: row.to_task_id,
      edgeType: row.edge_type,
      dataKey: row.data_key,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  _edgeToDbParams(edge) {
    return {
      id: edge.id || randomUUID(),
      dagId: edge.dagId,
      fromTaskId: edge.fromTaskId,
      toTaskId: edge.toTaskId,
      edgeType: edge.edgeType || 'dependency',
      dataKey: edge.dataKey || null,
      createdAt: new Date().toISOString(),
    };
  }

  // ── DAG CRUD ──

  createDag(dag) {
    const params = this._dagToDbParams(dag);
    this._stmts.insertDag.run(params);
    return this._dagToRecord(this._stmts.getDagById.get({ id: params.id }));
  }

  updateDag(id, updates) {
    const existing = this._stmts.getDagById.get({ id });
    if (!existing) return null;
    const merged = { ...this._dagToRecord(existing), ...updates, id };
    const params = this._dagToDbParams(merged);
    this._stmts.updateDag.run(params);
    return this._dagToRecord(this._stmts.getDagById.get({ id }));
  }

  deleteDag(id) {
    const result = this._stmts.deleteDag.run({ id });
    return result.changes > 0;
  }

  getDagById(id) {
    return this._dagToRecord(this._stmts.getDagById.get({ id }));
  }

  listDags(params = {}) {
    const { offset = 0, limit = 20, status } = params;
    let rows;
    if (status) {
      rows = this._stmts.listDagsByStatus.all({ status });
    } else {
      rows = this._stmts.listDags.all();
    }
    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._dagToRecord(r));
    return { items, total, offset, limit };
  }

  // ── DAG Task CRUD ──

  createTask(task) {
    const params = this._taskToDbParams(task);
    this._stmts.insertTask.run(params);
    return this._taskToRecord(this._stmts.getTaskById.get({ id: params.id }));
  }

  updateTask(id, updates) {
    const existing = this._stmts.getTaskById.get({ id });
    if (!existing) return null;
    const merged = { ...this._taskToRecord(existing), ...updates, id };
    const params = this._taskToDbParams(merged);
    this._stmts.updateTask.run(params);
    return this._taskToRecord(this._stmts.getTaskById.get({ id }));
  }

  getTaskById(id) {
    return this._taskToRecord(this._stmts.getTaskById.get({ id }));
  }

  listTasksByDag(dagId) {
    return this._stmts.listTasksByDag.all({ dagId }).map((r) => this._taskToRecord(r));
  }

  listTasksByDagAndStatus(dagId, status) {
    return this._stmts.listTasksByDagAndStatus.all({ dagId, status }).map((r) => this._taskToRecord(r));
  }

  countTasksByDagAndStatus(dagId) {
    const rows = this._stmts.countTasksByDagAndStatus.all({ dagId });
    const counts = {};
    for (const row of rows) {
      counts[row.status] = row.count;
    }
    return counts;
  }

  // ── Edge CRUD ──

  createEdge(edge) {
    const params = this._edgeToDbParams(edge);
    this._stmts.insertEdge.run(params);
    return this._edgeToRecord(this._stmts.getEdgeById.get({ id: params.id }));
  }

  deleteEdgesByDag(dagId) {
    this._stmts.deleteEdgesByDag.run({ dagId });
  }

  listEdgesByDag(dagId) {
    return this._stmts.listEdgesByDag.all({ dagId }).map((r) => this._edgeToRecord(r));
  }

  // ── Composite operations ──

  createDagTx(definition) {
    const dagId = definition.id || randomUUID();
    const now = new Date().toISOString();

    const tx = this.db.transaction((def) => {
      // Insert DAG
      const dagParams = this._dagToDbParams({ ...def, id: dagId });
      this._stmts.insertDag.run(dagParams);

      // Insert tasks
      const tasks = [];
      for (const taskDef of (def.tasks || [])) {
        const taskId = taskDef.id || randomUUID();
        const taskParams = this._taskToDbParams({
          ...taskDef,
          id: taskId,
          dagId,
          createdAt: now,
        });
        this._stmts.insertTask.run(taskParams);
        tasks.push(this._taskToRecord(this._stmts.getTaskById.get({ id: taskId })));
      }

      // Insert edges (resolve from/to shorthand and __task_N references)
      const edges = [];
      for (const edgeDef of (def.edges || [])) {
        const edgeId = edgeDef.id || randomUUID();
        let fromTaskId = edgeDef.fromTaskId || edgeDef.from;
        let toTaskId = edgeDef.toTaskId || edgeDef.to;
        if (typeof fromTaskId === 'string' && fromTaskId.startsWith('__task_')) {
          fromTaskId = tasks[parseInt(fromTaskId.replace('__task_', ''))].id;
        }
        if (typeof toTaskId === 'string' && toTaskId.startsWith('__task_')) {
          toTaskId = tasks[parseInt(toTaskId.replace('__task_', ''))].id;
        }
        const edgeParams = this._edgeToDbParams({
          ...edgeDef,
          id: edgeId,
          dagId,
          fromTaskId,
          toTaskId,
        });
        this._stmts.insertEdge.run(edgeParams);
        edges.push(this._edgeToRecord(this._stmts.getEdgeById.get({ id: edgeId })));
      }

      return { dag: this._dagToRecord(this._stmts.getDagById.get({ id: dagId })), tasks, edges };
    });

    return tx(definition);
  }

  getDagFull(dagId) {
    const dag = this.getDagById(dagId);
    if (!dag) return null;
    const tasks = this.listTasksByDag(dagId);
    const edges = this.listEdgesByDag(dagId);
    return { dag, tasks, edges };
  }

  /**
   * Get upstream task outputs for a given task within a DAG.
   * Follows incoming edges to find tasks with output_json.
   * @param {string} taskId
   * @returns {Array<{ taskId: string, output: Object, dataKey?: string }>}
   */
  getUpstreamOutputs(taskId) {
    const edges = this._stmts.listEdgesByToTask.all({ taskId });
    const results = [];
    for (const edge of edges) {
      const task = this.getTaskById(edge.from_task_id);
      if (task && task.output) {
        results.push({
          taskId: task.id,
          output: task.output,
          dataKey: edge.data_key || null,
        });
      }
    }
    return results;
  }

  /**
   * Get downstream task IDs for a given task within a DAG.
   * @param {string} taskId
   * @returns {string[]}
   */
  getDownstreamTasks(taskId) {
    const edges = this._stmts.listEdgesByFromTask.all({ taskId });
    return edges.map((e) => e.to_task_id);
  }
}

module.exports = { OrchestratorRepository };
