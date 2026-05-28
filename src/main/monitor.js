'use strict';

const os = require('os');
const logger = require('./logger');
const { version } = require('../../package.json');

// ── Metrics ──

const metrics = {
  ipc: { calls: 0, errors: 0, totalLatencyMs: 0 },
  renderer: { crashes: 0, unresponsive: 0 },
  app: { startedAt: Date.now(), uncaughtExceptions: 0, unhandledRejections: 0 },
};

function recordIpcCall(channel, latencyMs, error) {
  metrics.ipc.calls++;
  metrics.ipc.totalLatencyMs += latencyMs;
  if (error) {
    metrics.ipc.errors++;
    logger.error('ipc.error', { channel, latencyMs, err: { message: error.message, stack: error.stack } });
  }
}

function recordRendererCrash(details) {
  metrics.renderer.crashes++;
  logger.fatal('renderer.crash', details);
}

function recordRendererUnresponsive() {
  metrics.renderer.unresponsive++;
  logger.warn('renderer.unresponsive');
}

// ── Health Check ──

function getHealth() {
  const mem = process.memoryUsage();
  const uptimeMs = Date.now() - metrics.app.startedAt;
  return {
    status: 'ok',
    version,
    ts: new Date().toISOString(),
    uptimeMs,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    system: {
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      loadAvg: os.loadavg(),
      cpus: os.cpus().length,
    },
    ipc: {
      calls: metrics.ipc.calls,
      errors: metrics.ipc.errors,
      avgLatencyMs: metrics.ipc.calls > 0
        ? Math.round(metrics.ipc.totalLatencyMs / metrics.ipc.calls)
        : 0,
    },
    renderer: { ...metrics.renderer },
    app: { ...metrics.app },
  };
}

// ── Uptime Tracking ──

const uptimeTracker = {
  lastStatus: 'ok',
  lastStatusAt: Date.now(),
  totalOkMs: 0,
  totalDegradedMs: 0,
  totalUnhealthyMs: 0,
  transitions: [],   // [{ from, to, at }]  last 100
};

const MAX_TRANSITIONS = 100;

function recordStatusChange(newStatus) {
  const now = Date.now();
  const elapsed = now - uptimeTracker.lastStatusAt;
  const prev = uptimeTracker.lastStatus;

  if (prev === 'ok') uptimeTracker.totalOkMs += elapsed;
  else if (prev === 'degraded') uptimeTracker.totalDegradedMs += elapsed;
  else if (prev === 'unhealthy') uptimeTracker.totalUnhealthyMs += elapsed;

  if (prev !== newStatus) {
    uptimeTracker.transitions.push({ from: prev, to: newStatus, at: new Date(now).toISOString() });
    if (uptimeTracker.transitions.length > MAX_TRANSITIONS) {
      uptimeTracker.transitions.shift();
    }
  }

  uptimeTracker.lastStatus = newStatus;
  uptimeTracker.lastStatusAt = now;
}

function getUptimeStats() {
  // Flush current period without mutating lastStatusAt
  const now = Date.now();
  const elapsed = now - uptimeTracker.lastStatusAt;
  let okMs = uptimeTracker.totalOkMs;
  let degradedMs = uptimeTracker.totalDegradedMs;
  let unhealthyMs = uptimeTracker.totalUnhealthyMs;

  if (uptimeTracker.lastStatus === 'ok') okMs += elapsed;
  else if (uptimeTracker.lastStatus === 'degraded') degradedMs += elapsed;
  else unhealthyMs += elapsed;

  const totalMs = okMs + degradedMs + unhealthyMs;
  const uptimePercent = totalMs > 0
    ? Math.round(((okMs + degradedMs) / totalMs) * 10000) / 100
    : 100;

  return {
    uptimePercent,
    totalUptimeMs: okMs + degradedMs,
    totalDowntimeMs: unhealthyMs,
    breakdown: { okMs, degradedMs, unhealthyMs },
    lastStatusChange: uptimeTracker.lastStatus,
    lastStatusChangeAt: new Date(uptimeTracker.lastStatusAt).toISOString(),
    transitions: uptimeTracker.transitions.slice(-10),  // last 10 for response
  };
}

// ── Alert Thresholds ──

const THRESHOLDS = {
  heapUsedRatio: 0.85,       // 85% of heap
  ipcErrorRate: 0.05,        // 5% of calls failing
  avgLatencyMs: 500,         // 500ms average IPC latency
  systemFreeMemRatio: 0.10,  // less than 10% free system memory
  loadAvgPerCpu: 2.0,        // load average per CPU core
};

const alerted = new Set();

function checkAlerts(health) {
  const alerts = [];

  const heapRatio = health.memory.heapUsed / health.memory.heapTotal;
  if (heapRatio > THRESHOLDS.heapUsedRatio) {
    alerts.push({ id: 'high_heap', severity: 'warn', detail: `Heap usage ${(heapRatio * 100).toFixed(1)}%` });
  }

  if (health.ipc.calls > 10) {
    const errorRate = health.ipc.errors / health.ipc.calls;
    if (errorRate > THRESHOLDS.ipcErrorRate) {
      alerts.push({ id: 'high_ipc_error_rate', severity: 'error', detail: `IPC error rate ${(errorRate * 100).toFixed(1)}%` });
    }
    if (health.ipc.avgLatencyMs > THRESHOLDS.avgLatencyMs) {
      alerts.push({ id: 'high_ipc_latency', severity: 'warn', detail: `Avg IPC latency ${health.ipc.avgLatencyMs}ms` });
    }
  }

  const freeRatio = health.system.freeMem / health.system.totalMem;
  if (freeRatio < THRESHOLDS.systemFreeMemRatio) {
    alerts.push({ id: 'low_system_memory', severity: 'warn', detail: `System free memory ${(freeRatio * 100).toFixed(1)}%` });
  }

  const loadPerCpu = health.system.loadAvg[0] / health.system.cpus;
  if (loadPerCpu > THRESHOLDS.loadAvgPerCpu) {
    alerts.push({ id: 'high_cpu_load', severity: 'warn', detail: `Load per CPU: ${loadPerCpu.toFixed(2)}` });
  }

  for (const alert of alerts) {
    if (!alerted.has(alert.id)) {
      alerted.add(alert.id);
      logger[alert.severity]('alert', alert);
    }
  }
  // Clear resolved alerts
  for (const id of alerted) {
    if (!alerts.find((a) => a.id === id)) alerted.delete(id);
  }

  return alerts;
}

/**
 * Classify overall health status from alerts.
 * - 'ok': no alerts
 * - 'degraded': only warnings
 * - 'unhealthy': at least one error-level alert
 */
function classifyStatus(alerts) {
  if (!alerts || alerts.length === 0) return 'ok';
  if (alerts.some((a) => a.severity === 'error')) return 'unhealthy';
  return 'degraded';
}

// ── Periodic Health Tick ──

let healthInterval = null;

function startHealthLoop(intervalMs = 30_000) {
  if (healthInterval) return;
  healthInterval = setInterval(() => {
    const health = getHealth();
    const alerts = checkAlerts(health);
    const status = classifyStatus(alerts);
    recordStatusChange(status);
    logger.debug('health.tick', {
      status,
      heapUsed: Math.round(health.memory.heapUsed / 1024 / 1024) + 'MB',
      ipcCalls: health.ipc.calls,
      ipcErrors: health.ipc.errors,
    });
  }, intervalMs);
  healthInterval.unref();
}

function stopHealthLoop() {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
}

// ── Global Error Handlers ──

function installGlobalHandlers() {
  process.on('uncaughtException', (err) => {
    metrics.app.uncaughtExceptions++;
    logger.fatal('uncaughtException', { err: { message: err.message, stack: err.stack, name: err.name } });
  });

  process.on('unhandledRejection', (reason) => {
    metrics.app.unhandledRejections++;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('unhandledRejection', { err: { message: err.message, stack: err.stack } });
  });
}

module.exports = {
  recordIpcCall,
  recordRendererCrash,
  recordRendererUnresponsive,
  getHealth,
  checkAlerts,
  classifyStatus,
  recordStatusChange,
  getUptimeStats,
  startHealthLoop,
  stopHealthLoop,
  installGlobalHandlers,
  metrics,
  uptimeTracker,
};
