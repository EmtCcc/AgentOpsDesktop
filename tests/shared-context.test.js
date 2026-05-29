import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { SharedContextRepository } from '../src/main/repositories/shared-context.repository.js';

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE dags (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      max_parallel INTEGER NOT NULL DEFAULT 4,
      retry_max INTEGER NOT NULL DEFAULT 0,
      retry_backoff_ms INTEGER NOT NULL DEFAULT 1000,
      retry_backoff_mult REAL NOT NULL DEFAULT 2.0,
      retry_max_backoff_ms INTEGER NOT NULL DEFAULT 30000,
      on_failure TEXT NOT NULL DEFAULT 'fail-fast',
      started_at TEXT, completed_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );

    CREATE TABLE shared_context (
      id TEXT PRIMARY KEY,
      dag_id TEXT NOT NULL REFERENCES dags(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '{}',
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(dag_id, key)
    );

    CREATE INDEX idx_shared_context_dag ON shared_context(dag_id);
    CREATE INDEX idx_shared_context_dag_key ON shared_context(dag_id, key);

    INSERT INTO dags (id, name, created_at, updated_at)
    VALUES ('dag-1', 'Test DAG', datetime('now'), datetime('now'));

    INSERT INTO dags (id, name, created_at, updated_at)
    VALUES ('dag-2', 'Other DAG', datetime('now'), datetime('now'));
  `);

  return db;
}

describe('SharedContextRepository', () => {
  let db, repo;

  beforeEach(() => {
    db = createTestDb();
    repo = new SharedContextRepository(db);
  });

  describe('set + get', () => {
    it('creates a new entry', () => {
      const result = repo.set('dag-1', 'status', { phase: 'init' }, 'agent-1');
      expect(result.dagId).toBe('dag-1');
      expect(result.key).toBe('status');
      expect(result.value).toEqual({ phase: 'init' });
      expect(result.updatedBy).toBe('agent-1');
    });

    it('upserts on duplicate key', () => {
      repo.set('dag-1', 'status', { phase: 'init' });
      const updated = repo.set('dag-1', 'status', { phase: 'running' }, 'agent-2');
      expect(updated.value).toEqual({ phase: 'running' });
      expect(updated.updatedBy).toBe('agent-2');
    });

    it('get returns null for missing key', () => {
      expect(repo.get('dag-1', 'nonexistent')).toBeNull();
    });
  });

  describe('dag_id isolation', () => {
    it('same key in different DAGs does not collide', () => {
      repo.set('dag-1', 'status', 'a');
      repo.set('dag-2', 'status', 'b');
      expect(repo.get('dag-1', 'status').value).toBe('a');
      expect(repo.get('dag-2', 'status').value).toBe('b');
    });
  });

  describe('getMany', () => {
    it('retrieves multiple keys at once', () => {
      repo.set('dag-1', 'a', 1);
      repo.set('dag-1', 'b', 2);
      repo.set('dag-1', 'c', 3);
      const results = repo.getMany('dag-1', ['a', 'c']);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.key).sort()).toEqual(['a', 'c']);
    });

    it('returns empty array for empty keys', () => {
      expect(repo.getMany('dag-1', [])).toEqual([]);
    });
  });

  describe('list', () => {
    it('lists all entries for a DAG ordered by key', () => {
      repo.set('dag-1', 'z', 1);
      repo.set('dag-1', 'a', 2);
      repo.set('dag-2', 'x', 3);
      const results = repo.list('dag-1');
      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('a');
      expect(results[1].key).toBe('z');
    });
  });

  describe('delete', () => {
    it('deletes a specific key', () => {
      repo.set('dag-1', 'status', 'done');
      expect(repo.delete('dag-1', 'status')).toBe(true);
      expect(repo.get('dag-1', 'status')).toBeNull();
    });

    it('returns false for nonexistent key', () => {
      expect(repo.delete('dag-1', 'nope')).toBe(false);
    });
  });

  describe('deleteAll', () => {
    it('removes all entries for a DAG', () => {
      repo.set('dag-1', 'a', 1);
      repo.set('dag-1', 'b', 2);
      repo.set('dag-2', 'c', 3);
      repo.deleteAll('dag-1');
      expect(repo.list('dag-1')).toHaveLength(0);
      expect(repo.list('dag-2')).toHaveLength(1);
    });
  });

  describe('FK cascade', () => {
    it('deleting the DAG cascades to shared_context', () => {
      repo.set('dag-1', 'x', 42);
      db.prepare('DELETE FROM dags WHERE id = ?').run('dag-1');
      expect(repo.get('dag-1', 'x')).toBeNull();
    });
  });

  describe('value types', () => {
    it('stores and retrieves strings', () => {
      repo.set('dag-1', 'str', 'hello');
      expect(repo.get('dag-1', 'str').value).toBe('hello');
    });

    it('stores and retrieves numbers', () => {
      repo.set('dag-1', 'num', 42);
      expect(repo.get('dag-1', 'num').value).toBe(42);
    });

    it('stores and retrieves arrays', () => {
      repo.set('dag-1', 'arr', [1, 2, 3]);
      expect(repo.get('dag-1', 'arr').value).toEqual([1, 2, 3]);
    });

    it('stores and retrieves nested objects', () => {
      const obj = { a: { b: [1, { c: true }] } };
      repo.set('dag-1', 'obj', obj);
      expect(repo.get('dag-1', 'obj').value).toEqual(obj);
    });
  });
});
