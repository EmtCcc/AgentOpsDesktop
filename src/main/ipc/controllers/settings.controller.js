'use strict';

let settingsRepo = null;

function setRepository(repo) {
  settingsRepo = repo;
}

const schemas = {
  get: {},
  update: {
    settings: { type: 'object', required: true },
  },
};

async function get() {
  if (!settingsRepo) throw new Error('Settings repository not initialized');
  return settingsRepo.getAll();
}

async function update(_event, payload) {
  if (!settingsRepo) throw new Error('Settings repository not initialized');
  const { settings } = payload;
  return settingsRepo.setMany(settings);
}

module.exports = { get, update, schemas, setRepository };
