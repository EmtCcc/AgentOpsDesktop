'use strict';

const { IpcError } = require('../errors');

/**
 * Workspace IPC controller.
 *
 * Route map:
 *   workspaces:list          — List workspaces (optional agentId filter)
 *   workspaces:get           — Get workspace by ID
 *   workspaces:create        — Create a new workspace for an agent
 *   workspaces:delete        — Delete a workspace and its on-disk contents
 *   workspaces:archive       — Archive a workspace (marks for cleanup)
 *   workspaces:usage         — Get disk usage of a workspace
 *
 *   workspaces:read-file     — Read a file within a workspace (sandboxed)
 *   workspaces:write-file    — Write a file within a workspace (sandboxed)
 *   workspaces:list-files    — List files in a workspace directory
 *   workspaces:delete-file   — Delete a file within a workspace
 *
 *   workspaces:snapshot      — Create a snapshot/checkpoint
 *   workspaces:rollback      — Rollback to a snapshot
 *   workspaces:list-snapshots — List snapshots for a workspace
 *   workspaces:delete-snapshot — Delete a snapshot
 *
 *   workspaces:cleanup       — Trigger cleanup of abandoned workspaces
 */

let workspaceManager = null;

const workspaceController = {
  /**
   * @param {WorkspaceManager} manager
   */
  setManager(manager) {
    workspaceManager = manager;
  },

  _getManager() {
    if (!workspaceManager) throw IpcError.internal('WorkspaceManager not initialized');
    return workspaceManager;
  },

  // ── Workspace CRUD ──

  async list(_event, params = {}) {
    const mgr = workspaceController._getManager();
    return mgr.list(params);
  },

  async get(_event, { id }) {
    const mgr = workspaceController._getManager();
    const ws = mgr.get(id);
    if (!ws) throw IpcError.notFound('Workspace', id);
    return ws;
  },

  async create(_event, input) {
    const mgr = workspaceController._getManager();
    return mgr.create(input);
  },

  async delete(_event, { id }) {
    const mgr = workspaceController._getManager();
    const deleted = mgr.delete(id);
    if (!deleted) throw IpcError.notFound('Workspace', id);
    return { deleted: true, id };
  },

  async archive(_event, { id }) {
    const mgr = workspaceController._getManager();
    const ws = mgr.archive(id);
    if (!ws) throw IpcError.notFound('Workspace', id);
    return ws;
  },

  async usage(_event, { id }) {
    const mgr = workspaceController._getManager();
    return mgr.getUsage(id);
  },

  // ── File operations ──

  async readFile(_event, { id, path: relPath, encoding }) {
    const mgr = workspaceController._getManager();
    return mgr.readFile(id, relPath, { encoding: encoding || 'utf-8' });
  },

  async writeFile(_event, { id, path: relPath, data, encoding }) {
    const mgr = workspaceController._getManager();
    mgr.writeFile(id, relPath, data, { encoding: encoding || 'utf-8' });
    return { ok: true };
  },

  async listFiles(_event, { id, path: relPath }) {
    const mgr = workspaceController._getManager();
    return mgr.listFiles(id, relPath || '.');
  },

  async deleteFile(_event, { id, path: relPath }) {
    const mgr = workspaceController._getManager();
    mgr.deleteFile(id, relPath);
    return { ok: true };
  },

  // ── Snapshots ──

  async snapshot(_event, { id, name, description }) {
    const mgr = workspaceController._getManager();
    return mgr.snapshot(id, { name, description });
  },

  async rollback(_event, { id, snapshotId }) {
    const mgr = workspaceController._getManager();
    return mgr.rollback(id, snapshotId);
  },

  async listSnapshots(_event, { id }) {
    const mgr = workspaceController._getManager();
    return mgr.listSnapshots(id);
  },

  async deleteSnapshot(_event, { snapshotId }) {
    const mgr = workspaceController._getManager();
    const deleted = mgr.deleteSnapshot(snapshotId);
    if (!deleted) throw IpcError.notFound('Snapshot', snapshotId);
    return { deleted: true, snapshotId };
  },

  // ── Cleanup ──

  async cleanup() {
    const mgr = workspaceController._getManager();
    const cleaned = mgr.cleanup();
    return { cleaned };
  },
};

workspaceController.schemas = {
  list: {
    agentId: { type: 'string' },
    status: { type: 'string', enum: ['active', 'archived', 'cleaning'] },
    offset: { type: 'number' },
    limit: { type: 'number' },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    agentId: { type: 'string', required: true },
    name: { type: 'string', maxLength: 200 },
    maxSizeBytes: { type: 'number' },
  },
  delete: {
    id: { type: 'string', required: true },
  },
  archive: {
    id: { type: 'string', required: true },
  },
  usage: {
    id: { type: 'string', required: true },
  },
  readFile: {
    id: { type: 'string', required: true },
    path: { type: 'string', required: true },
    encoding: { type: 'string' },
  },
  writeFile: {
    id: { type: 'string', required: true },
    path: { type: 'string', required: true },
    data: { type: 'string', required: true },
    encoding: { type: 'string' },
  },
  listFiles: {
    id: { type: 'string', required: true },
    path: { type: 'string' },
  },
  deleteFile: {
    id: { type: 'string', required: true },
    path: { type: 'string', required: true },
  },
  snapshot: {
    id: { type: 'string', required: true },
    name: { type: 'string', maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
  },
  rollback: {
    id: { type: 'string', required: true },
    snapshotId: { type: 'string', required: true },
  },
  listSnapshots: {
    id: { type: 'string', required: true },
  },
  deleteSnapshot: {
    snapshotId: { type: 'string', required: true },
  },
};

module.exports = workspaceController;
