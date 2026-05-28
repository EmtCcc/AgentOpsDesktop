'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for adapter configuration CRUD against SQLite.
 *
 * DB schema: adapter_configs(id, type, name, class_path, config_json, enabled, created_at, updated_at)
 * API fields: id, type, name, classPath, config, enabled, createdAt, updatedAt
 */
class AdapterRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO adapter_configs (id, type, name, class_path, config_json, enabled, created_at, updated_at)
        VALUES (@id, @type, @name, @classPath, @configJson, @enabled, @createdAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE adapter_configs
        SET type = @type, name = @name, class_path = @classPath, config_json = @configJson,
            enabled = @enabled, updated_at = @updatedAt
        WHERE id = @id
      `),
      delete: this.db.prepare('DELETE FROM adapter_configs WHERE id = @id'),
      getById: this.db.prepare('SELECT * FROM adapter_configs WHERE id = @id'),
      getByType: this.db.prepare('SELECT * FROM adapter_configs WHERE type = @type'),
      list: this.db.prepare('SELECT * FROM adapter_configs ORDER BY created_at DESC'),
      listEnabled: this.db.prepare('SELECT * FROM adapter_configs WHERE enabled = 1 ORDER BY created_at DESC'),
      toggleEnabled: this.db.prepare('UPDATE adapter_configs SET enabled = @enabled, updated_at = @updatedAt WHERE id = @id'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      classPath: row.class_path,
      config: row.config_json ? JSON.parse(row.config_json) : {},
      enabled: row.enabled === 1,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _toDbParams(adapter) {
    const now = new Date().toISOString();
    return {
      id: adapter.id || randomUUID(),
      type: adapter.type,
      name: adapter.name || adapter.type,
      classPath: adapter.classPath || null,
      configJson: JSON.stringify(adapter.config || {}),
      enabled: adapter.enabled !== false ? 1 : 0,
      createdAt: adapter.createdAt ? new Date(adapter.createdAt).toISOString() : now,
      updatedAt: now,
    };
  }

  create(adapter) {
    const params = this._toDbParams(adapter);
    this._stmts.insert.run(params);
    return this.getById(params.id);
  }

  update(id, updates) {
    const existing = this._stmts.getById.get({ id });
    if (!existing) return null;
    const merged = { ...this._toRecord(existing), ...updates, id };
    const params = this._toDbParams(merged);
    this._stmts.update.run(params);
    return this._toRecord(this._stmts.getById.get({ id }));
  }

  delete(id) {
    const result = this._stmts.delete.run({ id });
    return result.changes > 0;
  }

  getById(id) {
    return this._toRecord(this._stmts.getById.get({ id }));
  }

  getByType(type) {
    return this._toRecord(this._stmts.getByType.get({ type }));
  }

  list(params = {}) {
    const { offset = 0, limit = 50, enabled } = params;
    let rows;
    if (enabled !== undefined) {
      rows = enabled ? this._stmts.listEnabled.all() : this._stmts.list.all();
    } else {
      rows = this._stmts.list.all();
    }
    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._toRecord(r));
    return { items, total, offset, limit, hasMore: offset + limit < total };
  }

  toggleEnabled(id, enabled) {
    const now = new Date().toISOString();
    this._stmts.toggleEnabled.run({ id, enabled: enabled ? 1 : 0, updatedAt: now });
    return this.getById(id);
  }
}

module.exports = { AdapterRepository };
