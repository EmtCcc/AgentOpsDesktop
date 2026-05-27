'use strict';

const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');
const { IpcError } = require('../errors');
const { paginate } = require('../pagination');

/**
 * Agent lifecycle controller.
 * Manages agent configs (CRUD) and live CLI agent processes (spawn/kill/status).
 *
 * Config API (matches preload.js bridge):
 *   agents:list()                  — list all registered agent configs
 *   agents:create(agent)           — register a new agent config
 *   agents:update({ id, updates }) — update agent config fields
 *   agents:delete(id)              — remove an agent config
 *   agents:health-check(id)        — check agent connectivity
 *
 * Live process API (new):
 *   agents:spawn({ name, execPath, args, cwd, env }) — spawn a live process
 *   agents:status({ id })                            — get live session status
 *   agents:kill({ id, signal })                      — kill a live session
 */

// ── Config store (persistent agent definitions) ──
const agentConfigs = new Map();
let nextConfigId = 1;

// ── Live sessions (running processes) ──
const sessions = new Map();

const AGENT_STATUS = {
  IDLE: 'idle',
  SPAWNING: 'spawning',
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
};

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
  // ── Config CRUD ──

  /**
   * List agent configs with pagination.
   * @param {Object} [params] - { offset, limit, sortBy, sortOrder, status }
   */
  async list(_event, params = {}) {
    const filter = params.status
      ? (a) => a.status === params.status
      : undefined;
    return paginate(agentConfigs, { ...params, filter });
  },

  /**
   * Get a single agent config by ID.
   * @param {string} id
   */
  async get(_event, { id }) {
    const agent = agentConfigs.get(id);
    if (!agent) throw IpcError.notFound('Agent', id);
    return agent;
  },

  async create(_event, agent) {
    const id = `agent-${nextConfigId++}`;
    const record = {
      id,
      name: agent.name,
      type: agent.type || 'custom',
      status: 'idle',
      command: agent.command || null,
      execPath: agent.execPath || null,
      cwd: agent.cwd || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    agentConfigs.set(id, record);
    return record;
  },

  async update(_event, { id, updates }) {
    const existing = agentConfigs.get(id);
    if (!existing) throw IpcError.notFound('Agent', id);
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    agentConfigs.set(id, updated);
    return updated;
  },

  async delete(_event, { id }) {
    if (!agentConfigs.has(id)) throw IpcError.notFound('Agent', id);
    agentConfigs.delete(id);
    return { deleted: true, id };
  },

  async healthCheck(_event, id) {
    // Try live session first
    const session = sessions.get(id);
    if (session) {
      const check = await _validateExecPath(session.execPath);
      const alive = session.process && !session.process.killed && session.status === AGENT_STATUS.RUNNING;
      return {
        ok: check.ok && alive,
        execValid: check.ok,
        processAlive: alive,
        status: session.status,
      };
    }
    // Fall back to config
    const config = agentConfigs.get(id);
    if (config) {
      const check = await _validateExecPath(config.execPath || config.command);
      return { ok: check.ok, execValid: check.ok, processAlive: false, status: 'idle' };
    }
    return { ok: false, error: 'Agent not found' };
  },

  // ── Live process management ──

  async spawn(_event, payload) {
    const { name, execPath, args, cwd, env } = payload;

    const check = await _validateExecPath(execPath);
    if (!check.ok) throw new Error(check.error);

    const id = randomUUID();
    const proc = spawn(check.resolved, args || [], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...(env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    const session = {
      id,
      name: name || path.basename(execPath),
      execPath: check.resolved,
      args: args || [],
      cwd: cwd || process.cwd(),
      process: proc,
      status: AGENT_STATUS.SPAWNING,
      pid: proc.pid,
      logs: [],
      startedAt: Date.now(),
      endedAt: null,
      exitCode: null,
      error: null,
    };

    sessions.set(id, session);

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      session.logs.push({ type: 'stdout', data: line, timestamp: Date.now() });
    });

    proc.stderr.on('data', (data) => {
      const line = data.toString();
      session.logs.push({ type: 'stderr', data: line, timestamp: Date.now() });
    });

    proc.on('spawn', () => {
      session.status = AGENT_STATUS.RUNNING;
    });

    proc.on('error', (err) => {
      session.status = AGENT_STATUS.ERROR;
      session.error = err.message;
    });

    proc.on('close', (code, signal) => {
      session.status = code === 0 ? AGENT_STATUS.STOPPED : AGENT_STATUS.ERROR;
      session.exitCode = code;
      session.exitSignal = signal;
      session.endedAt = Date.now();
    });

    return {
      id: session.id,
      name: session.name,
      execPath: session.execPath,
      status: session.status,
      pid: session.pid,
      startedAt: session.startedAt,
    };
  },

  async status(_event, { id }) {
    const session = sessions.get(id);
    if (!session) throw new Error(`Agent not found: ${id}`);
    return {
      id: session.id,
      name: session.name,
      status: session.status,
      pid: session.pid,
      exitCode: session.exitCode ?? null,
      error: session.error ?? null,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? null,
      logCount: session.logs.length,
    };
  },

  async kill(_event, { id, signal }) {
    const session = sessions.get(id);
    if (!session) throw new Error(`Agent not found: ${id}`);
    if (!session.process || session.process.killed) {
      throw new Error(`Agent already exited: ${id}`);
    }

    const sig = signal || 'SIGTERM';
    session.process.kill(sig);

    if (sig === 'SIGTERM') {
      setTimeout(() => {
        try {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGKILL');
          }
        } catch { /* ignore */ }
      }, 5000);
    }

    return { id, status: AGENT_STATUS.STOPPED };
  },

  /** Expose live sessions for cross-controller access (logs) */
  _sessions: sessions,

  /** Expose agent configs for cross-controller access (stats) */
  _configs: agentConfigs,
};

agentController.schemas = {
  create: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    type: { type: 'string' },
    command: { type: 'string' },
    execPath: { type: 'string' },
    cwd: { type: 'string' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: { type: 'object', required: true },
  },
  spawn: {
    execPath: { type: 'string', required: true, minLength: 1 },
    name: { type: 'string', maxLength: 200 },
    args: { type: 'array' },
    cwd: { type: 'string' },
    env: { type: 'object' },
  },
  status: {
    id: { type: 'string', required: true },
  },
  kill: {
    id: { type: 'string', required: true },
    signal: { type: 'string' },
  },
};

module.exports = agentController;
