import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock electron before any imports
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-agentops-logs' },
}));

// Mock logger to avoid file I/O
vi.mock('../src/main/logger.js', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  logDir: '/tmp/test-logs',
  logFile: '/tmp/test-logs/test.jsonl',
}));

import monitor from '../src/main/monitor.js';

describe('Monitor Module', () => {
  beforeEach(() => {
    monitor.metrics.ipc.calls = 0;
    monitor.metrics.ipc.errors = 0;
    monitor.metrics.ipc.totalLatencyMs = 0;
    monitor.metrics.renderer.crashes = 0;
    monitor.metrics.renderer.unresponsive = 0;
    monitor.metrics.app.uncaughtExceptions = 0;
    monitor.metrics.app.unhandledRejections = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stopHealthLoop();
  });

  describe('recordIpcCall', () => {
    it('increments call count on success', () => {
      monitor.recordIpcCall('agents:list', 15, null);
      expect(monitor.metrics.ipc.calls).toBe(1);
      expect(monitor.metrics.ipc.errors).toBe(0);
      expect(monitor.metrics.ipc.totalLatencyMs).toBe(15);
    });

    it('increments error count on failure', () => {
      const err = new Error('test error');
      monitor.recordIpcCall('agents:list', 20, err);
      expect(monitor.metrics.ipc.calls).toBe(1);
      expect(monitor.metrics.ipc.errors).toBe(1);
      expect(monitor.metrics.ipc.totalLatencyMs).toBe(20);
    });

    it('accumulates latency across calls', () => {
      monitor.recordIpcCall('a', 10, null);
      monitor.recordIpcCall('b', 20, null);
      monitor.recordIpcCall('c', 30, null);
      expect(monitor.metrics.ipc.totalLatencyMs).toBe(60);
    });

    it('tracks errors separately from calls', () => {
      monitor.recordIpcCall('a', 10, null);
      monitor.recordIpcCall('b', 20, new Error('fail'));
      monitor.recordIpcCall('c', 30, null);
      monitor.recordIpcCall('d', 40, new Error('fail2'));
      expect(monitor.metrics.ipc.calls).toBe(4);
      expect(monitor.metrics.ipc.errors).toBe(2);
    });
  });

  describe('recordRendererCrash', () => {
    it('increments crash counter', () => {
      monitor.recordRendererCrash({ reason: 'crashed' });
      expect(monitor.metrics.renderer.crashes).toBe(1);
    });

    it('accumulates multiple crashes', () => {
      monitor.recordRendererCrash({ reason: 'oom' });
      monitor.recordRendererCrash({ reason: 'gpu' });
      expect(monitor.metrics.renderer.crashes).toBe(2);
    });
  });

  describe('recordRendererUnresponsive', () => {
    it('increments unresponsive counter', () => {
      monitor.recordRendererUnresponsive();
      expect(monitor.metrics.renderer.unresponsive).toBe(1);
    });
  });

  describe('getHealth', () => {
    it('returns ok status', () => {
      const health = monitor.getHealth();
      expect(health.status).toBe('ok');
      expect(health.ts).toBeDefined();
      expect(health.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it('includes memory stats', () => {
      const health = monitor.getHealth();
      expect(health.memory).toBeDefined();
      expect(health.memory.rss).toBeGreaterThan(0);
      expect(health.memory.heapUsed).toBeGreaterThan(0);
      expect(health.memory.heapTotal).toBeGreaterThan(0);
    });

    it('includes system stats', () => {
      const health = monitor.getHealth();
      expect(health.system).toBeDefined();
      expect(health.system.totalMem).toBeGreaterThan(0);
      expect(health.system.cpus).toBeGreaterThan(0);
      expect(health.system.loadAvg).toHaveLength(3);
    });

    it('includes IPC metrics', () => {
      monitor.recordIpcCall('test', 10, null);
      const health = monitor.getHealth();
      expect(health.ipc.calls).toBe(1);
      expect(health.ipc.avgLatencyMs).toBe(10);
    });

    it('returns zero avg latency when no calls', () => {
      const health = monitor.getHealth();
      expect(health.ipc.avgLatencyMs).toBe(0);
    });

    it('calculates correct avg latency with multiple calls', () => {
      monitor.recordIpcCall('a', 10, null);
      monitor.recordIpcCall('b', 30, null);
      const health = monitor.getHealth();
      expect(health.ipc.avgLatencyMs).toBe(20);
    });

    it('includes renderer metrics', () => {
      const health = monitor.getHealth();
      expect(health.renderer.crashes).toBe(0);
      expect(health.renderer.unresponsive).toBe(0);
    });

    it('includes app metrics', () => {
      const health = monitor.getHealth();
      expect(health.app.startedAt).toBeDefined();
      expect(health.app.uncaughtExceptions).toBe(0);
      expect(health.app.unhandledRejections).toBe(0);
    });

    it('returns ISO timestamp', () => {
      const health = monitor.getHealth();
      expect(() => new Date(health.ts).toISOString()).not.toThrow();
    });
  });

  describe('checkAlerts', () => {
    it('returns no alerts when healthy', () => {
      const health = {
        memory: { heapUsed: 100, heapTotal: 1000 },
        ipc: { calls: 100, errors: 0, avgLatencyMs: 10 },
        system: { totalMem: 10000, freeMem: 5000, loadAvg: [1, 1, 1], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts).toHaveLength(0);
    });

    it('fires high_heap alert when heap > 85%', () => {
      const health = {
        memory: { heapUsed: 900, heapTotal: 1000 },
        ipc: { calls: 100, errors: 0, avgLatencyMs: 10 },
        system: { totalMem: 10000, freeMem: 5000, loadAvg: [1, 1, 1], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts).toContainEqual(expect.objectContaining({ id: 'high_heap', severity: 'warn' }));
    });

    it('does not fire high_heap at exactly 85%', () => {
      const health = {
        memory: { heapUsed: 850, heapTotal: 1000 },
        ipc: { calls: 100, errors: 0, avgLatencyMs: 10 },
        system: { totalMem: 10000, freeMem: 5000, loadAvg: [1, 1, 1], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts.find((a) => a.id === 'high_heap')).toBeUndefined();
    });

    it('fires high_ipc_error_rate alert when > 5% failures', () => {
      const health = {
        memory: { heapUsed: 100, heapTotal: 1000 },
        ipc: { calls: 100, errors: 10, avgLatencyMs: 10 },
        system: { totalMem: 10000, freeMem: 5000, loadAvg: [1, 1, 1], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts).toContainEqual(expect.objectContaining({ id: 'high_ipc_error_rate', severity: 'error' }));
    });

    it('does not fire error rate alert with fewer than 10 calls', () => {
      const health = {
        memory: { heapUsed: 100, heapTotal: 1000 },
        ipc: { calls: 5, errors: 1, avgLatencyMs: 10 },
        system: { totalMem: 10000, freeMem: 5000, loadAvg: [1, 1, 1], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts.find((a) => a.id === 'high_ipc_error_rate')).toBeUndefined();
    });

    it('fires high_ipc_latency alert when avg > 500ms', () => {
      const health = {
        memory: { heapUsed: 100, heapTotal: 1000 },
        ipc: { calls: 100, errors: 0, avgLatencyMs: 600 },
        system: { totalMem: 10000, freeMem: 5000, loadAvg: [1, 1, 1], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts).toContainEqual(expect.objectContaining({ id: 'high_ipc_latency', severity: 'warn' }));
    });

    it('fires low_system_memory alert when free < 10%', () => {
      const health = {
        memory: { heapUsed: 100, heapTotal: 1000 },
        ipc: { calls: 100, errors: 0, avgLatencyMs: 10 },
        system: { totalMem: 10000, freeMem: 500, loadAvg: [1, 1, 1], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts).toContainEqual(expect.objectContaining({ id: 'low_system_memory', severity: 'warn' }));
    });

    it('fires high_cpu_load alert when load per CPU > 2.0', () => {
      const health = {
        memory: { heapUsed: 100, heapTotal: 1000 },
        ipc: { calls: 100, errors: 0, avgLatencyMs: 10 },
        system: { totalMem: 10000, freeMem: 5000, loadAvg: [10, 8, 6], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts).toContainEqual(expect.objectContaining({ id: 'high_cpu_load', severity: 'warn' }));
    });

    it('fires multiple alerts simultaneously', () => {
      const health = {
        memory: { heapUsed: 900, heapTotal: 1000 },
        ipc: { calls: 100, errors: 10, avgLatencyMs: 600 },
        system: { totalMem: 10000, freeMem: 500, loadAvg: [10, 8, 6], cpus: 4 },
      };
      const alerts = monitor.checkAlerts(health);
      expect(alerts.length).toBeGreaterThanOrEqual(4);
      expect(alerts.map((a) => a.id)).toContain('high_heap');
      expect(alerts.map((a) => a.id)).toContain('high_ipc_error_rate');
      expect(alerts.map((a) => a.id)).toContain('high_ipc_latency');
      expect(alerts.map((a) => a.id)).toContain('low_system_memory');
      expect(alerts.map((a) => a.id)).toContain('high_cpu_load');
    });
  });

  describe('health loop', () => {
    it('starts and stops without error', () => {
      monitor.startHealthLoop(100);
      monitor.startHealthLoop(100); // idempotent
      monitor.stopHealthLoop();
      monitor.stopHealthLoop(); // idempotent
    });
  });

  describe('uptime tracking', () => {
    beforeEach(() => {
      // Reset tracker state
      monitor.uptimeTracker.lastStatus = 'ok';
      monitor.uptimeTracker.lastStatusAt = Date.now();
      monitor.uptimeTracker.totalOkMs = 0;
      monitor.uptimeTracker.totalDegradedMs = 0;
      monitor.uptimeTracker.totalUnhealthyMs = 0;
      monitor.uptimeTracker.transitions = [];
    });

    it('recordStatusChange accumulates ok time', () => {
      monitor.recordStatusChange('ok');
      monitor.recordStatusChange('ok');
      const stats = monitor.getUptimeStats();
      expect(stats.uptimePercent).toBe(100);
      expect(stats.breakdown.unhealthyMs).toBe(0);
    });

    it('recordStatusChange tracks transitions', () => {
      monitor.recordStatusChange('degraded');
      monitor.recordStatusChange('ok');
      monitor.recordStatusChange('unhealthy');
      const stats = monitor.getUptimeStats();
      expect(stats.transitions.length).toBeGreaterThanOrEqual(2);
      expect(stats.lastStatusChange).toBe('unhealthy');
    });

    it('getUptimeStats returns correct shape', () => {
      const stats = monitor.getUptimeStats();
      expect(stats).toHaveProperty('uptimePercent');
      expect(stats).toHaveProperty('totalUptimeMs');
      expect(stats).toHaveProperty('totalDowntimeMs');
      expect(stats).toHaveProperty('breakdown');
      expect(stats).toHaveProperty('lastStatusChange');
      expect(stats).toHaveProperty('lastStatusChangeAt');
      expect(stats).toHaveProperty('transitions');
    });

    it('transitions capped at 100 entries', () => {
      for (let i = 0; i < 110; i++) {
        monitor.recordStatusChange(i % 2 === 0 ? 'ok' : 'degraded');
      }
      expect(monitor.uptimeTracker.transitions.length).toBeLessThanOrEqual(100);
    });
  });
});
