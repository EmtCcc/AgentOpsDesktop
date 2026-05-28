import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const { AgentEngine, AGENT_STATUS, VALID_TRANSITIONS } = await import('../src/main/agent-engine.js');

function createMockProc() {
  const proc = new EventEmitter();
  proc.pid = 12345 + Math.floor(Math.random() * 10000);
  proc.killed = false;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn((signal) => {
    // Only set killed for signals that actually terminate
    if (signal !== 'SIGSTOP' && signal !== 'SIGCONT') {
      proc.killed = true;
    }
    return true;
  });
  proc.on('close', () => { proc.killed = true; });
  return proc;
}

describe('AgentEngine', () => {
  let engine;
  let mockProc;
  let spawnMock;

  beforeEach(() => {
    mockProc = createMockProc();
    spawnMock = vi.fn(() => mockProc);
    engine = new AgentEngine({ spawnFn: spawnMock });
  });

  function spawnAgent(overrides = {}) {
    return engine.spawnAgent({ execPath: '/usr/bin/echo', ...overrides });
  }

  function spawnAndRunning(overrides = {}) {
    const result = spawnAgent(overrides);
    mockProc.emit('spawn');
    return result;
  }

  // ══════════════════════════════════════════════════════════
  // LIFECYCLE STATE MACHINE
  // ══════════════════════════════════════════════════════════

  describe('Lifecycle state machine', () => {
    it('starts in CREATED state', () => {
      const { agentId } = spawnAgent();
      expect(engine.getAgent(agentId).status).toBe(AGENT_STATUS.CREATED);
    });

    it('transitions CREATED → RUNNING on spawn event', () => {
      const { agentId } = spawnAgent();
      const changes = [];
      engine.on('status-change', (d) => changes.push(d));

      mockProc.emit('spawn');

      expect(engine.getAgent(agentId).status).toBe(AGENT_STATUS.RUNNING);
      expect(changes).toHaveLength(1);
      expect(changes[0].from).toBe(AGENT_STATUS.CREATED);
      expect(changes[0].status).toBe(AGENT_STATUS.RUNNING);
    });

    it('transitions RUNNING → PAUSED → RUNNING', () => {
      const { agentId } = spawnAndRunning();

      engine.pauseAgent(agentId);
      expect(engine.getAgent(agentId).status).toBe(AGENT_STATUS.PAUSED);

      engine.resumeAgent(agentId);
      expect(engine.getAgent(agentId).status).toBe(AGENT_STATUS.RUNNING);
    });

    it('transitions RUNNING → TERMINATED on clean exit', () => {
      const { agentId } = spawnAndRunning();
      mockProc.emit('close', 0, null);

      expect(engine.getAgent(agentId).status).toBe(AGENT_STATUS.TERMINATED);
      expect(engine.getAgent(agentId).exitCode).toBe(0);
    });

    it('transitions RUNNING → ERRORED on non-zero exit', () => {
      const { agentId } = spawnAndRunning();
      mockProc.emit('close', 1, null);

      expect(engine.getAgent(agentId).status).toBe(AGENT_STATUS.ERRORED);
      expect(engine.getAgent(agentId).exitCode).toBe(1);
    });

    it('transitions RUNNING → ERRORED on process error', () => {
      const { agentId } = spawnAndRunning();
      mockProc.emit('error', new Error('ENOENT'));

      expect(engine.getAgent(agentId).status).toBe(AGENT_STATUS.ERRORED);
      expect(engine.getAgent(agentId).error).toBe('ENOENT');
    });

    it('transitions PAUSED → TERMINATED on stop', () => {
      const { agentId } = spawnAndRunning();
      engine.pauseAgent(agentId);
      engine.stopAgent(agentId);
      expect(engine.getAgent(agentId).status).toBe(AGENT_STATUS.TERMINATED);
    });

    it('rejects CREATED → PAUSED', () => {
      const { agentId } = spawnAgent();
      expect(() => engine.pauseAgent(agentId)).toThrow('Invalid transition');
    });

    it('rejects stop on already-exited process', () => {
      const { agentId } = spawnAndRunning();
      mockProc.emit('close', 0, null);
      expect(() => engine.stopAgent(agentId)).toThrow('Agent process already exited');
    });

    it('records state history', () => {
      const { agentId } = spawnAndRunning();
      engine.pauseAgent(agentId);

      const agent = engine.getAgent(agentId);
      expect(agent.stateHistory).toHaveLength(3);
      expect(agent.stateHistory[0].to).toBe(AGENT_STATUS.CREATED);
      expect(agent.stateHistory[1].to).toBe(AGENT_STATUS.RUNNING);
      expect(agent.stateHistory[2].to).toBe(AGENT_STATUS.PAUSED);
    });

    it('getValidTransitions for CREATED allows RUNNING and ERRORED', () => {
      const { agentId } = spawnAgent();
      const t = engine.getValidTransitions(agentId);
      expect(t).toContain(AGENT_STATUS.RUNNING);
      expect(t).toContain(AGENT_STATUS.ERRORED);
      expect(t).not.toContain(AGENT_STATUS.PAUSED);
      expect(t).not.toContain(AGENT_STATUS.TERMINATED);
    });

    it('getValidTransitions for RUNNING allows PAUSED, TERMINATED, ERRORED', () => {
      const { agentId } = spawnAndRunning();
      const t = engine.getValidTransitions(agentId);
      expect(t).toContain(AGENT_STATUS.PAUSED);
      expect(t).toContain(AGENT_STATUS.TERMINATED);
      expect(t).toContain(AGENT_STATUS.ERRORED);
    });

    it('terminal states have no transitions', () => {
      const { agentId } = spawnAndRunning();
      mockProc.emit('close', 0, null);
      expect(engine.getValidTransitions(agentId)).toEqual([]);
    });

    it('throws getValidTransitions for unknown agent', () => {
      expect(() => engine.getValidTransitions('unknown')).toThrow('Agent not found');
    });
  });

  // ══════════════════════════════════════════════════════════
  // RESOURCE LIMITS
  // ══════════════════════════════════════════════════════════

  describe('Resource limits', () => {
    it('spawns with default resource limits', () => {
      const { agentId } = spawnAgent();
      const agent = engine.getAgent(agentId);
      expect(agent.resourceLimits.maxCpuPercent).toBe(80);
      expect(agent.resourceLimits.maxMemoryMB).toBe(512);
      expect(agent.resourceLimits.checkIntervalMs).toBe(5000);
    });

    it('accepts custom resource limits', () => {
      const { agentId } = spawnAgent({
        resourceLimits: { maxMemoryMB: 256, maxCpuPercent: 50 },
      });
      const agent = engine.getAgent(agentId);
      expect(agent.resourceLimits.maxMemoryMB).toBe(256);
      expect(agent.resourceLimits.maxCpuPercent).toBe(50);
      expect(agent.resourceLimits.checkIntervalMs).toBe(5000);
    });

    it('starts resource monitor on spawn', () => {
      const { agentId } = spawnAgent();
      mockProc.emit('spawn');
      expect(engine.agents.get(agentId)._resourceTimer).not.toBeNull();
    });

    it('stops resource monitor on exit', () => {
      const { agentId } = spawnAndRunning();
      mockProc.emit('close', 0, null);
      expect(engine.agents.get(agentId)._resourceTimer).toBeNull();
    });

    it('emits resource-limit when memory exceeded', async () => {
      const events = [];
      engine.on('resource-limit', (d) => events.push(d));
      engine._getProcessResourceUsage = vi.fn().mockResolvedValue({ rss: 10 * 1024 * 1024, cpuPercent: 0 });

      const { agentId } = spawnAndRunning({ resourceLimits: { maxMemoryMB: 1, checkIntervalMs: 100000 } });
      await engine._checkResources(agentId);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('memory');
    });

    it('emits cpu warning when cpu exceeds limit', async () => {
      const events = [];
      engine.on('resource-limit', (d) => events.push(d));
      engine._getProcessResourceUsage = vi.fn().mockResolvedValue({ rss: 1024, cpuPercent: 95 });

      const { agentId } = spawnAndRunning({ resourceLimits: { maxCpuPercent: 80, maxMemoryMB: 500, checkIntervalMs: 100000 } });
      await engine._checkResources(agentId);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('cpu');
    });
  });

  // ══════════════════════════════════════════════════════════
  // CRASH RECOVERY
  // ══════════════════════════════════════════════════════════

  describe('Crash recovery', () => {
    it('does not restart by default (recovery disabled)', () => {
      const { agentId } = spawnAndRunning();
      const events = [];
      engine.on('recovery-attempt', (d) => events.push(d));

      mockProc.emit('close', 1, null);

      expect(engine.agents.get(agentId)._recoveryTimer).toBeNull();
      expect(events).toHaveLength(0);
    });

    it('schedules restart when recovery enabled', () => {
      const { agentId } = spawnAndRunning({
        recovery: { enabled: true, maxRetries: 3, initialBackoffMs: 100, maxBackoffMs: 1000, backoffMultiplier: 2 },
      });
      const events = [];
      engine.on('recovery-attempt', (d) => events.push(d));

      mockProc.emit('close', 1, null);

      expect(events).toHaveLength(1);
      expect(events[0].attempt).toBe(1);
      expect(events[0].backoffMs).toBe(100);
      expect(events[0].maxRetries).toBe(3);
    });

    it('does not restart on intentional stop', () => {
      const { agentId } = spawnAndRunning({ recovery: { enabled: true, maxRetries: 3, initialBackoffMs: 50 } });
      const events = [];
      engine.on('recovery-attempt', (d) => events.push(d));

      engine.stopAgent(agentId);
      mockProc.emit('close', 0, null);

      expect(events).toHaveLength(0);
    });

    it('does not restart on clean exit', () => {
      const { agentId } = spawnAndRunning({ recovery: { enabled: true, maxRetries: 3, initialBackoffMs: 50 } });
      const events = [];
      engine.on('recovery-attempt', (d) => events.push(d));

      mockProc.emit('close', 0, null);
      expect(events).toHaveLength(0);
    });

    it('increments retry count', () => {
      const { agentId } = spawnAndRunning({ recovery: { enabled: true, maxRetries: 5, initialBackoffMs: 100 } });
      mockProc.emit('close', 1, null);
      expect(engine.agents.get(agentId)._retryCount).toBe(1);
    });

    it('emits recovery-exhausted after maxRetries', () => {
      const { agentId } = spawnAndRunning({ recovery: { enabled: true, maxRetries: 2, initialBackoffMs: 50 } });
      const events = [];
      engine.on('recovery-exhausted', (d) => events.push(d));

      engine.agents.get(agentId)._retryCount = 2;
      mockProc.emit('close', 1, null);

      expect(events).toHaveLength(1);
      expect(events[0].retries).toBe(3);
    });

    it('caps backoff at maxBackoffMs', () => {
      const { agentId } = spawnAndRunning({ recovery: { enabled: true, maxRetries: 10, initialBackoffMs: 1000, maxBackoffMs: 5000, backoffMultiplier: 10 } });
      const events = [];
      engine.on('recovery-attempt', (d) => events.push(d));

      engine.agents.get(agentId)._retryCount = 2;
      mockProc.emit('close', 1, null);

      expect(events[0].backoffMs).toBe(5000);
    });

    it('has correct default recoveryConfig', () => {
      const { agentId } = spawnAgent();
      const agent = engine.agents.get(agentId);
      expect(agent.recoveryConfig.enabled).toBe(false);
      expect(agent.recoveryConfig.maxRetries).toBe(3);
      expect(agent.recoveryConfig.initialBackoffMs).toBe(1000);
      expect(agent.recoveryConfig.maxBackoffMs).toBe(30000);
      expect(agent.recoveryConfig.backoffMultiplier).toBe(2);
    });
  });

  // ══════════════════════════════════════════════════════════
  // SPAWN / STOP / PAUSE / RESUME
  // ══════════════════════════════════════════════════════════

  describe('spawnAgent', () => {
    it('spawns a process and returns agent info', () => {
      const result = engine.spawnAgent({ execPath: '/usr/bin/echo', args: ['hello'], cwd: '/tmp' });
      expect(result.agentId).toBeDefined();
      expect(result.status).toBe(AGENT_STATUS.CREATED);
      expect(spawnMock).toHaveBeenCalledWith('/usr/bin/echo', ['hello'], expect.objectContaining({ cwd: '/tmp' }));
    });

    it('throws if execPath is missing', () => {
      expect(() => engine.spawnAgent({})).toThrow('execPath is required');
      expect(() => engine.spawnAgent(null)).toThrow('execPath is required');
    });

    it('captures stdout logs', () => {
      const { agentId } = spawnAgent();
      const logs = [];
      engine.on('log', (data) => logs.push(data));
      mockProc.stdout.emit('data', Buffer.from('hello world'));
      expect(logs).toHaveLength(1);
      expect(logs[0].data).toBe('hello world');
      expect(engine.getAgent(agentId).logCount).toBe(1);
    });

    it('captures stderr logs', () => {
      const { agentId } = spawnAgent();
      const logs = [];
      engine.on('log', (data) => logs.push(data));
      mockProc.stderr.emit('data', Buffer.from('error output'));
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('stderr');
    });

    it('emits exit event on close', () => {
      const { agentId } = spawnAndRunning();
      const exits = [];
      engine.on('exit', (d) => exits.push(d));
      mockProc.emit('close', 0, null);
      expect(exits).toHaveLength(1);
      expect(exits[0].agentId).toBe(agentId);
    });

    it('sets default label from execPath', () => {
      const { agentId } = spawnAgent({ execPath: '/usr/bin/my-agent' });
      expect(engine.getAgent(agentId).config.label).toBe('my-agent');
    });

    it('uses custom label', () => {
      const { agentId } = spawnAgent({ label: 'Custom Agent' });
      expect(engine.getAgent(agentId).config.label).toBe('Custom Agent');
    });
  });

  describe('pauseAgent', () => {
    it('sends SIGSTOP and transitions to PAUSED', () => {
      const { agentId } = spawnAndRunning();
      const result = engine.pauseAgent(agentId);
      expect(result.status).toBe(AGENT_STATUS.PAUSED);
      expect(mockProc.kill).toHaveBeenCalledWith('SIGSTOP');
    });

    it('throws if agent not found', () => {
      expect(() => engine.pauseAgent('nonexistent')).toThrow('Agent not found');
    });

    it('throws if agent not running', () => {
      const { agentId } = spawnAgent();
      expect(() => engine.pauseAgent(agentId)).toThrow('Invalid transition');
    });
  });

  describe('resumeAgent', () => {
    it('sends SIGCONT and transitions to RUNNING', () => {
      const { agentId } = spawnAndRunning();
      engine.pauseAgent(agentId);
      const result = engine.resumeAgent(agentId);
      expect(result.status).toBe(AGENT_STATUS.RUNNING);
      expect(mockProc.kill).toHaveBeenCalledWith('SIGCONT');
    });

    it('throws if agent not paused', () => {
      const { agentId } = spawnAndRunning();
      expect(() => engine.resumeAgent(agentId)).toThrow('Invalid transition');
    });
  });

  describe('stopAgent', () => {
    it('sends SIGTERM', () => {
      const { agentId } = spawnAndRunning();
      engine.stopAgent(agentId);
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('throws if agent not found', () => {
      expect(() => engine.stopAgent('nonexistent')).toThrow('Agent not found');
    });

    it('throws if agent already exited', () => {
      const { agentId } = spawnAndRunning();
      mockProc.emit('close', 0, null);
      expect(() => engine.stopAgent(agentId)).toThrow('Agent process already exited');
    });

    it('marks as intentional stop', () => {
      const { agentId } = spawnAndRunning();
      engine.stopAgent(agentId);
      expect(engine.agents.get(agentId)._intentionalStop).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════
  // QUERIES
  // ══════════════════════════════════════════════════════════

  describe('getAgent', () => {
    it('returns null for unknown', () => {
      expect(engine.getAgent('unknown')).toBeNull();
    });

    it('returns full details', () => {
      const { agentId } = spawnAgent({ label: 'Test' });
      const agent = engine.getAgent(agentId);
      expect(agent.id).toBe(agentId);
      expect(agent.config.label).toBe('Test');
      expect(agent.status).toBe(AGENT_STATUS.CREATED);
      expect(agent.resourceLimits).toBeDefined();
      expect(agent.stateHistory).toBeDefined();
    });
  });

  describe('listAgents', () => {
    it('returns empty initially', () => {
      expect(engine.listAgents()).toEqual([]);
    });

    it('lists all agents', () => {
      spawnAgent();
      spawnAgent();
      expect(engine.listAgents()).toHaveLength(2);
    });
  });

  describe('getLogs', () => {
    it('throws for unknown', () => {
      expect(() => engine.getLogs('unknown')).toThrow('Agent not found');
    });

    it('returns logs with limit/offset', () => {
      const { agentId } = spawnAgent();
      for (let i = 0; i < 10; i++) mockProc.stdout.emit('data', Buffer.from(`line ${i}\n`));
      expect(engine.getLogs(agentId, { limit: 3, offset: 2 })).toHaveLength(3);
    });
  });

  describe('removeAgent', () => {
    it('removes a terminated agent', () => {
      const { agentId } = spawnAndRunning();
      mockProc.emit('close', 0, null);
      expect(engine.removeAgent(agentId)).toBe(true);
      expect(engine.getAgent(agentId)).toBeNull();
    });

    it('throws if still running', () => {
      const { agentId } = spawnAndRunning();
      expect(() => engine.removeAgent(agentId)).toThrow('Cannot remove running agent');
    });
  });

  // ══════════════════════════════════════════════════════════
  // VALID_TRANSITIONS
  // ══════════════════════════════════════════════════════════

  describe('VALID_TRANSITIONS', () => {
    it('defines transitions for all states', () => {
      for (const status of Object.values(AGENT_STATUS)) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
      }
    });

    it('terminal states have no transitions', () => {
      expect(VALID_TRANSITIONS[AGENT_STATUS.TERMINATED]).toEqual([]);
      expect(VALID_TRANSITIONS[AGENT_STATUS.ERRORED]).toEqual([]);
    });
  });
});
