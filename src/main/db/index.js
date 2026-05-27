'use strict';

const { getDb, closeDb, getDataDir } = require('./connection');
const { runMigrations, getCurrentVersion } = require('./migrations');
const { createAgentRepo } = require('./repositories/agentRepo');
const { createGoalRepo } = require('./repositories/goalRepo');
const { createTaskRepo } = require('./repositories/taskRepo');
const { createLogRepo } = require('./repositories/logRepo');

let agentRepo = null;
let goalRepo = null;
let taskRepo = null;
let logRepo = null;

/**
 * Initialize the database: connect, run migrations, create repositories.
 * Call once at app startup.
 * @returns {{ agentRepo, goalRepo, taskRepo, logRepo }}
 */
function initDb() {
  const db = getDb();
  const { applied, current } = runMigrations(db);

  if (applied > 0) {
    console.log(`[db] Applied ${applied} migration(s), schema version: ${current}`);
  }

  agentRepo = createAgentRepo(db);
  goalRepo = createGoalRepo(db);
  taskRepo = createTaskRepo(db);
  logRepo = createLogRepo(db);

  return { agentRepo, goalRepo, taskRepo, logRepo };
}

/**
 * Get initialized repositories. Throws if initDb() was not called.
 */
function getRepos() {
  if (!agentRepo) throw new Error('Database not initialized. Call initDb() first.');
  return { agentRepo, goalRepo, taskRepo, logRepo };
}

module.exports = { initDb, getRepos, closeDb, getDataDir, getCurrentVersion };
