'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for goal CRUD operations against SQLite.
 */
class GoalRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT INTO goals (id, title, description, status, owner_role, squad_id, created_at, updated_at)
        VALUES (@id, @title, @description, @status, @ownerRole, @squadId, @createdAt, @updatedAt)
      `),
      update: this.db.prepare(`
        UPDATE goals
        SET title = @title, description = @description, status = @status, squad_id = @squadId, updated_at = @updatedAt
        WHERE id = @id
      `),
      delete: this.db.prepare('DELETE FROM goals WHERE id = @id'),
      getById: this.db.prepare('SELECT * FROM goals WHERE id = @id'),
      list: this.db.prepare('SELECT * FROM goals ORDER BY created_at DESC'),
      listByStatus: this.db.prepare('SELECT * FROM goals WHERE status = @status ORDER BY created_at DESC'),
      listByOwner: this.db.prepare('SELECT * FROM goals WHERE owner_role = @ownerRole ORDER BY created_at DESC'),
      listByOwnerAndStatus: this.db.prepare('SELECT * FROM goals WHERE owner_role = @ownerRole AND status = @status ORDER BY created_at DESC'),
      listBySquad: this.db.prepare('SELECT * FROM goals WHERE squad_id = @squadId ORDER BY created_at DESC'),
      listBySquadAndStatus: this.db.prepare('SELECT * FROM goals WHERE squad_id = @squadId AND status = @status ORDER BY created_at DESC'),
    };
  }

  _toRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      ownerRole: row.owner_role || null,
      squadId: row.squad_id || null,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  create(goal) {
    const now = new Date().toISOString();
    const params = {
      id: randomUUID(),
      title: goal.title,
      description: goal.description || null,
      status: 'active',
      ownerRole: goal.ownerRole || null,
      squadId: goal.squadId || null,
      createdAt: now,
      updatedAt: now,
    };
    this._stmts.insert.run(params);
    return this.getById(params.id);
  }

  update(id, updates) {
    const existing = this._stmts.getById.get({ id });
    if (!existing) return null;

    const merged = {
      ...this._toRecord(existing),
      ...updates,
      id,
    };
    const params = {
      id: merged.id,
      title: merged.title,
      description: merged.description,
      status: merged.status,
      squadId: merged.squadId || null,
      updatedAt: new Date().toISOString(),
    };
    this._stmts.update.run(params);
    return this.getById(id);
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
    const { offset = 0, limit = 20, status, ownerRole, squadId } = params;

    let rows;
    if (squadId && status) {
      rows = this._stmts.listBySquadAndStatus.all({ squadId, status });
    } else if (squadId) {
      rows = this._stmts.listBySquad.all({ squadId });
    } else if (ownerRole && status) {
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
}

module.exports = { GoalRepository };
