'use strict';

class TelemetryRepository {
  constructor(db) {
    this.db = db;
    this.stmts = {
      insert: db.prepare(`
        INSERT INTO telemetry_events (event_type, event_data, session_id, created_at)
        VALUES (?, ?, ?, ?)
      `),
      count: db.prepare('SELECT COUNT(*) AS cnt FROM telemetry_events'),
      countByType: db.prepare('SELECT event_type, COUNT(*) AS cnt FROM telemetry_events GROUP BY event_type ORDER BY cnt DESC'),
      recent: db.prepare('SELECT * FROM telemetry_events ORDER BY id DESC LIMIT ?'),
      getAll: db.prepare('SELECT * FROM telemetry_events ORDER BY id DESC'),
      deleteAll: db.prepare('DELETE FROM telemetry_events'),
      deleteOlderThan: db.prepare('DELETE FROM telemetry_events WHERE created_at < ?'),
    };
  }

  insertBatch(events) {
    const insertMany = this.db.transaction((rows) => {
      for (const row of rows) {
        this.stmts.insert.run(row.event_type, row.event_data, row.session_id, row.created_at);
      }
    });
    insertMany(events);
  }

  count() {
    return this.stmts.count.get().cnt;
  }

  countByType() {
    const rows = this.stmts.countByType.all();
    const result = {};
    for (const row of rows) {
      result[row.event_type] = row.cnt;
    }
    return result;
  }

  recent(limit = 20) {
    return this.stmts.recent.all(limit).map((row) => ({
      ...row,
      event_data: JSON.parse(row.event_data || '{}'),
    }));
  }

  getAll() {
    return this.stmts.getAll.all().map((row) => ({
      ...row,
      event_data: JSON.parse(row.event_data || '{}'),
    }));
  }

  deleteAll() {
    this.stmts.deleteAll.run();
  }

  /** GDPR: purge events older than retentionDays */
  purge(retentionDays = 90) {
    const cutoff = new Date(Date.now() - retentionDays * 86400_000).toISOString();
    const info = this.stmts.deleteOlderThan.run(cutoff);
    return info.changes;
  }
}

module.exports = { TelemetryRepository };
