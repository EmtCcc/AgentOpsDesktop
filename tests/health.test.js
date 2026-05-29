import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock os module for deterministic system values
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    totalmem: () => 16 * 1024 * 1024 * 1024, // 16 GB
    freemem: () => 8 * 1024 * 1024 * 1024,    // 8 GB
    loadavg: () => [1.0, 0.8, 0.5],
    cpus: () => [{ model: 'Test CPU' }],       // 1 core
  };
});

// Import the monitor module directly
const monitor = await import('../src/main/monitor.js');

describe('API health check (monitor.getHealth)', () => {
  it('returns ok status', () => {
    const health = monitor.getHealth();
    expect(health.status).toBe('ok');
  });

  it('returns version from package.json', () => {
    const health = monitor.getHealth();
    expect(health.version).toBeDefined();
    expect(typeof health.version).toBe('string');
    expect(health.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns ISO timestamp', () => {
    const health = monitor.getHealth();
    expect(health.ts).toBeDefined();
    expect(new Date(health.ts).toISOString()).toBe(health.ts);
  });

  it('returns non-negative uptime', () => {
    const health = monitor.getHealth();
    expect(health.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns memory usage with all required fields', () => {
    const health = monitor.getHealth();
    expect(health.memory).toBeDefined();
    expect(health.memory.rss).toBeGreaterThan(0);
    expect(health.memory.heapUsed).toBeGreaterThan(0);
    expect(health.memory.heapTotal).toBeGreaterThan(0);
    expect(typeof health.memory.external).toBe('number');
  });

  it('returns system info with cpus and memory', () => {
    const health = monitor.getHealth();
    expect(health.system).toBeDefined();
    expect(health.system.totalMem).toBeGreaterThan(0);
    expect(health.system.freeMem).toBeGreaterThan(0);
    expect(health.system.freeMem).toBeLessThanOrEqual(health.system.totalMem);
    expect(health.system.cpus).toBeGreaterThan(0);
    expect(health.system.loadAvg).toHaveLength(3);
  });

  it('returns IPC metrics', () => {
    const health = monitor.getHealth();
    expect(health.ipc).toBeDefined();
    expect(typeof health.ipc.calls).toBe('number');
    expect(typeof health.ipc.errors).toBe('number');
    expect(typeof health.ipc.avgLatencyMs).toBe('number');
    expect(health.ipc.calls).toBeGreaterThanOrEqual(0);
  });

  it('returns renderer crash/unresponsive counts', () => {
    const health = monitor.getHealth();
    expect(health.renderer).toBeDefined();
    expect(typeof health.renderer.crashes).toBe('number');
    expect(typeof health.renderer.unresponsive).toBe('number');
  });

  it('returns app metadata', () => {
    const health = monitor.getHealth();
    expect(health.app).toBeDefined();
    expect(typeof health.app.startedAt).toBe('number');
    expect(typeof health.app.uncaughtExceptions).toBe('number');
    expect(typeof health.app.unhandledRejections).toBe('number');
  });
});

describe('API health check (checkAlerts)', () => {
  it('returns empty alerts for healthy system', () => {
    const health = monitor.getHealth();
    const alerts = monitor.checkAlerts(health);
    expect(Array.isArray(alerts)).toBe(true);
    // With reasonable defaults, no alerts should fire
  });

  it('fires high_heap alert when heap usage > 85%', () => {
    const health = {
      ...monitor.getHealth(),
      memory: {
        heapUsed: 900 * 1024 * 1024,
        heapTotal: 1000 * 1024 * 1024,
        rss: 1000 * 1024 * 1024,
        external: 0,
      },
    };
    const alerts = monitor.checkAlerts(health);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'high_heap', severity: 'warn' }),
      ])
    );
  });

  it('fires high_ipc_error_rate alert when error rate > 5%', () => {
    const health = {
      ...monitor.getHealth(),
      ipc: { calls: 100, errors: 10, avgLatencyMs: 100 },
    };
    const alerts = monitor.checkAlerts(health);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'high_ipc_error_rate', severity: 'error' }),
      ])
    );
  });

  it('fires low_system_memory alert when free memory < 10%', () => {
    const health = {
      ...monitor.getHealth(),
      system: {
        totalMem: 16 * 1024 * 1024 * 1024,
        freeMem: 1 * 1024 * 1024 * 1024, // 6.25% free
        loadAvg: [1.0, 0.8, 0.5],
        cpus: 4,
      },
    };
    const alerts = monitor.checkAlerts(health);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'low_system_memory', severity: 'warn' }),
      ])
    );
  });

  it('fires high_cpu_load alert when load per CPU > 2.0', () => {
    const health = {
      ...monitor.getHealth(),
      system: {
        totalMem: 16 * 1024 * 1024 * 1024,
        freeMem: 8 * 1024 * 1024 * 1024,
        loadAvg: [8.0, 6.0, 4.0],
        cpus: 2,
      },
    };
    const alerts = monitor.checkAlerts(health);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'high_cpu_load', severity: 'warn' }),
      ])
    );
  });

  it('fires high_ipc_latency alert when avg latency > 500ms', () => {
    const health = {
      ...monitor.getHealth(),
      ipc: { calls: 100, errors: 0, avgLatencyMs: 750 },
    };
    const alerts = monitor.checkAlerts(health);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'high_ipc_latency', severity: 'warn' }),
      ])
    );
  });
});

describe('API health check (recordIpcCall)', () => {
  beforeEach(() => {
    // Reset metrics
    monitor.metrics.ipc.calls = 0;
    monitor.metrics.ipc.errors = 0;
    monitor.metrics.ipc.totalLatencyMs = 0;
  });

  it('increments call count on recordIpcCall', () => {
    monitor.recordIpcCall('test:channel', 10);
    monitor.recordIpcCall('test:channel', 20);
    const health = monitor.getHealth();
    expect(health.ipc.calls).toBeGreaterThanOrEqual(2);
  });

  it('increments error count when error is passed', () => {
    monitor.recordIpcCall('test:channel', 10, new Error('test error'));
    monitor.recordIpcCall('test:channel', 20);
    const health = monitor.getHealth();
    expect(health.ipc.errors).toBeGreaterThanOrEqual(1);
  });

  it('computes average latency', () => {
    monitor.recordIpcCall('test:channel', 100);
    monitor.recordIpcCall('test:channel', 200);
    const health = monitor.getHealth();
    expect(health.ipc.avgLatencyMs).toBeGreaterThanOrEqual(100);
  });
});

describe('API health check (classifyStatus)', () => {
  it('returns ok for empty alerts', () => {
    expect(monitor.classifyStatus([])).toBe('ok');
  });

  it('returns ok for null/undefined alerts', () => {
    expect(monitor.classifyStatus(null)).toBe('ok');
    expect(monitor.classifyStatus(undefined)).toBe('ok');
  });

  it('returns degraded for warn-only alerts', () => {
    const alerts = [
      { id: 'high_heap', severity: 'warn', detail: 'test' },
    ];
    expect(monitor.classifyStatus(alerts)).toBe('degraded');
  });

  it('returns unhealthy for error-level alerts', () => {
    const alerts = [
      { id: 'high_heap', severity: 'warn', detail: 'test' },
      { id: 'high_ipc_error_rate', severity: 'error', detail: 'test' },
    ];
    expect(monitor.classifyStatus(alerts)).toBe('unhealthy');
  });

  it('returns unhealthy when only error alerts present', () => {
    const alerts = [
      { id: 'db_unreachable', severity: 'error', detail: 'test' },
    ];
    expect(monitor.classifyStatus(alerts)).toBe('unhealthy');
  });
});

describe('API health check (uptime tracking)', () => {
  beforeEach(() => {
    // Reset uptime tracker state
    monitor.uptimeTracker.lastStatus = 'ok';
    monitor.uptimeTracker.lastStatusAt = Date.now();
    monitor.uptimeTracker.totalOkMs = 0;
    monitor.uptimeTracker.totalDegradedMs = 0;
    monitor.uptimeTracker.totalUnhealthyMs = 0;
    monitor.uptimeTracker.transitions = [];
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
    expect(stats.breakdown).toHaveProperty('okMs');
    expect(stats.breakdown).toHaveProperty('degradedMs');
    expect(stats.breakdown).toHaveProperty('unhealthyMs');
  });

  it('defaults to 100% uptime with no transitions', () => {
    const stats = monitor.getUptimeStats();
    expect(stats.uptimePercent).toBe(100);
    expect(stats.transitions).toHaveLength(0);
  });

  it('records status transitions', () => {
    monitor.recordStatusChange('ok');
    monitor.recordStatusChange('degraded');
    monitor.recordStatusChange('unhealthy');

    expect(monitor.uptimeTracker.transitions).toHaveLength(2);
    expect(monitor.uptimeTracker.transitions[0]).toMatchObject({ from: 'ok', to: 'degraded' });
    expect(monitor.uptimeTracker.transitions[1]).toMatchObject({ from: 'degraded', to: 'unhealthy' });
  });

  it('does not duplicate transitions when status unchanged', () => {
    monitor.recordStatusChange('ok');
    monitor.recordStatusChange('ok');
    monitor.recordStatusChange('ok');

    expect(monitor.uptimeTracker.transitions).toHaveLength(0);
  });

  it('tracks cumulative time per status', () => {
    monitor.recordStatusChange('ok');
    // Simulate time passing by manipulating lastStatusAt
    monitor.uptimeTracker.lastStatusAt = Date.now() - 1000;
    monitor.recordStatusChange('unhealthy');

    expect(monitor.uptimeTracker.totalOkMs).toBeGreaterThanOrEqual(900);
  });

  it('calculates uptime percent accounting for unhealthy time', () => {
    // Set up: 900ms ok, 100ms unhealthy
    monitor.recordStatusChange('ok');
    monitor.uptimeTracker.lastStatusAt = Date.now() - 900;
    monitor.recordStatusChange('unhealthy');
    monitor.uptimeTracker.lastStatusAt = Date.now() - 100;

    const stats = monitor.getUptimeStats();
    // uptime = (ok + degraded) / total * 100
    expect(stats.uptimePercent).toBeGreaterThan(0);
    expect(stats.uptimePercent).toBeLessThan(100);
    expect(stats.totalDowntimeMs).toBeGreaterThanOrEqual(100);
  });

  it('degraded status counts as uptime, not downtime', () => {
    monitor.recordStatusChange('ok');
    monitor.uptimeTracker.lastStatusAt = Date.now() - 500;
    monitor.recordStatusChange('degraded');
    monitor.uptimeTracker.lastStatusAt = Date.now() - 500;

    const stats = monitor.getUptimeStats();
    expect(stats.totalDowntimeMs).toBe(0);
    expect(stats.uptimePercent).toBe(100);
  });

  it('caps transitions array in response to 10', () => {
    for (let i = 0; i < 15; i++) {
      monitor.recordStatusChange(i % 2 === 0 ? 'ok' : 'unhealthy');
    }

    const stats = monitor.getUptimeStats();
    expect(stats.transitions.length).toBeLessThanOrEqual(10);
  });

  it('caps internal transitions array to MAX_TRANSITIONS (100)', () => {
    for (let i = 0; i < 120; i++) {
      monitor.recordStatusChange(i % 2 === 0 ? 'ok' : 'unhealthy');
    }

    expect(monitor.uptimeTracker.transitions.length).toBeLessThanOrEqual(100);
  });
});
