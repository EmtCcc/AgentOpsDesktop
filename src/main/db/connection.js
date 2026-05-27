'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

/**
 * Get the platform-appropriate data directory for the application.
 * macOS: ~/Library/Application Support/agentops-desktop/
 * Windows: %APPDATA%/agentops-desktop/
 * Linux: ~/.config/agentops-desktop/
 */
function getDataDir() {
  const base = app.getPath('userData');
  const dataDir = path.join(base, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

/**
 * Initialize the SQLite database connection with WAL mode.
 * Returns the singleton Database instance.
 */
function getDb() {
  if (db) return db;

  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, 'agentops.db');

  db = new Database(dbPath);

  // WAL mode for better concurrent read performance and crash recovery
  db.pragma('journal_mode = WAL');
  // Enable foreign keys (SQLite has them OFF by default)
  db.pragma('foreign_keys = ON');
  // Busy timeout: wait up to 5s for locks instead of failing immediately
  db.pragma('busy_timeout = 5000');

  return db;
}

/**
 * Close the database connection. Call on app quit.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb, getDataDir };
