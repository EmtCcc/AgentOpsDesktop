'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for workspace CRUD and snapshot operations.
 *
 * DB schema:
 *   workspaces(id, agent_id, name, root_path, status, max_size_bytes, created_at, updated_at)
 *   workspace_snapshots(id, workspace_id, name, description, file_count, size_bytes, created_at)
 */
class WorkspaceRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      // Workspace CRUD
      insert: this.db.prepare(`
        INSERT INTO workspaces (id, agent_id, task_id, name, root_path, status, max_size_bytes, injected_files, gc_at, created_at, updated_at)
        VALUES (@id, @agentId, @taskId, @name, @rootPath, @status, @maxSizeBytes, @injectedFiles, @gcAt, @createdAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE workspaces
        SET name = @name, root_path = @rootPath, status = @status,
            max_size_bytes = @maxSizeBytes, injected_files = @injectedFiles, gc_at = @gcAt, updated_at = @updatedAt
        WHERE id = @id
      `),
      delete: this.db.prepare('DELETE FROM workspaces WHERE id = @id'),
      getById: this.db.prepare('SELECT * FROM workspaces WHERE id = @id'),
      list: this.db.prepare('SELECT * FROM workspaces ORDER BY created_at DESC'),
      listByAgent: this.db.prepare('SELECT * FROM workspaces WHERE agent_id = @agentId ORDER BY created_at DESC'),
      listByTask: this.db.prepare('SELECT * FROM workspaces WHERE task_id = @taskId ORDER BY created_at DESC'),
      listByStatus: this.db.prepare('SELECT * FROM workspaces WHERE status = @status ORDER BY created_at DESC'),
      listGcEligible: this.db.prepare('SELECT * FROM workspaces WHERE gc_at IS NOT NULL AND gc_at <= @now ORDER BY gc_at ASC'),

      // Snapshot CRUD
      insertSnapshot: this.db.prepare(`
        INSERT INTO workspace_snapshots (id, workspace_id, name, description, file_count, size_bytes, created_at)
        VALUES (@id, @workspaceId, @name, @description, @fileCount, @sizeBytes, @createdAt)
      `),
      deleteSnapshot: this.db.prepare('DELETE FROM workspace_snapshots WHERE id = @id'),
      getSnapshotById: this.db.prepare('SELECT * FROM workspace_snapshots WHERE id = @id'),
      listSnapshots: this.db.prepare('SELECT * FROM workspace_snapshots WHERE workspace_id = @workspaceId ORDER BY created_at DESC'),
      deleteSnapshotsByWorkspace: this.db.prepare('DELETE FROM workspace_snapshots WHERE workspace_id = @workspaceId'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      agentId: row.agent_id,
      taskId: row.task_id || null,
      name: row.name,
      rootPath: row.root_path,
      status: row.status,
      maxSizeBytes: row.max_size_bytes,
      injectedFiles: row.injected_files ? JSON.parse(row.injected_files) : [],
      gcAt: row.gc_at ? new Date(row.gc_at).getTime() : null,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _toSnapshotRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description,
      fileCount: row.file_count,
      sizeBytes: row.size_bytes,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  create(workspace) {
    const now = new Date().toISOString();
    const params = {
      id: workspace.id || randomUUID(),
      agentId: workspace.agentId,
      taskId: workspace.taskId || null,
      name: workspace.name,
      rootPath: workspace.rootPath,
      status: workspace.status || 'active',
      maxSizeBytes: workspace.maxSizeBytes || 104857600, // 100MB default
      injectedFiles: workspace.injectedFiles ? JSON.stringify(workspace.injectedFiles) : '[]',
      gcAt: workspace.gcAt || null,
      createdAt: now,
      updatedAt: now,
    };
    this._stmts.insert.run(params);
    return this._toRecord(this._stmts.getById.get({ id: params.id }));
  }

  update(id, changes) {
    const existing = this._stmts.getById.get({ id });
    if (!existing) return null;
    const merged = { ...this._toRecord(existing), ...changes, id };
    const now = new Date().toISOString();
    const params = {
      id: merged.id,
      name: merged.name,
      rootPath: merged.rootPath,
      status: merged.status,
      maxSizeBytes: merged.maxSizeBytes,
      injectedFiles: merged.injectedFiles ? JSON.stringify(merged.injectedFiles) : '[]',
      gcAt: merged.gcAt ? new Date(merged.gcAt).toISOString() : null,
      updatedAt: now,
    };
    this._stmts.update.run(params);
    return this._toRecord(this._stmts.getById.get({ id }));
  }

  delete(id) {
    this._stmts.deleteSnapshotsByWorkspace.run({ workspaceId: id });
    const result = this._stmts.delete.run({ id });
    return result.changes > 0;
  }

  getById(id) {
    return this._toRecord(this._stmts.getById.get({ id }));
  }

  list(params = {}) {
    const { offset = 0, limit = 20, agentId, taskId, status } = params;
    let rows;
    if (taskId) {
      rows = this._stmts.listByTask.all({ taskId });
    } else if (agentId) {
      rows = this._stmts.listByAgent.all({ agentId });
    } else if (status) {
      rows = this._stmts.listByStatus.all({ status });
    } else {
      rows = this._stmts.list.all();
    }
    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._toRecord(r));
    return { items, total, offset, limit, hasMore: offset + limit < total };
  }

  /**
   * List workspaces eligible for GC (gc_at <= now).
   * @param {Date} [now] — current time
   * @returns {object[]}
   */
  listGcEligible(now) {
    const nowIso = (now || new Date()).toISOString();
    return this._stmts.listGcEligible.all({ now: nowIso }).map((r) => this._toRecord(r));
  }

  // ── Snapshot operations ──

  createSnapshot(snapshot) {
    const now = new Date().toISOString();
    const params = {
      id: snapshot.id || randomUUID(),
      workspaceId: snapshot.workspaceId,
      name: snapshot.name,
      description: snapshot.description || null,
      fileCount: snapshot.fileCount || 0,
      sizeBytes: snapshot.sizeBytes || 0,
      createdAt: now,
    };
    this._stmts.insertSnapshot.run(params);
    return this._toSnapshotRecord(this._stmts.getSnapshotById.get({ id: params.id }));
  }

  deleteSnapshot(id) {
    const result = this._stmts.deleteSnapshot.run({ id });
    return result.changes > 0;
  }

  getSnapshotById(id) {
    return this._toSnapshotRecord(this._stmts.getSnapshotById.get({ id }));
  }

  listSnapshots(workspaceId) {
    return this._stmts.listSnapshots.all({ workspaceId }).map((r) => this._toSnapshotRecord(r));
  }
}

module.exports = { WorkspaceRepository };
