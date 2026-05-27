'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for agent CRUD operations against SQLite.
 */
class AgentRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO agents (id, name, type, status, command, exec_path, cwd, config_json, created_at, updated_at)
        VALUES (@id, @name, @type, @status, @command, @execPath, @cwd, @configJson, @createdAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE agents
        SET name = @name, type = @type, status = @status, command = @command,
            exec_path = @execPath, cwd = @cwd, config_json = @configJson, updated_at = @updatedAt
        WHERE id = @id
      `),
      delete: this.db.prepare('DELETE FROM agents WHERE id = @id'),
      getById: this.db.prepare('SELECT * FROM agents WHERE id = @id'),
      list: this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC'),
      listByStatus: this.db.prepare('SELECT * FROM agents WHERE status = @status ORDER BY created_at DESC'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      command: row.command,
      execPath: row.exec_path,
      cwd: row.cwd,
      config: row.config_json ? JSON.parse(row.config_json) : {},
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _toDbParams(agent) {
    const now = new Date().toISOString();
    return {
      id: agent.id || randomUUID(),
      name: agent.name,
      type: agent.type || 'custom',
      status: agent.status || 'idle',
      command: agent.command || null,
      execPath: agent.execPath || null,
      cwd: agent.cwd || null,
      configJson: JSON.stringify(agent.config || {}),
      createdAt: agent.createdAt ? new Date(agent.createdAt).toISOString() : now,
      updatedAt: now,
    };
  }

  create(agent) {
    const params = this._toDbParams(agent);
    this._stmts.insert.run(params);
    return this._toDbParams({ ...agent, id: params.id, createdAt: Date.now(), updatedAt: Date.now() });
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
    const row = this._stmts.getById.get({ id });
    return this._toRecord(row);
  }

  list(params = {}) {
    const { offset = 0, limit = 20, status } = params;

    let rows;
    if (status) {
      rows = this._stmts.listByStatus.all({ status });
    } else {
      rows = this._stmts.list.all();
    }

    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._toRecord(r));

    return { items, total, offset, limit };
  }
}

module.exports = { AgentRepository };
