import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentRuntime, AGENT_STATUS } from '../src/main/agent-runtime.js';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => {
  const { EventEmitter } = require('events');
  const mockProc = new EventEmitter();
  mockProc.pid = 12345;
  mockProc.killed = false;
  mockProc.stdout = new EventEmitter();
  mockProc.stderr = new EventEmitter();
  mockProc.kill = vi.fn(() => {
    mockProc.killed = true;
    return true;
  });

  return {
    spawn: vi.fn(() => mockProc),
  };
});

vi.mock('fs', () => ({
  default: {
    statSync: vi.fn(),
  },
  statSync: vi.fn(),
}));

describe('AgentRuntime', () => {
  let runtime;
  let mockProc;
  let spawnMock;
  let fsMock;

  beforeEach(async () => {
    vi.clearAllMocks();
    runtime = new AgentRuntime();

    const cp = await import('child_process');
    spawnMock = cp.spawn;

    const fs = await import('fs');
    fsMock = fs;

    // Reset mock proc
    const { EventEmitter } = require('events');
    mockProc = new EventEmitter();
    mockProc.pid = 12345;
    mockProc.killed = false;
    mockProc.stdout = new EventEmitter();
    mockProc.stderr = new EventEmitter();
    mockProc.kill = vi.fn(() => {
      mockProc.killed = true;
      return true;
    });

    spawnMock.mockReturnValue(mockProc);
  });

  afterEach(() => {
    // Clean up any remaining timers
    vi.restoreAllMocks();
  });

  describe('spawnAgent', () => {
    it('spawns a process and returns agent info', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const result = runtime.spawnAgent({
        execPath: '/usr/bin/echo',
        args: ['hello'],
        cwd: '/tmp',
      });

      expect(result.agentId).toBeDefined();
      expect(result.status).toBe(AGENT_STATUS.SPAWNING);
      expect(spawnMock).toHaveBeenCalledWith('/usr/bin/echo', ['hello'], expect.objectContaining({
        cwd: '/tmp',
        stdio: ['pipe', 'pipe', 'pipe'],
      }));
    });

    it('throws if execPath is missing', () => {
      expect(() => runtime.spawnAgent({})).toThrow('execPath is required');
      expect(() => runtime.spawnAgent(null)).toThrow('execPath is required');
    });

    it('emits status-change on spawn event', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const statusChanges = [];
      runtime.on('status-change', (data) => statusChanges.push(data));

      runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.emit('spawn');

      expect(statusChanges).toHaveLength(1);
      expect(statusChanges[0].status).toBe(AGENT_STATUS.RUNNING);
    });

    it('captures stdout logs', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

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
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const logs = [];
      runtime.on('log', (data) => logs.push(data));

      runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.stderr.emit('data', Buffer.from('error output'));

      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('stderr');
    });

    it('sets status to STOPPED on clean exit (code 0)', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const statusChanges = [];
      runtime.on('status-change', (data) => statusChanges.push(data));

      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.emit('close', 0, null);

      const agent = runtime.getAgent(agentId);
      expect(agent.status).toBe(AGENT_STATUS.STOPPED);
      expect(agent.exitCode).toBe(0);
    });

    it('sets status to ERROR on non-zero exit', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/false' });
      mockProc.emit('close', 1, null);

      const agent = runtime.getAgent(agentId);
      expect(agent.status).toBe(AGENT_STATUS.ERROR);
      expect(agent.exitCode).toBe(1);
    });

    it('sets status to ERROR on process error', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const { agentId } = runtime.spawnAgent({ execPath: '/nonexistent' });
      mockProc.emit('error', new Error('ENOENT'));

      const agent = runtime.getAgent(agentId);
      expect(agent.status).toBe(AGENT_STATUS.ERROR);
      expect(agent.error).toBe('ENOENT');
    });
  });

  describe('stopAgent', () => {
    it('sends SIGTERM to the process', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

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
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

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
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

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
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/echo' });

      // Generate some logs
      for (let i = 0; i < 10; i++) {
        mockProc.stdout.emit('data', Buffer.from(`line ${i}\n`));
      }

      const logs = runtime.getLogs(agentId, { limit: 3, offset: 2 });
      expect(logs).toHaveLength(3);
    });
  });

  describe('removeAgent', () => {
    it('removes a stopped agent', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/echo' });
      mockProc.emit('close', 0, null);

      expect(runtime.removeAgent(agentId)).toBe(true);
      expect(runtime.getAgent(agentId)).toBeNull();
    });

    it('throws if agent is still running', () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const { agentId } = runtime.spawnAgent({ execPath: '/usr/bin/sleep' });
      expect(() => runtime.removeAgent(agentId)).toThrow('Cannot remove running agent');
    });
  });

  describe('healthCheck', () => {
    it('returns ok for executable file', async () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o755 });

      const result = await runtime.healthCheck('/usr/bin/echo');
      expect(result.ok).toBe(true);
    });

    it('returns error for non-executable file', async () => {
      fsMock.statSync.mockReturnValue({ isFile: () => true, mode: 0o644 });

      const result = await runtime.healthCheck('/etc/hosts');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Not executable');
    });

    it('returns error for missing path', async () => {
      fsMock.statSync.mockImplementation(() => { throw new Error('ENOENT'); });

      // Mock _which to also fail
      spawnMock.mockImplementation(() => {
        const proc = new (require('events').EventEmitter)();
        proc.stdout = new (require('events').EventEmitter)();
        proc.on = vi.fn();
        setTimeout(() => proc.emit('close', 1), 0);
        return proc;
      });

      const result = await runtime.healthCheck('/nonexistent');
      expect(result.ok).toBe(false);
    });

    it('returns error for empty execPath', async () => {
      const result = await runtime.healthCheck('');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('execPath is required');
    });
  });
});
