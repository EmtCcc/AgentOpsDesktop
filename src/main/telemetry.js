'use strict';

const { randomUUID } = require('crypto');
const os = require('os');
const logger = require('./logger');
const { version } = require('../../package.json');

/**
 * GDPR-compliant, opt-in anonymous telemetry.
 *
 * Design principles:
 * - OFF by default — user must explicitly opt in
 * - No PII ever collected (no paths, no usernames, no file contents)
 * - All data stored locally in SQLite; nothing sent externally
 * - Easy opt-out: single toggle in Settings, wipes all collected data
 * - Data categories: feature usage counts, error rates, performance metrics
 */

let settingsRepo = null;
let telemetryRepo = null;

const FLUSH_INTERVAL_MS = 60_000; // flush buffered events every 60s
let flushTimer = null;
let eventBuffer = [];
let sessionId = null;

// ── Consent ──

function isEnabled() {
  if (!settingsRepo) return false;
  try {
    return settingsRepo.get('telemetry.enabled') === true;
  } catch {
    return false;
  }
}

function setEnabled(enabled) {
  if (!settingsRepo) return;
  settingsRepo.set('telemetry.enabled', !!enabled);
  if (!enabled) {
    // Wipe all collected data on opt-out (GDPR right to erasure)
    clearAllData();
  } else {
    ensureSession();
  }
  logger.info('telemetry.consent-changed', { enabled: !!enabled });
}

// ── Session ──

function ensureSession() {
  if (sessionId) return sessionId;
  sessionId = randomUUID();
  return sessionId;
}

// ── Event Recording ──

function track(eventType, data = {}) {
  if (!isEnabled()) return;

  const sid = ensureSession();
  const event = {
    event_type: eventType,
    event_data: JSON.stringify(data),
    session_id: sid,
    created_at: new Date().toISOString(),
  };

  eventBuffer.push(event);

  // Flush immediately if buffer is large
  if (eventBuffer.length >= 50) {
    flush();
  }
}

function flush() {
  if (eventBuffer.length === 0 || !telemetryRepo) return;
  const batch = eventBuffer.splice(0);
  try {
    telemetryRepo.insertBatch(batch);
  } catch (err) {
    logger.error('telemetry.flush-failed', { count: batch.length, err: { message: err.message } });
  }
}

// ── Aggregation (for dashboard) ──

function getStats() {
  if (!telemetryRepo) return { enabled: false, events: 0, breakdown: {} };
  return {
    enabled: isEnabled(),
    events: telemetryRepo.count(),
    breakdown: telemetryRepo.countByType(),
    recentEvents: telemetryRepo.recent(20),
  };
}

// ── Data Management ──

function clearAllData() {
  if (!telemetryRepo) return;
  try {
    telemetryRepo.deleteAll();
    logger.info('telemetry.data-cleared');
  } catch (err) {
    logger.error('telemetry.clear-failed', { err: { message: err.message } });
  }
}

function exportData() {
  if (!telemetryRepo) return [];
  return telemetryRepo.getAll();
}

// ── Lifecycle ──

function init(settings, telemetry) {
  settingsRepo = settings;
  telemetryRepo = telemetry;

  if (isEnabled()) {
    ensureSession();
    track('app.startup', {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      appVersion: version,
      cpus: os.cpus().length,
      totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
    });
  }

  // Periodic flush
  flushTimer = setInterval(() => {
    flush();
  }, FLUSH_INTERVAL_MS);
  if (flushTimer.unref) flushTimer.unref();
}

function shutdown() {
  flush();
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

module.exports = {
  isEnabled,
  setEnabled,
  track,
  flush,
  getStats,
  clearAllData,
  exportData,
  init,
  shutdown,
};
