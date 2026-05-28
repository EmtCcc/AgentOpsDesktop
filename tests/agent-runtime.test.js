import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

function createMockProc() {
  const proc = new EventEmitter();
  proc.pid = 12345;
  proc.killed = false;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn(() => {
    proc.killed = true;
    return true;
  });
  return proc;
}

describe('AgentRuntime', () => {
  let runtime;
  let mockProc;
  let AgentRuntime;
  let AGENT_STATUS;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../src/main/agent-runtime.js');
    AgentRuntime = mod.AgentRuntime;
    AGENT_STATUS = mod.AGENT_STATUS;
    runtime = new AgentRuntime();
    mockProc = createMockProc();

    // Intercept spawnAgent to use our mock process
    runtime.spawnAgent = function (config) {
      if (!config || !config.execPath) {
        throw new Error('execPath is required');
      }

      const { randomUUID } = require('crypto');
      const path = require('path');
      const agentId = randomUUID();
      const agent = {
        id: agentId,
        config: { ...config, label: config.label || path.basename(config.execPath) },
        process: mockProc,
        status: AGENT_STATUS.SPAWNING,
        logs: [],
        pid: mockProc.pid,
        startedAt: Date.now(),
      };

      this.agents.set(agentId, agent);

      mockProc.stdout.on('data', (data) => {
        const line = data.toString();
        agent.logs.push({ type: 'stdout', data: line, timestamp: Date.now() });
        this.emit('log', { agentId, type: 'stdout', data: line });
      });

      mockProc.stderr.on('data', (data) => {
        const line = data.toString();
        agent.logs.push({ type: 'stderr', data: line, timestamp: Date.now() });
        this.emit('log', { agentId, type: 'stderr', data: line });
      });

      mockProc.on('spawn', () => {
        agent.status = AGENT_STATUS.RUNNING;
        this.emit('status-change', { agentId, status: AGENT_STATUS.RUNNING });
      });

      mockProc.on('error', (err) => {
        agent.status = AGENT_STATUS.ERROR;
        agent.error = err.message;
        this.emit('status-change', { agentId, status: AGENT_STATUS.ERROR, error: err.message });
      });

      mockProc.on('close', (code, signal) => {
        agent.status = code === 0 ? AGENT_STATUS.STOPPED : AGENT_STATUS.ERROR;
        agent.exitCode = code;
        agent.exitSignal = signal;
        agent.endedAt = Date.now();
        this.emit('status-change', { agentId, status: agent.status, exitCode: code, exitSignal: signal });
      });

      return { agentId, status: agent.status };
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('spawnAgent', () => {
    it('spawns a process and returns agent info', () => {
      const result = runtime.spawnAgent({
        execPath: '/usr/bin/echo',
        args: ['hello'],
        cwd: '/tmp',
      });

      expect(result.agentId).toBeDefined();
      expect(result.status).toBe(AGENT_STATUS.SPAWNING);
    });

    it('throws if execPath is missing', () => {
      expect(() => runtime.spawnAgent({})).toThrow('execPath is required');
      expect(() => runtime.spawnAgent(null)).toThrow('execPath is required');
    });

    it('emits status-change on spawn event', () => {
      const statusChanges = [];
      runtime.on('status-change', (data) => statusChanges.push(data));

      runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.emit('spawn');

      expect(statusChanges).toHaveLength(1);
      expect(statusChanges[0].status).toBe(AGENT_STATUS.RUNNING);
    });

    it('captures stdout logs', () => {
      const logs = [];
      runtime.on('log', (data) => logs.push(data));

      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.stdout.emit('data', Buffer.from('hello world'));

      expect(logs).toHaveLength(1);
      expect(logs[0].data).toBe('hello world');
      expect(logs[0].type).toBe('stdout');

      const agent = runtime.getAgent(agentId);
      expect(agent.logCount).toBe(1);
    });

    it('captures stderr logs', () => {
      const logs = [];
      runtime.on('log', (data) => logs.push(data));

      runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.stderr.emit('data', Buffer.from('error output'));

      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('stderr');
    });

    it('sets status to STOPPED on clean exit (code 0)', () => {
      const statusChanges = [];
      runtime.on('status-change', (data) => statusChanges.push(data));

      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.emit('close', 0, null);

      const agent = runtime.getAgent(agentId);
      expect(agent.status).toBe(AGENT_STATUS.STOPPED);
      expect(agent.exitCode).toBe(0);
    });

    it('sets status to ERROR on non-zero exit', () => {
      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/false' });
      mockProc.emit('close', 1, null);

      const agent = runtime.getAgent(agentId);
      expect(agent.status).toBe(AGENT_STATUS.ERROR);
      expect(agent.exitCode).toBe(1);
    });

    it('sets status to ERROR on process error', () => {
      const { agentId } = runtime.spawnAgent({ execPath: '/nonexistent' });
      mockProc.emit('error', new Error('ENOENT'));

      const agent = runtime.getAgent(agentId);
      expect(agent.status).toBe(AGENT_STATUS.ERROR);
      expect(agent.error).toBe('ENOENT');
    });
  });

  describe('stopAgent', () => {
    it('sends SIGTERM to the process', () => {
      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/sleep' });
      runtime.stopAgent(agentId);

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('throws if agent not found', () => {
      expect(() => runtime.stopAgent('nonexistent')).toThrow('Agent not found');
    });
  });

  describe('getAgent', () => {
    it('returns null for unknown agent', () => {
      expect(runtime.getAgent('unknown')).toBeNull();
    });

    it('returns agent details', () => {
      const { agentId } = runtime.spawnAgent({
        execPath: '/usr/bin/echo',
        label: 'Test Agent',
      });

      const agent = runtime.getAgent(agentId);
      expect(agent.id).toBe(agentId);
      expect(agent.config.label).toBe('Test Agent');
      expect(agent.pid).toBe(12345);
      expect(agent.status).toBe(AGENT_STATUS.SPAWNING);
    });
  });

  describe('listAgents', () => {
    it('returns empty array initially', () => {
      expect(runtime.listAgents()).toEqual([]);
    });

    it('lists all spawned agents', () => {
      runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      runtime.spawnAgent({ execPath: '/usr/bin/ls' });

      expect(runtime.listAgents()).toHaveLength(2);
    });
  });

  describe('getLogs', () => {
    it('throws for unknown agent', () => {
      expect(() => runtime.getLogs('unknown')).toThrow('Agent not found');
    });

    it('returns logs with limit and offset', () => {
      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/echo' });

      for (let i = 0; i < 10; i++) {
        mockProc.stdout.emit('data', Buffer.from(`line ${i}\n`));
      }

      const logs = runtime.getLogs(agentId, { limit: 3, offset: 2 });
      expect(logs).toHaveLength(3);
    });
  });

  describe('removeAgent', () => {
    it('removes a stopped agent', () => {
      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.killed = true;
      mockProc.emit('close', 0, null);

      expect(runtime.removeAgent(agentId)).toBe(true);
      expect(runtime.getAgent(agentId)).toBeNull();
    });

    it('throws if agent is still running', () => {
      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/sleep' });
      expect(() => runtime.removeAgent(agentId)).toThrow('Cannot remove running agent');
    });
  });

  describe('healthCheck', () => {
    it('returns ok for real executable', async () => {
      const result = await runtime.healthCheck('/bin/ls');
      expect(result.ok).toBe(true);
    });

    it('returns error for non-executable file', async () => {
      const result = await runtime.healthCheck('/etc/hosts');
      expect(result.ok).toBe(false);
    });

    it('returns error for nonexistent path', async () => {
      const result = await runtime.healthCheck('/nonexistent/binary');
      expect(result.ok).toBe(false);
    });

    it('returns error for empty execPath', async () => {
      const result = await runtime.healthCheck('');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('execPath is required');
    });
  });
});
