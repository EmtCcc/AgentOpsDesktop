'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { IpcError } = require('../errors');
const { paginate } = require('../pagination');
const { AgentEngine, AGENT_STATUS } = require('../../agent-engine');

/**
 * Agent lifecycle controller.
 * Manages agent configs (CRUD) and live CLI agent processes (spawn/kill/pause/resume/status).
 *
 * Config API (matches preload.js bridge):
 *   agents:list()                  — list all registered agent configs
 *   agents:create(agent)           — register a new agent config
 *   agents:update({ id, updates }) — update agent config fields
 *   agents:delete(id)              — remove an agent config
 *   agents:health-check(id)        — check agent connectivity
 *
 * Live process API:
 *   agents:spawn({ name, execPath, args, cwd, env, resourceLimits?, recovery? })
 *   agents:status({ id })
 *   agents:kill({ id, signal })
 *   agents:pause({ id })
 *   agents:resume({ id })
 *   agents:logs({ id, limit?, offset? })
 */

// ── Config store (persistent agent definitions) ──
const agentConfigs = new Map();
let nextConfigId = 1;

// ── Agent engine (process lifecycle management) ──
const engine = new AgentEngine();

// ── Repository (injected) ──
let agentRepo = null;

function _which(cmd) {
  return new Promise((resolve) => {
    const proc = spawn('which', [cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.on('close', (code) => resolve(code === 0 ? stdout.trim() : null));
    proc.on('error', () => resolve(null));
  });
}

async function _validateExecPath(execPath) {
  if (!execPath || typeof execPath !== 'string') {
    return { ok: false, error: 'execPath is required' };
  }
  const resolved = execPath.startsWith('/') ? execPath : path.resolve(execPath);
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return { ok: false, error: `Not a file: ${resolved}` };
    if (!(stat.mode & 0o111)) return { ok: false, error: `Not executable: ${resolved}` };
    return { ok: true, resolved };
  } catch (err) {
    if (err.code === 'ENOENT') {
      const found = await _which(execPath);
      if (found) return { ok: true, resolved: found };
      return { ok: false, error: `Not found: ${execPath}` };
    }
    return { ok: false, error: err.message };
  }
}

const agentController = {
  /**
   * Set the repository for persistent storage.
   * @param {import('../../repositories/agent.repository').AgentRepository} repo
   */
  setRepository(repo) {
    agentRepo = repo;
  },

  // ── Config CRUD ──

  /**
   * List agent configs with pagination.
   * Operators see only their own resources; admin/viewer see all.
   * @param {Object} [params] - { offset, limit, sortBy, sortOrder, status }
   */
  async list(event, params = {}) {
    const role = event?.session?.role;
    const ownerFilter = role === 'operator' ? role : null;
    if (agentRepo) {
      return agentRepo.list({ ...params, ownerRole: ownerFilter });
    }
    const filter = (a) => {
      if (params.status && a.status !== params.status) return false;
      if (ownerFilter && a.ownerRole && a.ownerRole !== ownerFilter) return false;
      return true;
    };
    return paginate(agentConfigs, { ...params, filter });
  },

  /**
   * Get a single agent config by ID.
   * Operators can only access their own resources.
   * @param {string} id
   */
  async get(event, { id }) {
    const role = event?.session?.role;
    if (agentRepo) {
      const agent = agentRepo.getById(id);
      if (!agent) throw IpcError.notFound('Agent', id);
      if (role === 'operator' && agent.ownerRole && agent.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      return agent;
    }
    const agent = agentConfigs.get(id);
    if (!agent) throw IpcError.notFound('Agent', id);
    if (role === 'operator' && agent.ownerRole && agent.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    return agent;
  },

  async create(event, agent) {
    const ownerRole = event?.session?.role || 'operator';
    if (agentRepo) {
      return agentRepo.create({ ...agent, ownerRole });
    }
    const id = `agent-${nextConfigId++}`;
    const record = {
      id,
      name: agent.name,
      type: agent.type || 'custom',
      status: 'idle',
      command: agent.command || null,
      execPath: agent.execPath || null,
      cwd: agent.cwd || null,
      ownerRole,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    agentConfigs.set(id, record);
    return record;
  },

  async update(event, { id, updates }) {
    const role = event?.session?.role;
    if (agentRepo) {
      const existing = agentRepo.getById(id);
      if (!existing) throw IpcError.notFound('Agent', id);
      if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      const updated = agentRepo.update(id, updates);
      return updated;
    }
    const existing = agentConfigs.get(id);
    if (!existing) throw IpcError.notFound('Agent', id);
    if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    agentConfigs.set(id, updated);
    return updated;
  },

  async delete(event, { id }) {
    const role = event?.session?.role;
    if (agentRepo) {
      const existing = agentRepo.getById(id);
      if (!existing) throw IpcError.notFound('Agent', id);
      if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
        throw IpcError.forbidden('Access denied: resource owned by another role');
      }
      agentRepo.delete(id);
      return { deleted: true, id };
    }
    if (!agentConfigs.has(id)) throw IpcError.notFound('Agent', id);
    const existing = agentConfigs.get(id);
    if (role === 'operator' && existing.ownerRole && existing.ownerRole !== 'operator') {
      throw IpcError.forbidden('Access denied: resource owned by another role');
    }
    agentConfigs.delete(id);
    return { deleted: true, id };
  },

  async healthCheck(_event, { id }) {
    // Try live agent first
    const agent = engine.getAgent(id);
    if (agent) {
      const check = await _validateExecPath(agent.config.execPath);
      const alive = agent.status === AGENT_STATUS.RUNNING;
      return {
        ok: check.ok && alive,
        execValid: check.ok,
        processAlive: alive,
        status: agent.status,
      };
    }
    // Fall back to config
    const config = agentConfigs.get(id);
    if (config) {
      const check = await _validateExecPath(config.execPath || config.command);
      return { ok: check.ok, execValid: check.ok, processAlive: false, status: 'idle' };
    }
    throw IpcError.notFound('Agent', id);
  },

  // ── Live process management ──

  async spawn(_event, payload) {
    const { name, execPath, args, cwd, env, resourceLimits, recovery } = payload;

    const check = await _validateExecPath(execPath);
    if (!check.ok) throw new Error(check.error);

    const result = engine.spawnAgent({
      execPath: check.resolved,
      args: args || [],
      cwd: cwd || process.cwd(),
      env: env || {},
      label: name || path.basename(execPath),
      resourceLimits,
      recovery,
    });

    return {
      id: result.agentId,
      status: result.status,
    };
  },

  async status(_event, { id }) {
    const agent = engine.getAgent(id);
    if (!agent) throw new Error(`Agent not found: ${id}`);
    return {
      id: agent.id,
      name: agent.config.label,
      status: agent.status,
      pid: agent.pid,
      exitCode: agent.exitCode ?? null,
      error: agent.error ?? null,
      startedAt: agent.startedAt,
      endedAt: agent.endedAt ?? null,
      logCount: agent.logCount,
      resourceUsage: agent.resourceUsage,
      resourceLimits: agent.resourceLimits,
      retryCount: agent.retryCount,
    };
  },

  async kill(_event, { id }) {
    engine.stopAgent(id);
    return { id, status: AGENT_STATUS.TERMINATED };
  },

  async pause(_event, { id }) {
    const result = engine.pauseAgent(id);
    return { id, status: result.status };
  },

  async resume(_event, { id }) {
    const result = engine.resumeAgent(id);
    return { id, status: result.status };
  },

  async logs(_event, { id, limit, offset }) {
    return engine.getLogs(id, { limit, offset });
  },

  async sendInput(_event, { id, data }) {
    await engine.sendInput(id, data);
    return { ok: true };
  },

  async listLive() {
    return engine.listAgents();
  },

  /** Expose agent engine for cross-controller access */
  _engine: engine,

  /** Expose agent configs for cross-controller access (stats) */
  _configs: agentConfigs,
};

agentController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    status: { type: 'string', enum: ['idle', 'running', 'error', 'paused', 'terminated', 'created'] },
    sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'name', 'status'] },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    type: { type: 'string', enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'] },
    command: { type: 'string', maxLength: 1000 },
    execPath: { type: 'string', maxLength: 1000 },
    cwd: { type: 'string', maxLength: 500 },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['name', 'type', 'status', 'command', 'execPath', 'cwd'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        if (v.name !== undefined && (typeof v.name !== 'string' || v.name.length === 0)) return 'name must be a non-empty string';
        if (v.status !== undefined && !['idle', 'running', 'error', 'paused', 'terminated', 'created'].includes(v.status)) return 'invalid status';
        if (v.type !== undefined && !['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'].includes(v.type)) return 'invalid agent type';
        return true;
      },
    },
  },
  delete: {
    id: { type: 'string', required: true },
  },
  healthCheck: {
    id: { type: 'string', required: true },
  },
  spawn: {
    execPath: { type: 'string', required: true, minLength: 1 },
    name: { type: 'string', maxLength: 200 },
    args: { type: 'array' },
    cwd: { type: 'string' },
    env: { type: 'object' },
    resourceLimits: { type: 'object' },
    recovery: { type: 'object' },
  },
  status: {
    id: { type: 'string', required: true },
  },
  kill: {
    id: { type: 'string', required: true },
  },
  pause: {
    id: { type: 'string', required: true },
  },
  resume: {
    id: { type: 'string', required: true },
  },
  logs: {
    id: { type: 'string', required: true },
    limit: { type: 'number' },
    offset: { type: 'number' },
  },
  sendInput: {
    id: { type: 'string', required: true },
    data: { type: 'string', required: true },
  },
};

module.exports = agentController;
