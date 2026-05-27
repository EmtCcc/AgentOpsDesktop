const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

const AGENT_STATUS = {
  IDLE: 'idle',
  SPAWNING: 'spawning',
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
};

class AgentRuntime extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map(); // agentId -> { process, config, status, logs }
  }

  /**
   * Validate that an agent executable exists and is runnable.
   * Returns { ok: boolean, error?: string }
   */
  async healthCheck(execPath) {
    if (!execPath || typeof execPath !== 'string') {
      return { ok: false, error: 'execPath is required' };
    }

    const resolved = execPath.startsWith('/') ? execPath : path.resolve(execPath);

    try {
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) {
        return { ok: false, error: `Path is not a file: ${resolved}` };
      }
      // Check executable permission (bit 0o111)
      if (!(stat.mode & 0o111)) {
        return { ok: false, error: `File is not executable: ${resolved}` };
      }
      return { ok: true };
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Try PATH lookup
        const found = await this._which(execPath);
        if (found) return { ok: true };
        return { ok: false, error: `Executable not found: ${execPath}` };
      }
      return { ok: false, error: err.message };
    }
  }

  _which(cmd) {
    return new Promise((resolve) => {
      const proc = spawn('which', [cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.on('close', (code) => {
        resolve(code === 0 ? stdout.trim() : null);
      });
      proc.on('error', () => resolve(null));
    });
  }

  /**
   * Spawn a CLI agent process.
   * config: { execPath, args?, cwd?, env?, label? }
   * Returns: { agentId, status }
   */
  spawnAgent(config) {
    if (!config || !config.execPath) {
      throw new Error('execPath is required');
    }

    const agentId = randomUUID();
    const args = config.args || [];
    const cwd = config.cwd || process.cwd();
    const env = { ...process.env, ...(config.env || {}) };

    let proc;
    try {
      proc = spawn(config.execPath, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });
    } catch (err) {
      this.emit('status-change', { agentId, status: AGENT_STATUS.ERROR, error: err.message });
      throw err;
    }

    const agent = {
      id: agentId,
      config: { ...config, label: config.label || path.basename(config.execPath) },
      process: proc,
      status: AGENT_STATUS.SPAWNING,
      logs: [],
      pid: proc.pid,
      startedAt: Date.now(),
    };

    this.agents.set(agentId, agent);

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      agent.logs.push({ type: 'stdout', data: line, timestamp: Date.now() });
      this.emit('log', { agentId, type: 'stdout', data: line });
    });

    proc.stderr.on('data', (data) => {
      const line = data.toString();
      agent.logs.push({ type: 'stderr', data: line, timestamp: Date.now() });
      this.emit('log', { agentId, type: 'stderr', data: line });
    });

    proc.on('spawn', () => {
      agent.status = AGENT_STATUS.RUNNING;
      this.emit('status-change', { agentId, status: AGENT_STATUS.RUNNING });
    });

    proc.on('error', (err) => {
      agent.status = AGENT_STATUS.ERROR;
      agent.error = err.message;
      this.emit('status-change', { agentId, status: AGENT_STATUS.ERROR, error: err.message });
    });

    proc.on('close', (code, signal) => {
      agent.status = code === 0 ? AGENT_STATUS.STOPPED : AGENT_STATUS.ERROR;
      agent.exitCode = code;
      agent.exitSignal = signal;
      agent.endedAt = Date.now();
      this.emit('status-change', {
        agentId,
        status: agent.status,
        exitCode: code,
        exitSignal: signal,
      });
      this.emit('exit', { agentId, code, signal });
    });

    return { agentId, status: agent.status };
  }

  /**
   * Stop a running agent by PID.
   */
  stopAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    if (!agent.process || agent.process.killed) {
      throw new Error(`Agent process already exited: ${agentId}`);
    }

    // Graceful shutdown first
    agent.process.kill('SIGTERM');

    // Force kill after 5s if still alive
    const forceTimer = setTimeout(() => {
      try {
        if (agent.process && !agent.process.killed) {
          agent.process.kill('SIGKILL');
        }
      } catch { /* ignore */ }
    }, 5000);

    agent.process.on('close', () => {
      clearTimeout(forceTimer);
    });

    return { agentId, status: AGENT_STATUS.STOPPED };
  }

  /**
   * Get current state of an agent.
   */
  getAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    return {
      id: agent.id,
      config: agent.config,
      status: agent.status,
      pid: agent.pid,
      exitCode: agent.exitCode ?? null,
      error: agent.error ?? null,
      startedAt: agent.startedAt,
      endedAt: agent.endedAt ?? null,
      logCount: agent.logs.length,
    };
  }

  /**
   * Get all agents.
   */
  listAgents() {
    return Array.from(this.agents.keys()).map((id) => this.getAgent(id));
  }

  /**
   * Get logs for an agent.
   */
  getLogs(agentId, opts = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    const { limit = 500, offset = 0 } = opts;
    return agent.logs.slice(offset, offset + limit);
  }

  /**
   * Remove a stopped agent from memory.
   */
  removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    if (agent.process && !agent.process.killed) {
      throw new Error(`Cannot remove running agent: ${agentId}`);
    }
    this.agents.delete(agentId);
    return true;
  }
}

module.exports = { AgentRuntime, AGENT_STATUS };
