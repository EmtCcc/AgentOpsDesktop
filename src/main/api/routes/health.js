'use strict';

const { Hono } = require('hono');
const { getHealth, checkAlerts, classifyStatus, recordStatusChange, getUptimeStats } = require('../../monitor');

const health = new Hono();

/**
 * GET /health — Public health check endpoint.
 * Returns system status, uptime, memory, IPC metrics, renderer stats, and active alerts.
 *
 * HTTP 200 for ok/degraded, 503 for unhealthy (error-level alerts).
 */
health.get('/', async (c) => {
  const data = getHealth();
  const alerts = checkAlerts(data);

  // DB connectivity check
  let db = { ok: true };
  try {
    const repos = c.get('repos');
    if (repos?.agents?.db) {
      repos.agents.db.prepare('SELECT 1').get();
    }
  } catch (err) {
    db = { ok: false, error: err.message };
    alerts.push({ id: 'db_unreachable', severity: 'error', detail: err.message });
  }

  const status = classifyStatus(alerts);
  recordStatusChange(status);
  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return c.json({ ...data, status, db, alerts, uptime: getUptimeStats() }, httpStatus);
});

module.exports = health;
