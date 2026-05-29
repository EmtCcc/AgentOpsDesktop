import { bench, describe, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Top-level mocks for modules that depend on electron
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-bench-logs' },
}));

vi.mock('../../src/main/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn(),
}));

// Direct imports (no electron dependency)
import { AgentRuntime, AGENT_STATUS } from '../../src/main/agent-runtime.js';
import { AgentEngine } from '../../src/main/agent-engine.js';
import monitor from '../../src/main/monitor.js';
import logController from '../../src/main/ipc/controllers/log.controller.js';

// ── Helpers ──

function createMockProc({ emitSpawn = true } = {}) {
  const proc = new EventEmitter();
  proc.pid = Math.floor(Math.random() * 60000) + 1000;
  proc.killed = false;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn(() => {
    proc.killed = true;
    return true;
  });
  if (emitSpawn) {
    process.nextTick(() => {
      try { proc.emit('spawn'); } catch { /* ignore post-cleanup */ }
    });
  }
  return proc;
}

// ── Agent Spawn Latency ──

describe('Agent Spawn Latency', () => {
  bench('spawnAgent orchestration (mock process)', () => {
    const runtime = new AgentRuntime();
    const mockProc = createMockProc();

    runtime.spawnAgent = function (config) {
      if (!config || !config.execPath) throw new Error('execPath is required');
      const { randomUUID } = require('crypto');
      const agentId = randomUUID();
      const agent = {
        id: agentId,
        config: { ...config, label: config.execPath },
        process: mockProc,
        status: AGENT_STATUS.SPAWNING,
        logs: [],
        output: null,
        stdoutBuffer: '',
        pid: mockProc.pid,
        startedAt: Date.now(),
      };
      this.agents.set(agentId, agent);
      agent.status = AGENT_STATUS.RUNNING;
      return { agentId, status: agent.status };
    };

    runtime.spawnAgent({ execPath: '/usr/bin/true' });
    runtime.agents.clear();
  });

  bench('healthCheck (valid path)', async () => {
    const runtime = new AgentRuntime();
    await runtime.healthCheck('/usr/bin/true');
  });

  bench('healthCheck (PATH lookup)', async () => {
    const runtime = new AgentRuntime();
    await runtime.healthCheck('node');
  });
});

// ── Log Stream Throughput ──

describe('Log Stream Throughput', () => {
  bench('append 1000 log entries', () => {
    logController.setMainWindow(null);
    for (let i = 0; i < 1000; i++) {
      logController.append(null, {
        message: `benchmark log entry ${i}`,
        level: 'info',
        stream: 'stdout',
      });
    }
  });

  bench('append single entry', () => {
    logController.setMainWindow(null);
    logController.append(null, {
      message: 'single benchmark entry',
      level: 'info',
      stream: 'stdout',
    });
  });
});

// ── Monitor Health Check ──

describe('Monitor Health Check', () => {
  bench('getHealth() snapshot', () => {
    monitor.getHealth();
  });

  bench('recordIpcCall + getHealth cycle', () => {
    monitor.recordIpcCall('bench:test', 5, null);
    monitor.getHealth();
  });
});

// ── Agent Engine ──

describe('Agent Engine', () => {
  bench('spawnAgent + getAgent (mock spawn)', () => {
    const mockProc = createMockProc({ emitSpawn: false });
    const engine = new AgentEngine({
      spawnFn: () => mockProc,
    });
    const { agentId } = engine.spawnAgent({
      execPath: '/usr/bin/true',
      label: 'bench-agent',
    });
    engine.getAgent(agentId);
    // Remove cleanly without triggering async events
    engine.agents.delete(agentId);
  });

  bench('listAgents (10 agents)', () => {
    const engine = new AgentEngine({
      spawnFn: () => createMockProc({ emitSpawn: false }),
    });
    for (let i = 0; i < 10; i++) {
      engine.spawnAgent({ execPath: '/usr/bin/true', label: `agent-${i}` });
    }
    engine.listAgents();
    engine.agents.clear();
  });
});
