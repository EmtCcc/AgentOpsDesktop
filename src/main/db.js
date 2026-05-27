'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/**
 * SQLite database wrapper with WAL mode and migration support.
 * Database location: ~/Library/Application Support/agentops-desktop/data.db (macOS)
 */
class DatabaseManager {
  constructor() {
    this.db = null;
    this._migrations = [];
  }

  /**
   * Initialize the database connection and run pending migrations.
   * @param {string} [customPath] - Override default database path
   */
  init(customPath) {
    const dbPath = customPath || this._getDefaultPath();
    const dir = path.dirname(dbPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this._registerMigrations();
    this._runMigrations();

    return this.db;
  }

  _getDefaultPath() {
    const userData = app.getPath('userData');
    return path.join(userData, 'data.db');
  }

  /**
   * Register all schema migrations in order.
   */
  _registerMigrations() {
    this._migrations = [
      {
        version: 1,
        name: 'create_agents_table',
        sql: `
          CREATE TABLE IF NOT EXISTS agents (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            type            TEXT NOT NULL DEFAULT 'custom',
            status          TEXT NOT NULL DEFAULT 'idle',
            command         TEXT,
            exec_path       TEXT,
            cwd             TEXT,
            config_json     TEXT DEFAULT '{}',
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
          );
        `,
      },
      {
        version: 2,
        name: 'create_goals_table',
        sql: `
          CREATE TABLE IF NOT EXISTS goals (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            description     TEXT,
            status          TEXT NOT NULL DEFAULT 'active',
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
          );
        `,
      },
      {
        version: 3,
        name: 'create_tasks_table',
        sql: `
          CREATE TABLE IF NOT EXISTS tasks (
            id              TEXT PRIMARY KEY,
            goal_id         TEXT REFERENCES goals(id) ON DELETE CASCADE,
            agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
            title           TEXT NOT NULL,
            description     TEXT,
            status          TEXT NOT NULL DEFAULT 'pending',
            output_summary  TEXT,
            started_at      TEXT,
            completed_at    TEXT,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);
          CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
        `,
      },
      {
        version: 4,
        name: 'create_task_logs_table',
        sql: `
          CREATE TABLE IF NOT EXISTS task_logs (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            stream    TEXT NOT NULL,
            content   TEXT NOT NULL,
            timestamp TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
        `,
      },
    ];
  }

  /**
   * Run all pending migrations in a transaction.
   */
  _runMigrations() {
    // Create migrations tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name    TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const applied = this.db
      .prepare('SELECT version FROM _migrations')
      .all()
      .map((r) => r.version);

    const pending = this._migrations.filter(
      (m) => !applied.includes(m.version)
    );

    if (pending.length === 0) return;

    const applyMigration = this.db.transaction((migration) => {
      this.db.exec(migration.sql);
      this.db
        .prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString());
    });

    for (const migration of pending) {
      applyMigration(migration);
    }
  }

  /**
   * Get the database instance.
   */
  getDb() {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Close the database connection.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

module.exports = { DatabaseManager, dbManager };
