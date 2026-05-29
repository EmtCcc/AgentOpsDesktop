'use strict';

const telemetry = require('../../telemetry');

function setRepository(_repo) {
  // Repository stored for future telemetry persistence
}

const schemas = {
  getStats: {},
  setEnabled: {
    enabled: { type: 'boolean', required: true },
  },
  exportData: {},
  clearData: {},
};

async function getStats() {
  return telemetry.getStats();
}

async function setEnabled(_event, payload) {
  const { enabled } = payload;
  telemetry.setEnabled(enabled);
  return { enabled };
}

async function exportData() {
  return telemetry.exportData();
}

async function clearData() {
  telemetry.clearAllData();
  return { ok: true };
}

module.exports = { getStats, setEnabled, exportData, clearData, schemas, setRepository };
