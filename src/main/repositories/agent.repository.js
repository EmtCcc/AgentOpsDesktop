'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for agent CRUD operations against SQLite.
 * Maps API fields (camelCase) to DB columns (snake_case).
 *
 * DB schema: agents(id, name, executable_path, working_directory, agent_type, config_json, status, created_at, updated_at)
 * API fields: id, name, execPath, cwd, type, config, status, createdAt, updatedAt
 */
class AgentRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO agents (id, name, executable_path, working_directory, agent_type, config_json, status, owner_role, created_at, updated_at)
        VALUES (@id, @name, @executablePath, @workingDirectory, @agentType, @configJson, @status, @ownerRole, @createdAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE agents
        SET name = @name, executable_path = @executablePath, working_directory = @workingDirectory,
            agent_type = @agentType, config_json = @configJson, status = @status, updated_at = @updatedAt
        WHERE id = @id
      `),
      delete: this.db.prepare('DELETE FROM agents WHERE id = @id'),
      getById: this.db.prepare('SELECT * FROM agents WHERE id = @id'),
      list: this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC'),
      listByStatus: this.db.prepare('SELECT * FROM agents WHERE status = @status ORDER BY created_at DESC'),
      listByOwner: this.db.prepare('SELECT * FROM agents WHERE owner_role = @ownerRole ORDER BY created_at DESC'),
      listByOwnerAndStatus: this.db.prepare('SELECT * FROM agents WHERE owner_role = @ownerRole AND status = @status ORDER BY created_at DESC'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.agent_type,
      execPath: row.executable_path,
      cwd: row.working_directory,
      config: row.config_json ? JSON.parse(row.config_json) : {},
      status: row.status,
      ownerRole: row.owner_role || null,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  _toDbParams(agent) {
    const now = new Date().toISOString();
    return {
      id: agent.id || randomUUID(),
      name: agent.name,
      executablePath: agent.execPath || null,
      workingDirectory: agent.cwd || null,
      agentType: agent.type || 'custom',
      configJson: JSON.stringify(agent.config || {}),
      status: agent.status || 'idle',
      ownerRole: agent.ownerRole || null,
      createdAt: agent.createdAt ? new Date(agent.createdAt).toISOString() : now,
      updatedAt: now,
    };
  }

  create(agent) {
    const params = this._toDbParams(agent);
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
    const row = this._stmts.getById.get({ id });
    return this._toRecord(row);
  }

  list(params = {}) {
    const { offset = 0, limit = 20, status, ownerRole } = params;

    let rows;
    if (ownerRole && status) {
      rows = this._stmts.listByOwnerAndStatus.all({ ownerRole, status });
    } else if (ownerRole) {
      rows = this._stmts.listByOwner.all({ ownerRole });
    } else if (status) {
      rows = this._stmts.listByStatus.all({ status });
    } else {
      rows = this._stmts.list.all();
    }

    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._toRecord(r));

    return { items, total, offset, limit, hasMore: offset + limit < total };
  }

  /**
   * Get workload counts (active tasks) per agent.
   * Active = tasks with status IN ('assigned', 'running').
   * @returns {Map<string, number>} agentId → active task count
   */
  getWorkloadMap() {
    const rows = this.db.prepare(`
      SELECT agent_id, COUNT(*) as cnt
      FROM tasks
      WHERE agent_id IS NOT NULL
        AND status IN ('assigned', 'running')
      GROUP BY agent_id
    `).all();
    const map = new Map();
    for (const row of rows) {
      map.set(row.agent_id, row.cnt);
    }
    return map;
  }

  /**
   * Get idle agents sorted by workload (fewest active tasks first).
   * Filters out agents with status 'error' or 'offline'.
   * @param {Object} [opts]
   * @param {string} [opts.ownerRole] - Filter by owner role
   * @returns {Array<Object>} agents with .workload field
   */
  getIdleAgentsByWorkload(opts = {}) {
    const agents = this.list({ status: 'idle', ownerRole: opts.ownerRole, limit: 1000 }).items;
    const workloadMap = this.getWorkloadMap();
    return agents
      .map((a) => ({ ...a, workload: workloadMap.get(a.id) || 0 }))
      .sort((a, b) => a.workload - b.workload);
  }
}

module.exports = { AgentRepository };
