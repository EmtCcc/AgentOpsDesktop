import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { OrchestratorRepository } from '../src/main/repositories/orchestrator.repository.js';

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'custom',
      status TEXT DEFAULT 'idle', command TEXT, exec_path TEXT, cwd TEXT,
      config_json TEXT DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );

    CREATE TABLE dags (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','succeeded','failed','cancelled','paused')),
      max_parallel INTEGER NOT NULL DEFAULT 4,
      retry_max INTEGER NOT NULL DEFAULT 0,
      retry_backoff_ms INTEGER NOT NULL DEFAULT 1000,
      retry_backoff_mult REAL NOT NULL DEFAULT 2.0,
      retry_max_backoff_ms INTEGER NOT NULL DEFAULT 30000,
      on_failure TEXT NOT NULL DEFAULT 'fail-fast'
        CHECK (on_failure IN ('fail-fast','best-effort')),
      started_at TEXT, completed_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );

    CREATE TABLE dag_tasks (
      id TEXT PRIMARY KEY,
      dag_id TEXT NOT NULL REFERENCES dags(id) ON DELETE CASCADE,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      squad_id TEXT,
      title TEXT NOT NULL, description TEXT,
      task_type TEXT NOT NULL DEFAULT 'agent'
        CHECK (task_type IN ('agent','noop','manual')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','ready','running','succeeded','failed','skipped','cancelled')),
      agent_config_json TEXT DEFAULT '{}',
      retry_count INTEGER NOT NULL DEFAULT 0,
      retry_max INTEGER,
      output_json TEXT, error_message TEXT,
      started_at TEXT, completed_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );

    CREATE TABLE dag_edges (
      id TEXT PRIMARY KEY,
      dag_id TEXT NOT NULL REFERENCES dags(id) ON DELETE CASCADE,
      from_task_id TEXT NOT NULL REFERENCES dag_tasks(id) ON DELETE CASCADE,
      to_task_id TEXT NOT NULL REFERENCES dag_tasks(id) ON DELETE CASCADE,
      edge_type TEXT NOT NULL DEFAULT 'dependency'
        CHECK (edge_type IN ('dependency','data_flow')),
      data_key TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(dag_id, from_task_id, to_task_id)
    );

    CREATE INDEX idx_dag_tasks_dag ON dag_tasks(dag_id);
    CREATE INDEX idx_dag_tasks_status ON dag_tasks(dag_id, status);
    CREATE INDEX idx_dag_edges_dag ON dag_edges(dag_id);
    CREATE INDEX idx_dag_edges_from ON dag_edges(from_task_id);
    CREATE INDEX idx_dag_edges_to ON dag_edges(to_task_id);
    CREATE INDEX idx_dags_status ON dags(status);
  `);

  return db;
}

describe('OrchestratorRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = createTestDb();
    repo = new OrchestratorRepository(db);
  });

  describe('DAG CRUD', () => {
    it('should create and retrieve a DAG', () => {
      const dag = repo.createDag({ name: 'test-dag', description: 'A test' });
      expect(dag.id).toBeDefined();
      expect(dag.name).toBe('test-dag');
      expect(dag.status).toBe('pending');
      expect(dag.maxParallel).toBe(4);

      const retrieved = repo.getDagById(dag.id);
      expect(retrieved.name).toBe('test-dag');
    });

    it('should update a DAG', () => {
      const dag = repo.createDag({ name: 'test' });
      const updated = repo.updateDag(dag.id, { status: 'running', name: 'updated' });
      expect(updated.status).toBe('running');
      expect(updated.name).toBe('updated');
    });

    it('should delete a DAG', () => {
      const dag = repo.createDag({ name: 'test' });
      expect(repo.deleteDag(dag.id)).toBe(true);
      expect(repo.getDagById(dag.id)).toBeNull();
    });

    it('should list DAGs with pagination', () => {
      for (let i = 0; i < 5; i++) repo.createDag({ name: `dag-${i}` });
      const result = repo.listDags({ offset: 1, limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('should list DAGs by status', () => {
      repo.createDag({ name: 'a' });
      const b = repo.createDag({ name: 'b' });
      repo.updateDag(b.id, { status: 'running' });

      const running = repo.listDags({ status: 'running' });
      expect(running.items).toHaveLength(1);
      expect(running.items[0].name).toBe('b');
    });
  });

  describe('DAG Task CRUD', () => {
    it('should create and retrieve a task', () => {
      const dag = repo.createDag({ name: 'test' });
      const task = repo.createTask({ dagId: dag.id, title: 'task-1' });
      expect(task.dagId).toBe(dag.id);
      expect(task.title).toBe('task-1');
      expect(task.status).toBe('pending');
      expect(task.taskType).toBe('agent');
    });

    it('should update a task', () => {
      const dag = repo.createDag({ name: 'test' });
      const task = repo.createTask({ dagId: dag.id, title: 't' });
      const updated = repo.updateTask(task.id, { status: 'running' });
      expect(updated.status).toBe('running');
      expect(updated.startedAt).toBeDefined();
    });

    it('should list tasks by DAG', () => {
      const dag = repo.createDag({ name: 'test' });
      repo.createTask({ dagId: dag.id, title: 'a' });
      repo.createTask({ dagId: dag.id, title: 'b' });
      const tasks = repo.listTasksByDag(dag.id);
      expect(tasks).toHaveLength(2);
    });

    it('should count tasks by status', () => {
      const dag = repo.createDag({ name: 'test' });
      const t1 = repo.createTask({ dagId: dag.id, title: 'a' });
      repo.createTask({ dagId: dag.id, title: 'b' });
      repo.updateTask(t1.id, { status: 'succeeded' });

      const counts = repo.countTasksByDagAndStatus(dag.id);
      expect(counts.succeeded).toBe(1);
      expect(counts.pending).toBe(1);
    });
  });

  describe('Edge CRUD', () => {
    it('should create and list edges', () => {
      const dag = repo.createDag({ name: 'test' });
      const t1 = repo.createTask({ dagId: dag.id, title: 'a' });
      const t2 = repo.createTask({ dagId: dag.id, title: 'b' });

      const edge = repo.createEdge({ dagId: dag.id, fromTaskId: t1.id, toTaskId: t2.id });
      expect(edge.edgeType).toBe('dependency');

      const edges = repo.listEdgesByDag(dag.id);
      expect(edges).toHaveLength(1);
      expect(edges[0].fromTaskId).toBe(t1.id);
    });

    it('should enforce unique edge constraint', () => {
      const dag = repo.createDag({ name: 'test' });
      const t1 = repo.createTask({ dagId: dag.id, title: 'a' });
      const t2 = repo.createTask({ dagId: dag.id, title: 'b' });

      repo.createEdge({ dagId: dag.id, fromTaskId: t1.id, toTaskId: t2.id });
      expect(() => {
        repo.createEdge({ dagId: dag.id, fromTaskId: t1.id, toTaskId: t2.id });
      }).toThrow();
    });

    it('should cascade delete edges when DAG is deleted', () => {
      const dag = repo.createDag({ name: 'test' });
      const t1 = repo.createTask({ dagId: dag.id, title: 'a' });
      const t2 = repo.createTask({ dagId: dag.id, title: 'b' });
      repo.createEdge({ dagId: dag.id, fromTaskId: t1.id, toTaskId: t2.id });

      repo.deleteDag(dag.id);
      expect(repo.listTasksByDag(dag.id)).toHaveLength(0);
    });
  });

  describe('Composite operations', () => {
    it('should create DAG with tasks and edges in transaction', () => {
      const result = repo.createDagTx({
        name: 'pipeline',
        tasks: [{ title: 'step-1' }, { title: 'step-2' }, { title: 'step-3' }],
        edges: [{ from: '__task_0', to: '__task_1' }, { from: '__task_1', to: '__task_2' }],
      });

      expect(result.dag.name).toBe('pipeline');
      expect(result.tasks).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
    });

    it('should get full DAG with tasks and edges', () => {
      const created = repo.createDagTx({
        name: 'full',
        tasks: [{ title: 'a' }, { title: 'b' }],
        edges: [{ from: '__task_0', to: '__task_1' }],
      });

      const full = repo.getDagFull(created.dag.id);
      expect(full.dag.name).toBe('full');
      expect(full.tasks).toHaveLength(2);
      expect(full.edges).toHaveLength(1);
    });

    it('should return null for non-existent DAG', () => {
      expect(repo.getDagFull('nonexistent')).toBeNull();
    });
  });

  describe('Mapping', () => {
    it('should correctly map camelCase to snake_case and back', () => {
      const dag = repo.createDag({
        name: 'test',
        maxParallel: 8,
        retryMax: 3,
        retryBackoffMs: 2000,
        retryBackoffMult: 1.5,
        retryMaxBackoffMs: 60000,
        onFailure: 'best-effort',
      });

      expect(dag.maxParallel).toBe(8);
      expect(dag.retryMax).toBe(3);
      expect(dag.retryBackoffMs).toBe(2000);
      expect(dag.retryBackoffMult).toBe(1.5);
      expect(dag.retryMaxBackoffMs).toBe(60000);
      expect(dag.onFailure).toBe('best-effort');
    });

    it('should parse agentConfig JSON', () => {
      const dag = repo.createDag({ name: 'test' });
      const task = repo.createTask({
        dagId: dag.id,
        title: 'agent-task',
        agentConfig: { execPath: '/usr/bin/node', args: ['--version'] },
      });

      expect(task.agentConfig).toEqual({ execPath: '/usr/bin/node', args: ['--version'] });
    });
  });
});
