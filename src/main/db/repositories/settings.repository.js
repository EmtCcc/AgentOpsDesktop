'use strict';

class SettingsRepository {
  constructor(db) {
    this.db = db;
    this.stmts = {
      get: db.prepare('SELECT value FROM settings WHERE key = ?'),
      getAll: db.prepare('SELECT key, value FROM settings'),
      upsert: db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `),
      delete: db.prepare('DELETE FROM settings WHERE key = ?'),
    };
  }

  get(key) {
    const row = this.stmts.get.get(key);
    if (!row) return undefined;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  getAll() {
    const rows = this.stmts.getAll.all();
    const result = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }

  set(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const now = new Date().toISOString();
    this.stmts.upsert.run(key, serialized, now);
    return value;
  }

  setMany(settings) {
    const now = new Date().toISOString();
    const upsertMany = this.db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        this.stmts.upsert.run(key, serialized, now);
      }
    });
    upsertMany(settings);
    return settings;
  }

  delete(key) {
    this.stmts.delete.run(key);
  }
}

module.exports = { SettingsRepository };
