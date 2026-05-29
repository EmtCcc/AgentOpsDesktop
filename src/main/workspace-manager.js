'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const { EventEmitter } = require('events');

/**
 * WorkspaceManager — core service for isolated agent workspaces.
 *
 * Responsibilities:
 *   - Create / delete per-agent workspace directories
 *   - Filesystem sandboxing (path containment checks)
 *   - Read/write locking for concurrent access
 *   - Snapshot / checkpoint / rollback
 *   - Cleanup of abandoned workspaces
 *   - Size enforcement
 */
class WorkspaceManager extends EventEmitter {
  /**
   * @param {import('./repositories/workspace.repository').WorkspaceRepository} repo
   * @param {object} [opts]
   * @param {string} [opts.baseDir]       — root for all workspaces (default: <appData>/workspaces)
   * @param {number} [opts.defaultMaxMB]  — default max size per workspace in MB
   * @param {number} [opts.cleanupIntervalMs] — how often to run cleanup (0 = disabled)
   */
  constructor(repo, opts = {}) {
    super();
    this.repo = repo;
    this.baseDir = opts.baseDir || path.join(os.homedir(), '.agentops', 'workspaces');
    this.defaultMaxBytes = (opts.defaultMaxMB || 100) * 1024 * 1024;
    this._locks = new Map(); // workspaceId → { readers: Set, writer: null|Promise }
    this._cleanupTimer = null;

    if (opts.cleanupIntervalMs) {
      this._cleanupTimer = setInterval(() => this.cleanup(), opts.cleanupIntervalMs);
      if (this._cleanupTimer.unref) this._cleanupTimer.unref();
    }
  }

  // ── Path sandboxing ──

  /**
   * Resolve a relative path against a workspace root and verify it stays inside.
   * @param {string} rootPath — absolute workspace root
   * @param {string} relPath  — relative path within workspace
   * @returns {string} resolved absolute path
   * @throws if path escapes the workspace boundary
   */
  resolveSafe(rootPath, relPath) {
    if (!relPath || typeof relPath !== 'string') {
      return rootPath;
    }
    // Normalize and resolve
    const resolved = path.resolve(rootPath, relPath);
    const normalizedRoot = path.resolve(rootPath) + path.sep;
    if (resolved !== rootPath && !resolved.startsWith(normalizedRoot)) {
      throw new Error(`Path escape denied: "${relPath}" resolves outside workspace`);
    }
    return resolved;
  }

  // ── Workspace CRUD ──

  /**
   * Create a new workspace for an agent.
   * @param {{ agentId: string, name?: string, maxSizeBytes?: number }} input
   * @returns {object} workspace record
   */
  create(input) {
    const id = randomUUID();
    const wsDir = path.join(this.baseDir, id);
    fs.mkdirSync(wsDir, { recursive: true });

    // Create standard subdirectories
    fs.mkdirSync(path.join(wsDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(wsDir, '.snapshots'), { recursive: true });

    const record = this.repo.create({
      id,
      agentId: input.agentId,
      name: input.name || `workspace-${id.slice(0, 8)}`,
      rootPath: wsDir,
      maxSizeBytes: input.maxSizeBytes || this.defaultMaxBytes,
    });

    this._locks.set(id, { readers: new Set(), writer: null });
    this.emit('created', record);
    return record;
  }

  /**
   * Get a workspace by ID.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    return this.repo.getById(id);
  }

  /**
   * List workspaces.
   * @param {object} [params]
   * @returns {{ items: object[], total: number, offset: number, limit: number }}
   */
  list(params) {
    return this.repo.list(params);
  }

  /**
   * Delete a workspace and its on-disk contents.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const ws = this.repo.getById(id);
    if (!ws) return false;

    this._acquireWriteLock(id);
    try {
      if (fs.existsSync(ws.rootPath)) {
        fs.rmSync(ws.rootPath, { recursive: true, force: true });
      }
      this.repo.delete(id);
      this._locks.delete(id);
      this.emit('deleted', { id });
      return true;
    } finally {
      this._releaseWriteLock(id);
    }
  }

  // ── File operations (sandboxed) ──

  /**
   * Read a file within a workspace.
   * @param {string} workspaceId
   * @param {string} relPath — relative path within workspace
   * @param {object} [opts] — passed to fs.readFileSync
   * @returns {Buffer|string}
   */
  readFile(workspaceId, relPath, opts = {}) {
    const ws = this._requireWorkspace(workspaceId);
    const absPath = this.resolveSafe(ws.rootPath, relPath);
    this._acquireReadLock(workspaceId);
    try {
      return fs.readFileSync(absPath, { encoding: 'utf-8', ...opts });
    } finally {
      this._releaseReadLock(workspaceId);
    }
  }

  /**
   * Write a file within a workspace.
   * @param {string} workspaceId
   * @param {string} relPath
   * @param {string|Buffer} data
   * @param {object} [opts]
   */
  writeFile(workspaceId, relPath, data, opts) {
    const ws = this._requireWorkspace(workspaceId);
    const absPath = this.resolveSafe(ws.rootPath, relPath);
    this._enforceSize(ws, data.length);
    this._acquireWriteLock(workspaceId);
    try {
      const dir = path.dirname(absPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(absPath, data, opts);
      this.emit('file-changed', { workspaceId, relPath, action: 'write' });
    } finally {
      this._releaseWriteLock(workspaceId);
    }
  }

  /**
   * List files in a workspace directory.
   * @param {string} workspaceId
   * @param {string} [relPath='.']
   * @returns {string[]}
   */
  listFiles(workspaceId, relPath = '.') {
    const ws = this._requireWorkspace(workspaceId);
    const absPath = this.resolveSafe(ws.rootPath, relPath);
    this._acquireReadLock(workspaceId);
    try {
      return fs.readdirSync(absPath);
    } finally {
      this._releaseReadLock(workspaceId);
    }
  }

  /**
   * Delete a file within a workspace.
   * @param {string} workspaceId
   * @param {string} relPath
   */
  deleteFile(workspaceId, relPath) {
    const ws = this._requireWorkspace(workspaceId);
    const absPath = this.resolveSafe(ws.rootPath, relPath);
    this._acquireWriteLock(workspaceId);
    try {
      fs.unlinkSync(absPath);
      this.emit('file-changed', { workspaceId, relPath, action: 'delete' });
    } finally {
      this._releaseWriteLock(workspaceId);
    }
  }

  // ── Snapshots ──

  /**
   * Create a snapshot of the workspace's src/ directory.
   * @param {string} workspaceId
   * @param {{ name?: string, description?: string }} [opts]
   * @returns {object} snapshot record
   */
  snapshot(workspaceId, opts = {}) {
    const ws = this._requireWorkspace(workspaceId);
    const snapshotId = randomUUID();
    const snapshotDir = path.join(ws.rootPath, '.snapshots', snapshotId);
    const srcDir = path.join(ws.rootPath, 'src');

    this._acquireReadLock(workspaceId);
    try {
      fs.mkdirSync(snapshotDir, { recursive: true });
      let fileCount = 0;
      let sizeBytes = 0;
      if (fs.existsSync(srcDir)) {
        const result = this._copyRecursive(srcDir, snapshotDir);
        fileCount = result.fileCount;
        sizeBytes = result.sizeBytes;
      }

      const record = this.repo.createSnapshot({
        id: snapshotId,
        workspaceId,
        name: opts.name || `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}`,
        description: opts.description,
        fileCount,
        sizeBytes,
      });

      this.emit('snapshot-created', record);
      return record;
    } finally {
      this._releaseReadLock(workspaceId);
    }
  }

  /**
   * Rollback workspace src/ to a snapshot.
   * @param {string} workspaceId
   * @param {string} snapshotId
   * @returns {object} workspace record
   */
  rollback(workspaceId, snapshotId) {
    const ws = this._requireWorkspace(workspaceId);
    const snap = this.repo.getSnapshotById(snapshotId);
    if (!snap || snap.workspaceId !== workspaceId) {
      throw new Error(`Snapshot ${snapshotId} not found in workspace ${workspaceId}`);
    }

    const snapshotDir = path.join(ws.rootPath, '.snapshots', snapshotId);
    if (!fs.existsSync(snapshotDir)) {
      throw new Error(`Snapshot directory missing on disk: ${snapshotId}`);
    }

    const srcDir = path.join(ws.rootPath, 'src');

    this._acquireWriteLock(workspaceId);
    try {
      // Clear current src
      if (fs.existsSync(srcDir)) {
        fs.rmSync(srcDir, { recursive: true, force: true });
      }
      fs.mkdirSync(srcDir, { recursive: true });

      // Copy snapshot back
      this._copyRecursive(snapshotDir, srcDir);
      this.emit('rollback', { workspaceId, snapshotId });
      return ws;
    } finally {
      this._releaseWriteLock(workspaceId);
    }
  }

  /**
   * Delete a snapshot.
   * @param {string} snapshotId
   * @returns {boolean}
   */
  deleteSnapshot(snapshotId) {
    const snap = this.repo.getSnapshotById(snapshotId);
    if (!snap) return false;

    const ws = this.repo.getById(snap.workspaceId);
    if (ws) {
      const snapDir = path.join(ws.rootPath, '.snapshots', snapshotId);
      if (fs.existsSync(snapDir)) {
        fs.rmSync(snapDir, { recursive: true, force: true });
      }
    }

    return this.repo.deleteSnapshot(snapshotId);
  }

  /**
   * List snapshots for a workspace.
   * @param {string} workspaceId
   * @returns {object[]}
   */
  listSnapshots(workspaceId) {
    return this.repo.listSnapshots(workspaceId);
  }

  // ── Cleanup ──

  /**
   * Clean up archived or abandoned workspaces.
   * A workspace is "abandoned" if it has been archived for > 7 days.
   * Also cleans up GC-eligible task workspaces whose gc_at has passed.
   * @returns {{ archived: number, gc: number }} count of cleaned workspaces
   */
  cleanup() {
    const now = new Date();
    const nowMs = now.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let archivedCleaned = 0;
    let gcCleaned = 0;

    // 1. Clean old archived workspaces
    const archived = this.repo.list({ status: 'archived' });
    for (const ws of archived.items) {
      if (nowMs - ws.updatedAt > sevenDaysMs) {
        try {
          this.delete(ws.id);
          archivedCleaned++;
        } catch (err) {
          this.emit('cleanup-error', { workspaceId: ws.id, error: err.message });
        }
      }
    }

    // 2. Clean GC-eligible task workspaces
    const gcEligible = this.repo.listGcEligible(now);
    for (const ws of gcEligible) {
      try {
        this.delete(ws.id);
        gcCleaned++;
      } catch (err) {
        this.emit('cleanup-error', { workspaceId: ws.id, error: err.message });
      }
    }

    const totalCleaned = archivedCleaned + gcCleaned;
    if (totalCleaned > 0) {
      this.emit('cleanup', { archived: archivedCleaned, gc: gcCleaned, total: totalCleaned });
    }
    return { archived: archivedCleaned, gc: gcCleaned };
  }

  /**
   * Archive a workspace (marks for future cleanup).
   * @param {string} id
   * @returns {object|null}
   */
  archive(id) {
    return this.repo.update(id, { status: 'archived' });
  }

  // ── Size management ──

  /**
   * Get the current disk usage of a workspace.
   * @param {string} workspaceId
   * @returns {{ usedBytes: number, maxBytes: number }}
   */
  getUsage(workspaceId) {
    const ws = this._requireWorkspace(workspaceId);
    const usedBytes = this._dirSize(ws.rootPath);
    return { usedBytes, maxBytes: ws.maxSizeBytes };
  }

  // ── Task workspace lifecycle ──

  /**
   * Create an isolated workspace for a task.
   * @param {{ taskId: string, agentId: string, projectRoot?: string, injectFiles?: string[], name?: string, maxSizeBytes?: number }} opts
   * @returns {object} workspace record
   */
  createForTask(opts) {
    const { taskId, agentId, projectRoot, injectFiles, name, maxSizeBytes } = opts;
    if (!taskId) throw new Error('taskId is required');
    if (!agentId) throw new Error('agentId is required');

    const id = randomUUID();
    const wsDir = path.join(this.baseDir, 'tasks', id);
    fs.mkdirSync(wsDir, { recursive: true });
    fs.mkdirSync(path.join(wsDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(wsDir, '.snapshots'), { recursive: true });

    const record = this.repo.create({
      id,
      agentId,
      taskId,
      name: name || `task-${taskId.slice(0, 8)}`,
      rootPath: wsDir,
      maxSizeBytes: maxSizeBytes || this.defaultMaxBytes,
    });

    this._locks.set(id, { readers: new Set(), writer: null });

    // Inject project files if requested
    const injected = [];
    if (projectRoot && injectFiles && injectFiles.length > 0) {
      for (const relPath of injectFiles) {
        try {
          const srcFile = path.resolve(projectRoot, relPath);
          if (!fs.existsSync(srcFile)) continue;
          const destFile = path.join(wsDir, 'src', relPath);
          const destDir = path.dirname(destFile);
          fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(srcFile, destFile);
          injected.push(relPath);
        } catch (err) {
          this.emit('inject-error', { workspaceId: id, relPath, error: err.message });
        }
      }
      this.repo.update(id, { injectedFiles: injected });
    } else if (projectRoot) {
      // Inject all files from project root (excluding node_modules, .git, etc.)
      try {
        const count = this._injectProjectTree(projectRoot, path.join(wsDir, 'src'));
        if (count > 0) injected.push('*');
        this.repo.update(id, { injectedFiles: injected });
      } catch (err) {
        this.emit('inject-error', { workspaceId: id, error: err.message });
      }
    }

    this.emit('task-workspace-created', { ...record, injectedFiles: injected });
    return this.repo.getById(id);
  }

  /**
   * Inject project files into a task workspace (full tree copy, excluding common large dirs).
   * @param {string} srcRoot — source project root
   * @param {string} destRoot — workspace src/ dir
   * @returns {number} file count copied
   */
  _injectProjectTree(srcRoot, destRoot) {
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.cache', '__pycache__', '.venv', 'target']);
    const skipExts = new Set(['.pyc', '.pyo', '.o', '.obj']);
    let count = 0;

    const walk = (src, dest) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        if (skipDirs.has(entry.name)) continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          count += walk(srcPath, destPath);
        } else {
          const ext = path.extname(entry.name);
          if (skipExts.has(ext)) continue;
          fs.copyFileSync(srcPath, destPath);
          count++;
        }
      }
      return count;
    };

    fs.mkdirSync(destRoot, { recursive: true });
    return walk(srcRoot, destRoot);
  }

  /**
   * Schedule a task workspace for GC.
   * @param {string} workspaceId
   * @param {number} [delayMs=300000] — delay before GC (default: 5 minutes)
   */
  scheduleGc(workspaceId, delayMs = 5 * 60 * 1000) {
    const gcAt = new Date(Date.now() + delayMs).toISOString();
    this.repo.update(workspaceId, { gcAt, status: 'gc-pending' });
    this.emit('gc-scheduled', { workspaceId, gcAt });
  }

  /**
   * Get the workspace for a task.
   * @param {string} taskId
   * @returns {object|null}
   */
  getByTaskId(taskId) {
    const result = this.repo.list({ taskId, limit: 1 });
    return result.items.length > 0 ? result.items[0] : null;
  }

  // ── Shutdown ──

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  // ── Internal: locking ──

  _acquireReadLock(workspaceId) {
    let lock = this._locks.get(workspaceId);
    if (!lock) {
      lock = { readers: new Set(), writer: null };
      this._locks.set(workspaceId, lock);
    }
    if (lock.writer) {
      throw new Error(`Workspace ${workspaceId} is write-locked`);
    }
    lock.readers.add(workspaceId);
  }

  _releaseReadLock(workspaceId) {
    const lock = this._locks.get(workspaceId);
    if (lock) lock.readers.delete(workspaceId);
  }

  _acquireWriteLock(workspaceId) {
    let lock = this._locks.get(workspaceId);
    if (!lock) {
      lock = { readers: new Set(), writer: null };
      this._locks.set(workspaceId, lock);
    }
    if (lock.writer) {
      throw new Error(`Workspace ${workspaceId} already has a write lock`);
    }
    if (lock.readers.size > 0) {
      throw new Error(`Workspace ${workspaceId} has active readers`);
    }
    lock.writer = workspaceId;
  }

  _releaseWriteLock(workspaceId) {
    const lock = this._locks.get(workspaceId);
    if (lock) lock.writer = null;
  }

  // ── Internal: helpers ──

  _requireWorkspace(id) {
    const ws = this.repo.getById(id);
    if (!ws) throw new Error(`Workspace not found: ${id}`);
    return ws;
  }

  _enforceSize(ws, additionalBytes) {
    const currentSize = this._dirSize(ws.rootPath);
    if (currentSize + additionalBytes > ws.maxSizeBytes) {
      throw new Error(
        `Workspace size limit exceeded: ${currentSize} + ${additionalBytes} > ${ws.maxSizeBytes}`
      );
    }
  }

  _dirSize(dirPath) {
    let total = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          total += this._dirSize(fullPath);
        } else {
          try {
            const stat = fs.statSync(fullPath);
            total += stat.size;
          } catch { /* skip inaccessible files */ }
        }
      }
    } catch { /* skip inaccessible dirs */ }
    return total;
  }

  _copyRecursive(src, dest) {
    let fileCount = 0;
    let sizeBytes = 0;
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        const sub = this._copyRecursive(srcPath, destPath);
        fileCount += sub.fileCount;
        sizeBytes += sub.sizeBytes;
      } else {
        fs.copyFileSync(srcPath, destPath);
        const stat = fs.statSync(srcPath);
        fileCount++;
        sizeBytes += stat.size;
      }
    }
    return { fileCount, sizeBytes };
  }
}

module.exports = { WorkspaceManager };
