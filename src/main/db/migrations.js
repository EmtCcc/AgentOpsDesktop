'use strict';

const { migrations } = require('./schema');

/**
 * Run pending schema migrations.
 * Tracks applied versions in the _schema_version table.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ applied: number, current: number }}
 */
function runMigrations(db) {
  // Ensure the version tracking table exists first
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      version     INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    db.prepare('SELECT version FROM _schema_version').all().map((r) => r.version)
  );

  let applied = 0;
  const now = () => new Date().toISOString();

  const insertVersion = db.prepare(
    'INSERT INTO _schema_version (version, name, applied_at) VALUES (?, ?, ?)'
  );

  // Use a transaction so all migrations apply atomically
  const apply = db.transaction(() => {
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;

      db.exec(migration.up);
      insertVersion.run(migration.version, migration.name, now());
      applied++;
    }
  });

  apply();

  const current = migrations.length;
  return { applied, current };
}

/**
 * Get the current schema version (highest applied migration).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {number}
 */
function getCurrentVersion(db) {
  const row = db.prepare('SELECT MAX(version) as v FROM _schema_version').get();
  return row?.v ?? 0;
}

module.exports = { runMigrations, getCurrentVersion };
