'use strict';

const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * Agent lifecycle controller.
 * Manages real CLI agent processes via child_process.spawn.
 */

/** @type {Map<string, object>} agentId -> session */
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
  async list() {
    return Array.from(sessions.values()).map((s) => ({
      id: s.id,
      name: s.name,
      execPath: s.execPath,
      args: s.args,
      cwd: s.cwd,
      status: s.status,
      pid: s.pid,
      exitCode: s.exitCode ?? null,
      error: s.error ?? null,
      startedAt: s.startedAt,
      endedAt: s.endedAt ?? null,
      logCount: s.logs.length,
    }));
  },

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

    // Force kill after 5s if still alive
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

  async healthCheck(_event, { id }) {
    const session = sessions.get(id);
    if (!session) {
      // Validate the exec path instead
      return { ok: false, error: 'Agent session not found' };
    }
    const check = await _validateExecPath(session.execPath);
    const alive = session.process && !session.process.killed && session.status === AGENT_STATUS.RUNNING;
    return {
      ok: check.ok && alive,
      execValid: check.ok,
      processAlive: alive,
      status: session.status,
    };
  },

  /** Expose sessions map for log controller access */
  _sessions: sessions,
};

agentController.schemas = {
  spawn: {
    name: { type: 'string', maxLength: 200 },
    execPath: { type: 'string', required: true, minLength: 1 },
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
