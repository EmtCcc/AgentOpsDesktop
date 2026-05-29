'use strict';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';

import { WorkspaceRepository } from '../src/main/repositories/workspace.repository.js';
import { WorkspaceManager } from '../src/main/workspace-manager.js';
import { migrations } from '../src/main/db/schema.js';

function createTestDb() {
  const db = new Database(':memory:');
  for (const migration of migrations) {
    db.exec(migration.up);
  }
  return db;
}

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ws-test-'));
}

describe('WorkspaceRepository', () => {
  let db, repo;

  beforeEach(() => {
    db = createTestDb();
    repo = new WorkspaceRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates and retrieves a workspace', () => {
    db.prepare(`INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, created_at, updated_at)
      VALUES ('a1', 'Test Agent', '/usr/bin/echo', '/tmp', 'custom', 'custom', 'idle', '2026-01-01', '2026-01-01')`).run();

    const ws = repo.create({ agentId: 'a1', name: 'test-ws', rootPath: '/tmp/test' });
    expect(ws.id).toBeDefined();
    expect(ws.agentId).toBe('a1');
    expect(ws.name).toBe('test-ws');
    expect(ws.status).toBe('active');

    const fetched = repo.getById(ws.id);
    expect(fetched).toEqual(ws);
  });

  it('lists workspaces by agent', () => {
    db.prepare(`INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, created_at, updated_at)
      VALUES ('a1', 'Agent 1', '/usr/bin/echo', '/tmp', 'custom', 'custom', 'idle', '2026-01-01', '2026-01-01')`).run();
    db.prepare(`INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, created_at, updated_at)
      VALUES ('a2', 'Agent 2', '/usr/bin/echo', '/tmp', 'custom', 'custom', 'idle', '2026-01-01', '2026-01-01')`).run();

    repo.create({ agentId: 'a1', name: 'ws1', rootPath: '/tmp/1' });
    repo.create({ agentId: 'a1', name: 'ws2', rootPath: '/tmp/2' });
    repo.create({ agentId: 'a2', name: 'ws3', rootPath: '/tmp/3' });

    const result = repo.list({ agentId: 'a1' });
    expect(result.total).toBe(2);
    expect(result.items.every((w) => w.agentId === 'a1')).toBe(true);
  });

  it('updates workspace status', () => {
    db.prepare(`INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, created_at, updated_at)
      VALUES ('a1', 'Agent', '/usr/bin/echo', '/tmp', 'custom', 'custom', 'idle', '2026-01-01', '2026-01-01')`).run();

    const ws = repo.create({ agentId: 'a1', name: 'test', rootPath: '/tmp/t' });
    const updated = repo.update(ws.id, { status: 'archived' });
    expect(updated.status).toBe('archived');
  });

  it('returns null when updating nonexistent workspace', () => {
    const result = repo.update('nonexistent', { status: 'archived' });
    expect(result).toBeNull();
  });

  it('deletes workspace and its snapshots', () => {
    db.prepare(`INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, created_at, updated_at)
      VALUES ('a1', 'Agent', '/usr/bin/echo', '/tmp', 'custom', 'custom', 'idle', '2026-01-01', '2026-01-01')`).run();

    const ws = repo.create({ agentId: 'a1', name: 'test', rootPath: '/tmp/t' });
    repo.createSnapshot({ workspaceId: ws.id, name: 'snap1' });

    const deleted = repo.delete(ws.id);
    expect(deleted).toBe(true);
    expect(repo.getById(ws.id)).toBeNull();
    expect(repo.listSnapshots(ws.id)).toHaveLength(0);
  });

  it('creates and lists snapshots', () => {
    db.prepare(`INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, created_at, updated_at)
      VALUES ('a1', 'Agent', '/usr/bin/echo', '/tmp', 'custom', 'custom', 'idle', '2026-01-01', '2026-01-01')`).run();

    const ws = repo.create({ agentId: 'a1', name: 'test', rootPath: '/tmp/t' });
    const snap1 = repo.createSnapshot({ workspaceId: ws.id, name: 'v1', fileCount: 5, sizeBytes: 1000 });
    const snap2 = repo.createSnapshot({ workspaceId: ws.id, name: 'v2', fileCount: 10, sizeBytes: 2000 });

    expect(snap1.name).toBe('v1');
    expect(snap2.name).toBe('v2');

    const snaps = repo.listSnapshots(ws.id);
    expect(snaps).toHaveLength(2);
  });

  it('deletes a snapshot', () => {
    db.prepare(`INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, created_at, updated_at)
      VALUES ('a1', 'Agent', '/usr/bin/echo', '/tmp', 'custom', 'custom', 'idle', '2026-01-01', '2026-01-01')`).run();

    const ws = repo.create({ agentId: 'a1', name: 'test', rootPath: '/tmp/t' });
    const snap = repo.createSnapshot({ workspaceId: ws.id, name: 'v1' });

    const deleted = repo.deleteSnapshot(snap.id);
    expect(deleted).toBe(true);
    expect(repo.getSnapshotById(snap.id)).toBeNull();
  });
});

describe('WorkspaceManager', () => {
  let db, repo, manager, tmpDir;

  beforeEach(() => {
    db = createTestDb();
    repo = new WorkspaceRepository(db);
    tmpDir = createTempDir();
    manager = new WorkspaceManager(repo, { baseDir: tmpDir });
  });

  afterEach(() => {
    manager.destroy();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createAgent(id = 'a1') {
    db.prepare(`INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, created_at, updated_at)
      VALUES (@id, 'Agent', '/usr/bin/echo', '/tmp', 'custom', 'custom', 'idle', '2026-01-01', '2026-01-01')`).run({ id });
  }

  function createTask(taskId) {
    // Ensure a goal exists first (FK requirement)
    db.prepare(`INSERT OR IGNORE INTO goals (id, title, status, created_at, updated_at)
      VALUES ('g1', 'Test Goal', 'active', '2026-01-01', '2026-01-01')`).run();
    db.prepare(`INSERT INTO tasks (id, goal_id, title, status, created_at, updated_at)
      VALUES (@taskId, 'g1', 'Test Task', 'pending', '2026-01-01', '2026-01-01')`).run({ taskId });
  }

  describe('create', () => {
    it('creates workspace with on-disk directory', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1', name: 'my-ws' });
      expect(ws.name).toBe('my-ws');
      expect(fs.existsSync(ws.rootPath)).toBe(true);
      expect(fs.existsSync(path.join(ws.rootPath, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(ws.rootPath, '.snapshots'))).toBe(true);
    });
  });

  describe('path sandboxing', () => {
    it('allows valid relative paths', () => {
      const root = '/tmp/workspace';
      const resolved = manager.resolveSafe(root, 'src/file.js');
      expect(resolved).toBe(path.resolve(root, 'src/file.js'));
    });

    it('blocks path traversal with ..', () => {
      const root = '/tmp/workspace';
      expect(() => manager.resolveSafe(root, '../../etc/passwd')).toThrow('Path escape denied');
    });

    it('blocks absolute paths that escape', () => {
      const root = '/tmp/workspace';
      expect(() => manager.resolveSafe(root, '/etc/passwd')).toThrow('Path escape denied');
    });

    it('allows root path itself', () => {
      const root = '/tmp/workspace';
      const resolved = manager.resolveSafe(root, '');
      expect(resolved).toBe(root);
    });

    it('allows nested paths', () => {
      const root = '/tmp/workspace';
      const resolved = manager.resolveSafe(root, 'src/deep/nested/file.js');
      expect(resolved).toBe(path.resolve(root, 'src/deep/nested/file.js'));
    });
  });

  describe('file operations', () => {
    it('writes and reads files within workspace', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.writeFile(ws.id, 'src/hello.txt', 'world');
      const content = manager.readFile(ws.id, 'src/hello.txt');
      expect(content).toBe('world');
    });

    it('prevents writing outside workspace', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      expect(() => manager.writeFile(ws.id, '../../../escape.txt', 'nope')).toThrow('Path escape denied');
    });

    it('lists files in workspace', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.writeFile(ws.id, 'src/a.txt', 'a');
      manager.writeFile(ws.id, 'src/b.txt', 'b');
      const files = manager.listFiles(ws.id, 'src');
      expect(files).toContain('a.txt');
      expect(files).toContain('b.txt');
    });

    it('deletes files within workspace', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.writeFile(ws.id, 'src/del.txt', 'bye');
      manager.deleteFile(ws.id, 'src/del.txt');
      expect(() => manager.readFile(ws.id, 'src/del.txt')).toThrow();
    });
  });

  describe('snapshots', () => {
    it('creates a snapshot of workspace src/', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.writeFile(ws.id, 'src/foo.js', 'console.log("hi")');
      manager.writeFile(ws.id, 'src/bar.js', 'const x = 1');

      const snap = manager.snapshot(ws.id, { name: 'v1' });
      expect(snap.name).toBe('v1');
      expect(snap.fileCount).toBe(2);
      expect(snap.sizeBytes).toBeGreaterThan(0);
    });

    it('rolls back to a snapshot', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.writeFile(ws.id, 'src/original.js', 'original');

      const snap = manager.snapshot(ws.id, { name: 'before-change' });

      manager.writeFile(ws.id, 'src/original.js', 'modified');
      manager.writeFile(ws.id, 'src/new-file.js', 'new');
      expect(manager.readFile(ws.id, 'src/original.js')).toBe('modified');

      manager.rollback(ws.id, snap.id);
      expect(manager.readFile(ws.id, 'src/original.js')).toBe('original');
      expect(() => manager.readFile(ws.id, 'src/new-file.js')).toThrow();
    });

    it('lists snapshots for a workspace', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.writeFile(ws.id, 'src/f.js', 'v1');
      manager.snapshot(ws.id, { name: 'snap1' });
      manager.writeFile(ws.id, 'src/f.js', 'v2');
      manager.snapshot(ws.id, { name: 'snap2' });

      const snaps = manager.listSnapshots(ws.id);
      expect(snaps).toHaveLength(2);
    });

    it('deletes a snapshot', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.writeFile(ws.id, 'src/f.js', 'data');
      const snap = manager.snapshot(ws.id, { name: 'to-delete' });

      const deleted = manager.deleteSnapshot(snap.id);
      expect(deleted).toBe(true);
      expect(manager.listSnapshots(ws.id)).toHaveLength(0);
    });

    it('throws on rollback to snapshot from different workspace', () => {
      createAgent('a1');
      createAgent('a2');
      const ws1 = manager.create({ agentId: 'a1' });
      const ws2 = manager.create({ agentId: 'a2' });
      manager.writeFile(ws1.id, 'src/f.js', 'data');
      const snap = manager.snapshot(ws1.id);

      expect(() => manager.rollback(ws2.id, snap.id)).toThrow('not found in workspace');
    });
  });

  describe('delete', () => {
    it('removes workspace from disk and database', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      const rootPath = ws.rootPath;
      expect(fs.existsSync(rootPath)).toBe(true);

      manager.delete(ws.id);
      expect(fs.existsSync(rootPath)).toBe(false);
      expect(manager.get(ws.id)).toBeNull();
    });
  });

  describe('archive and cleanup', () => {
    it('archives a workspace', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      const archived = manager.archive(ws.id);
      expect(archived.status).toBe('archived');
    });

    it('cleanup removes old archived workspaces', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });

      manager.archive(ws.id);
      db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?')
        .run(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), ws.id);

      const cleaned = manager.cleanup();
      expect(cleaned.archived).toBe(1);
      expect(manager.get(ws.id)).toBeNull();
    });

    it('cleanup does not remove recent archived workspaces', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.archive(ws.id);

      const cleaned = manager.cleanup();
      expect(cleaned.archived).toBe(0);
      expect(cleaned.gc).toBe(0);
      expect(manager.get(ws.id)).not.toBeNull();
    });
  });

  describe('task workspace lifecycle', () => {
    it('creates an isolated workspace for a task', () => {
      createAgent();
      createTask('task-001');
      const ws = manager.createForTask({ taskId: 'task-001', agentId: 'a1' });

      expect(ws.taskId).toBe('task-001');
      expect(ws.agentId).toBe('a1');
      expect(ws.name).toBe('task-task-001');
      expect(fs.existsSync(ws.rootPath)).toBe(true);
      expect(fs.existsSync(path.join(ws.rootPath, 'src'))).toBe(true);
    });

    it('creates task workspace under tasks/ subdirectory', () => {
      createAgent();
      createTask('task-002');
      const ws = manager.createForTask({ taskId: 'task-002', agentId: 'a1' });

      expect(ws.rootPath).toContain(path.join(tmpDir, 'tasks'));
    });

    it('injects specific project files into task workspace', () => {
      createAgent();
      createTask('task-003');
      // Create a project root with some files
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-'));
      fs.writeFileSync(path.join(projectDir, 'index.js'), 'console.log("hi")');
      fs.writeFileSync(path.join(projectDir, 'utils.js'), 'export const x = 1');
      fs.writeFileSync(path.join(projectDir, 'secret.key'), 'topsecret');

      const ws = manager.createForTask({
        taskId: 'task-003',
        agentId: 'a1',
        projectRoot: projectDir,
        injectFiles: ['index.js', 'utils.js'],
      });

      expect(ws.injectedFiles).toEqual(['index.js', 'utils.js']);
      expect(manager.readFile(ws.id, 'src/index.js')).toBe('console.log("hi")');
      expect(manager.readFile(ws.id, 'src/utils.js')).toBe('export const x = 1');
      // secret.key should NOT be injected
      expect(() => manager.readFile(ws.id, 'src/secret.key')).toThrow();

      fs.rmSync(projectDir, { recursive: true, force: true });
    });

    it('injects full project tree when no injectFiles specified', () => {
      createAgent();
      createTask('task-004');
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-'));
      fs.writeFileSync(path.join(projectDir, 'main.py'), 'print("hello")');
      fs.mkdirSync(path.join(projectDir, 'lib'));
      fs.writeFileSync(path.join(projectDir, 'lib', 'util.py'), 'def foo(): pass');
      // These should be skipped
      fs.mkdirSync(path.join(projectDir, 'node_modules'));
      fs.writeFileSync(path.join(projectDir, 'node_modules', 'pkg.js'), 'skip');
      fs.mkdirSync(path.join(projectDir, '.git'));
      fs.writeFileSync(path.join(projectDir, '.git', 'config'), 'skip');

      const ws = manager.createForTask({
        taskId: 'task-004',
        agentId: 'a1',
        projectRoot: projectDir,
      });

      expect(ws.injectedFiles).toEqual(['*']);
      expect(manager.readFile(ws.id, 'src/main.py')).toBe('print("hello")');
      expect(manager.readFile(ws.id, 'src/lib/util.py')).toBe('def foo(): pass');
      // node_modules and .git should be skipped
      expect(() => manager.readFile(ws.id, 'src/node_modules/pkg.js')).toThrow();
      expect(() => manager.readFile(ws.id, 'src/.git/config')).toThrow();

      fs.rmSync(projectDir, { recursive: true, force: true });
    });

    it('skips nonexistent files in injectFiles gracefully', () => {
      createAgent();
      createTask('task-005');
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-'));
      fs.writeFileSync(path.join(projectDir, 'exists.txt'), 'here');

      const ws = manager.createForTask({
        taskId: 'task-005',
        agentId: 'a1',
        projectRoot: projectDir,
        injectFiles: ['exists.txt', 'nope.txt'],
      });

      expect(ws.injectedFiles).toEqual(['exists.txt']);
      expect(manager.readFile(ws.id, 'src/exists.txt')).toBe('here');

      fs.rmSync(projectDir, { recursive: true, force: true });
    });

    it('throws when taskId is missing', () => {
      createAgent();
      expect(() => manager.createForTask({ agentId: 'a1' })).toThrow('taskId is required');
    });

    it('throws when agentId is missing', () => {
      expect(() => manager.createForTask({ taskId: 't1' })).toThrow('agentId is required');
    });

    it('retrieves workspace by taskId via getByTaskId', () => {
      createAgent();
      createTask('task-lookup');
      const ws = manager.createForTask({ taskId: 'task-lookup', agentId: 'a1' });
      const found = manager.getByTaskId('task-lookup');

      expect(found).not.toBeNull();
      expect(found.id).toBe(ws.id);
      expect(found.taskId).toBe('task-lookup');
    });

    it('returns null from getByTaskId for unknown task', () => {
      expect(manager.getByTaskId('nonexistent')).toBeNull();
    });

    it('schedules GC for a task workspace', () => {
      createAgent();
      createTask('task-gc');
      const ws = manager.createForTask({ taskId: 'task-gc', agentId: 'a1' });

      manager.scheduleGc(ws.id, 0); // 0ms delay for test

      const updated = manager.get(ws.id);
      expect(updated.status).toBe('gc-pending');
      expect(updated.gcAt).not.toBeNull();
    });

    it('cleanup removes GC-eligible task workspaces', () => {
      createAgent();
      createTask('task-gc-clean');
      const ws = manager.createForTask({ taskId: 'task-gc-clean', agentId: 'a1' });

      // Schedule GC with 0 delay (already eligible)
      manager.scheduleGc(ws.id, 0);

      const cleaned = manager.cleanup();
      expect(cleaned.gc).toBe(1);
      expect(manager.get(ws.id)).toBeNull();
      expect(fs.existsSync(ws.rootPath)).toBe(false);
    });

    it('cleanup does not remove task workspaces whose GC time has not passed', () => {
      createAgent();
      createTask('task-gc-future');
      const ws = manager.createForTask({ taskId: 'task-gc-future', agentId: 'a1' });

      // Schedule GC with long delay
      manager.scheduleGc(ws.id, 60 * 60 * 1000); // 1 hour

      const cleaned = manager.cleanup();
      expect(cleaned.gc).toBe(0);
      expect(manager.get(ws.id)).not.toBeNull();
    });
  });

  describe('size enforcement', () => {
    it('rejects writes that exceed max size', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1', maxSizeBytes: 50 });
      manager.writeFile(ws.id, 'src/small.txt', '0123456789');
      expect(() => manager.writeFile(ws.id, 'src/big.txt', 'x'.repeat(50))).toThrow('size limit exceeded');
    });
  });

  describe('getUsage', () => {
    it('reports disk usage', () => {
      createAgent();
      const ws = manager.create({ agentId: 'a1' });
      manager.writeFile(ws.id, 'src/data.txt', 'hello world');

      const usage = manager.getUsage(ws.id);
      expect(usage.usedBytes).toBeGreaterThan(0);
      expect(usage.maxBytes).toBe(104857600);
    });
  });
});
