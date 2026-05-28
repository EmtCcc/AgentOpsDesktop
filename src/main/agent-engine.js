'use strict';

const { spawn: realSpawn } = require('child_process');
const { randomUUID } = require('crypto');
const { EventEmitter } = require('events');
const path = require('path');
const _fs = require('fs');

/**
 * Agent lifecycle states.
 * State machine: created → running ↔ paused → terminated | errored
 */
const AGENT_STATUS = {
  CREATED: 'created',
  RUNNING: 'running',
  PAUSED: 'paused',
  TERMINATED: 'terminated',
  ERRORED: 'errored',
};

const VALID_TRANSITIONS = {
  [AGENT_STATUS.CREATED]:    [AGENT_STATUS.RUNNING, AGENT_STATUS.ERRORED],
  [AGENT_STATUS.RUNNING]:    [AGENT_STATUS.PAUSED, AGENT_STATUS.TERMINATED, AGENT_STATUS.ERRORED],
  [AGENT_STATUS.PAUSED]:     [AGENT_STATUS.RUNNING, AGENT_STATUS.TERMINATED, AGENT_STATUS.ERRORED],
  [AGENT_STATUS.TERMINATED]: [],
  [AGENT_STATUS.ERRORED]:    [],
};

const DEFAULT_RESOURCE_LIMITS = {
  maxCpuPercent: 80,
  maxMemoryMB: 512,
  checkIntervalMs: 5000,
};

const DEFAULT_RECOVERY = {
  enabled: false,
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  backoffMultiplier: 2,
};

class AgentEngine extends EventEmitter {
  constructor({ spawnFn, skillRepo } = {}) {
    super();
    this.agents = new Map();
    this._spawn = spawnFn || realSpawn;
    this._skillRepo = skillRepo || null;
  }

  /**
   * Load skills matching the given tags.
   * @param {string[]} [tags]
   * @returns {object[]}
   */
  _loadSkills(tags) {
    if (!this._skillRepo) return [];
    try {
      if (tags && tags.length > 0) {
        return this._skillRepo.list({ tags, limit: 100 }).items;
      }
      return this._skillRepo.list({ limit: 100 }).items;
    } catch {
      return [];
    }
  }

  // ── Lifecycle state machine ──

  _transition(agentId, newStatus) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const allowed = VALID_TRANSITIONS[agent.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid transition: ${agent.status} → ${newStatus} for agent ${agentId}`);
    }

    const oldStatus = agent.status;
    agent.status = newStatus;
    agent.stateHistory.push({ from: oldStatus, to: newStatus, at: Date.now() });
    this.emit('status-change', { agentId, status: newStatus, from: oldStatus });
    return agent;
  }

  // ── Resource monitoring ──

  _startResourceMonitor(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    const interval = agent.resourceLimits.checkIntervalMs;
    agent._resourceTimer = setInterval(() => { this._checkResources(agentId); }, interval);
    agent._resourceTimer.unref();
  }

  _stopResourceMonitor(agentId) {
    const agent = this.agents.get(agentId);
    if (agent && agent._resourceTimer) {
      clearInterval(agent._resourceTimer);
      agent._resourceTimer = null;
    }
  }

  async _checkResources(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.process || agent.process.killed) return;

    try {
      const usage = await this._getProcessResourceUsage(agent.process.pid);
      if (!usage) return;

      agent.resourceUsage = usage;
      const limits = agent.resourceLimits;

      if (limits.maxMemoryMB && usage.rss > limits.maxMemoryMB * 1024 * 1024) {
        this.emit('resource-limit', {
          agentId, type: 'memory',
          limit: limits.maxMemoryMB,
          actual: Math.round(usage.rss / 1024 / 1024),
        });
        agent.error = 'Resource limit exceeded: memory';
        try { if (!agent.process.killed) agent.process.kill('SIGKILL'); } catch { /* ignore */ }
        return;
      }

      if (limits.maxCpuPercent && usage.cpuPercent > limits.maxCpuPercent) {
        this.emit('resource-limit', {
          agentId, type: 'cpu',
          limit: limits.maxCpuPercent,
          actual: usage.cpuPercent,
        });
      }
    } catch {
      // Process may have exited
    }
  }

  _getProcessResourceUsage(pid) {
    return new Promise((resolve) => {
      const proc = realSpawn('ps', ['-o', 'rss=', '-p', String(pid)], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.on('close', (code) => {
        if (code !== 0) return resolve(null);
        const rssKB = parseInt(stdout.trim(), 10);
        if (isNaN(rssKB)) return resolve(null);
        resolve({ rss: rssKB * 1024, cpuPercent: 0 });
      });
      proc.on('error', () => resolve(null));
    });
  }

  // ── Crash recovery ──

  _handleUnexpectedExit(agentId, code) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const recovery = agent.recoveryConfig;
    if (!recovery || !recovery.enabled) return;
    if (agent._intentionalStop) return;
    if (code === 0 && !agent._restartOnCleanExit) return;

    agent._retryCount = (agent._retryCount || 0) + 1;

    if (agent._retryCount > recovery.maxRetries) {
      this.emit('recovery-exhausted', { agentId, retries: agent._retryCount });
      return;
    }

    const backoff = Math.min(
      recovery.initialBackoffMs * Math.pow(recovery.backoffMultiplier, agent._retryCount - 1),
      recovery.maxBackoffMs
    );

    this.emit('recovery-attempt', {
      agentId, attempt: agent._retryCount,
      maxRetries: recovery.maxRetries, backoffMs: backoff,
    });

    agent._recoveryTimer = setTimeout(() => { this._restartAgent(agentId); }, backoff);
    agent._recoveryTimer.unref();
  }

  _restartAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const config = agent.config;
    try {
      agent.status = AGENT_STATUS.CREATED;
      agent.error = null;
      agent.exitCode = null;
      agent.exitSignal = null;
      agent.endedAt = null;
      this._spawnProcess(agentId, config);
      this.emit('recovery-success', { agentId, attempt: agent._retryCount });
    } catch (err) {
      agent.status = AGENT_STATUS.ERRORED;
      agent.error = err.message;
      this.emit('recovery-failed', { agentId, error: err.message });
    }
  }

  // ── Internal process spawning ──

  _spawnProcess(agentId, config) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const args = config.args || [];
    const cwd = config.cwd || process.cwd();
    const env = { ...process.env, ...(config.env || {}) };

    // Inject skills into agent environment
    const skillTags = config.skillTags || [];
    const skills = this._loadSkills(skillTags.length > 0 ? skillTags : undefined);
    if (skills.length > 0) {
      env.AGENT_SKILLS = JSON.stringify(skills);
    }

    let proc;
    try {
      proc = this._spawn(config.execPath, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    } catch (err) {
      agent.status = AGENT_STATUS.ERRORED;
      agent.error = err.message;
      this.emit('status-change', { agentId, status: AGENT_STATUS.ERRORED, error: err.message });
      throw err;
    }

    agent.process = proc;
    agent.pid = proc.pid;
    agent.startedAt = Date.now();

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
      this._transition(agentId, AGENT_STATUS.RUNNING);
      this._startResourceMonitor(agentId);
    });

    proc.on('error', (err) => {
      this._stopResourceMonitor(agentId);
      agent.error = err.message;
      try { this._transition(agentId, AGENT_STATUS.ERRORED); } catch { /* already terminal */ }
      this._handleUnexpectedExit(agentId, null);
    });

    proc.on('close', (code, signal) => {
      this._stopResourceMonitor(agentId);
      agent.exitCode = code;
      agent.exitSignal = signal;
      agent.endedAt = Date.now();

      const targetStatus = code === 0 ? AGENT_STATUS.TERMINATED : AGENT_STATUS.ERRORED;
      try { this._transition(agentId, targetStatus); } catch { /* already terminal */ }

      this.emit('exit', { agentId, code, signal });
      this._handleUnexpectedExit(agentId, code);
    });
  }

  // ── Public API ──

  /**
   * Spawn an agent process.
   * config: { execPath, args?, cwd?, env?, label?, resourceLimits?, recovery? }
   */
  spawnAgent(config) {
    if (!config || !config.execPath) throw new Error('execPath is required');

    const agentId = randomUUID();

    const agent = {
      id: agentId,
      config: { ...config, label: config.label || path.basename(config.execPath) },
      process: null,
      status: AGENT_STATUS.CREATED,
      logs: [],
      pid: null,
      startedAt: null,
      endedAt: null,
      exitCode: null,
      exitSignal: null,
      error: null,
      stateHistory: [{ from: null, to: AGENT_STATUS.CREATED, at: Date.now() }],
      resourceLimits: { ...DEFAULT_RESOURCE_LIMITS, ...(config.resourceLimits || {}) },
      resourceUsage: null,
      recoveryConfig: { ...DEFAULT_RECOVERY, ...(config.recovery || {}) },
      _retryCount: 0,
      _intentionalStop: false,
      _restartOnCleanExit: false,
      _resourceTimer: null,
      _recoveryTimer: null,
    };

    this.agents.set(agentId, agent);

    try { this._spawnProcess(agentId, config); } catch { /* error recorded on agent */ }

    return { agentId, status: agent.status };
  }

  /**
   * Pause a running agent (SIGSTOP).
   */
  pauseAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    if (!agent.process || agent.process.killed) {
      throw new Error(`Agent process not running: ${agentId}`);
    }

    this._transition(agentId, AGENT_STATUS.PAUSED);
    agent.process.kill('SIGSTOP');
    this._stopResourceMonitor(agentId);
    return { agentId, status: AGENT_STATUS.PAUSED };
  }

  /**
   * Resume a paused agent (SIGCONT).
   */
  resumeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    this._transition(agentId, AGENT_STATUS.RUNNING);
    agent.process.kill('SIGCONT');
    this._startResourceMonitor(agentId);
    return { agentId, status: AGENT_STATUS.RUNNING };
  }

  /**
   * Terminate a running agent (SIGTERM, then SIGKILL after 5s).
   */
  stopAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    if (!agent.process || agent.process.killed) {
      throw new Error(`Agent process already exited: ${agentId}`);
    }

    agent._intentionalStop = true;
    if (agent._recoveryTimer) {
      clearTimeout(agent._recoveryTimer);
      agent._recoveryTimer = null;
    }

    this._transition(agentId, AGENT_STATUS.TERMINATED);
    agent.process.kill('SIGTERM');

    const forceTimer = setTimeout(() => {
      try { if (agent.process && !agent.process.killed) agent.process.kill('SIGKILL'); } catch { /* ignore */ }
    }, 5000);

    agent.process.on('close', () => { clearTimeout(forceTimer); });
    return { agentId, status: AGENT_STATUS.TERMINATED };
  }

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
      resourceUsage: agent.resourceUsage,
      resourceLimits: agent.resourceLimits,
      retryCount: agent._retryCount,
      stateHistory: agent.stateHistory,
    };
  }

  listAgents() {
    return Array.from(this.agents.keys()).map((id) => this.getAgent(id));
  }

  getLogs(agentId, opts = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    const { limit = 500, offset = 0 } = opts;
    return agent.logs.slice(offset, offset + limit);
  }

  removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    if (agent.process && !agent.process.killed) {
      throw new Error(`Cannot remove running agent: ${agentId}`);
    }
    if (agent._resourceTimer) clearInterval(agent._resourceTimer);
    if (agent._recoveryTimer) clearTimeout(agent._recoveryTimer);
    this.agents.delete(agentId);
    return true;
  }

  getValidTransitions(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    return VALID_TRANSITIONS[agent.status] || [];
  }

  async shutdownAll() {
    const agents = Array.from(this.agents.values());
    const promises = agents
      .filter((a) => a.process && !a.process.killed)
      .map((a) => {
        a._intentionalStop = true;
        try { a.process.kill('SIGTERM'); } catch { /* ignore */ }
        return new Promise((resolve) => {
          a.process.on('close', resolve);
          setTimeout(() => {
            try { if (!a.process.killed) a.process.kill('SIGKILL'); } catch { /* ignore */ }
            resolve();
          }, 5000);
        });
      });
    await Promise.all(promises);
  }
}

module.exports = { AgentEngine, AGENT_STATUS, VALID_TRANSITIONS };
