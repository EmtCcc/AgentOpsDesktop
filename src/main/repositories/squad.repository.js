'use strict';

const { randomUUID } = require('crypto');

const DEFAULT_TRIGGER_RULES = {
  on_member_complete: 'continue',
  on_error: 'fail-fast',
  on_all_complete: 'idle',
};

/**
 * Repository for Squad (team grouping) persistence.
 * Manages squads and squad_members tables.
 */
class SquadRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      insertSquad: this.db.prepare(`
        INSERT INTO squads (id, name, description, leader_id, instructions, trigger_rules, status, created_at, updated_at)
        VALUES (@id, @name, @description, @leaderId, @instructions, @triggerRules, @status, @createdAt, @updatedAt)
      `),
      updateSquad: this.db.prepare(`
        UPDATE squads SET name = @name, description = @description, leader_id = @leaderId,
          instructions = @instructions, trigger_rules = @triggerRules, status = @status, updated_at = @updatedAt
        WHERE id = @id
      `),
      deleteSquad: this.db.prepare('DELETE FROM squads WHERE id = @id'),
      getSquadById: this.db.prepare('SELECT * FROM squads WHERE id = @id'),
      listSquads: this.db.prepare('SELECT * FROM squads ORDER BY created_at DESC'),
      listByStatus: this.db.prepare('SELECT * FROM squads WHERE status = @status ORDER BY created_at DESC'),

      // Members
      insertMember: this.db.prepare(`
        INSERT OR IGNORE INTO squad_members (squad_id, agent_id, role, added_at)
        VALUES (@squadId, @agentId, @role, @addedAt)
      `),
      deleteMember: this.db.prepare('DELETE FROM squad_members WHERE squad_id = @squadId AND agent_id = @agentId'),
      deleteAllMembers: this.db.prepare('DELETE FROM squad_members WHERE squad_id = @squadId'),
      listMembers: this.db.prepare('SELECT * FROM squad_members WHERE squad_id = @squadId'),
      getMember: this.db.prepare('SELECT * FROM squad_members WHERE squad_id = @squadId AND agent_id = @agentId'),
      updateMemberRole: this.db.prepare('UPDATE squad_members SET role = @role WHERE squad_id = @squadId AND agent_id = @agentId'),

      // Join queries
      listSquadsForAgent: this.db.prepare(`
        SELECT s.* FROM squads s
        JOIN squad_members sm ON sm.squad_id = s.id
        WHERE sm.agent_id = @agentId
        ORDER BY s.created_at DESC
      `),
    };
  }

  // ── Mapping helpers ──

  _toRecord(row) {
    if (!row) return null;
    let triggerRules = DEFAULT_TRIGGER_RULES;
    if (row.trigger_rules) {
      try { triggerRules = { ...DEFAULT_TRIGGER_RULES, ...JSON.parse(row.trigger_rules) }; } catch { /* keep defaults */ }
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description || null,
      leaderId: row.leader_id || null,
      instructions: row.instructions || null,
      triggerRules,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  _toDbParams(squad) {
    const now = new Date().toISOString();
    return {
      id: squad.id || randomUUID(),
      name: squad.name,
      description: squad.description || null,
      leaderId: squad.leaderId || null,
      instructions: squad.instructions || null,
      triggerRules: squad.triggerRules ? JSON.stringify(squad.triggerRules) : '{}',
      status: squad.status || 'idle',
      createdAt: squad.createdAt || now,
      updatedAt: now,
    };
  }

  _memberToRecord(row) {
    if (!row) return null;
    return {
      squadId: row.squad_id,
      agentId: row.agent_id,
      role: row.role,
      addedAt: row.added_at,
    };
  }

  // ── Squad CRUD ──

  create(squad) {
    const params = this._toDbParams(squad);
    this._stmts.insertSquad.run(params);
    return this._toRecord(this._stmts.getSquadById.get({ id: params.id }));
  }

  getById(id) {
    return this._toRecord(this._stmts.getSquadById.get({ id }));
  }

  getSquadWithMembers(id) {
    const squad = this.getById(id);
    if (!squad) return null;
    const members = this._stmts.listMembers.all({ squadId: id }).map((r) => this._memberToRecord(r));
    return { ...squad, members };
  }

  update(id, updates) {
    const existing = this._stmts.getSquadById.get({ id });
    if (!existing) return null;
    const merged = { ...this._toRecord(existing), ...updates, id };
    const params = this._toDbParams(merged);
    this._stmts.updateSquad.run(params);
    return this._toRecord(this._stmts.getSquadById.get({ id }));
  }

  delete(id) {
    this._stmts.deleteAllMembers.run({ squadId: id });
    const result = this._stmts.deleteSquad.run({ id });
    return result.changes > 0;
  }

  list(params = {}) {
    const { offset = 0, limit = 20, status } = params;
    let rows;
    if (status) {
      rows = this._stmts.listByStatus.all({ status });
    } else {
      rows = this._stmts.listSquads.all();
    }
    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._toRecord(r));
    return { items, total, offset, limit, hasMore: offset + limit < total };
  }

  listWithMembers(params = {}) {
    const result = this.list(params);
    result.items = result.items.map((squad) => {
      const members = this._stmts.listMembers.all({ squadId: squad.id }).map((r) => this._memberToRecord(r));
      return { ...squad, members };
    });
    return result;
  }

  // ── Member management ──

  addMember(squadId, agentId, role = 'member') {
    const now = new Date().toISOString();
    this._stmts.insertMember.run({ squadId, agentId, role, addedAt: now });
    return this._memberToRecord(this._stmts.getMember.get({ squadId, agentId }));
  }

  removeMember(squadId, agentId) {
    const result = this._stmts.deleteMember.run({ squadId, agentId });
    return result.changes > 0;
  }

  updateMemberRole(squadId, agentId, role) {
    this._stmts.updateMemberRole.run({ squadId, agentId, role });
    return this._memberToRecord(this._stmts.getMember.get({ squadId, agentId }));
  }

  listMembers(squadId) {
    return this._stmts.listMembers.all({ squadId }).map((r) => this._memberToRecord(r));
  }

  listSquadsForAgent(agentId) {
    return this._stmts.listSquadsForAgent.all({ agentId }).map((r) => this._toRecord(r));
  }
}

module.exports = { SquadRepository, DEFAULT_TRIGGER_RULES };
