'use strict';

const { IpcError } = require('../errors');
const { DEFAULT_TRIGGER_RULES } = require('../../repositories/squad.repository');

let squadRepo = null;
let agentRepo = null;

const squadController = {
  setRepository(repo) {
    squadRepo = repo;
  },

  setAgentRepository(repo) {
    agentRepo = repo;
  },

  // ── Squad CRUD ──

  async list(event, params = {}) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    return squadRepo.listWithMembers(params);
  },

  async get(event, { id }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const squad = squadRepo.getSquadWithMembers(id);
    if (!squad) throw IpcError.notFound('Squad', id);
    return squad;
  },

  async create(event, squad) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const created = squadRepo.create(squad);

    // If members provided, add them
    if (squad.members && Array.isArray(squad.members)) {
      for (const member of squad.members) {
        const agentId = typeof member === 'string' ? member : member.agentId;
        const role = typeof member === 'string' ? 'member' : (member.role || 'member');
        squadRepo.addMember(created.id, agentId, role);
      }
    }

    // Set leader as member with 'leader' role if specified
    if (squad.leaderId) {
      const existing = squadRepo.listMembers(created.id).find((m) => m.agentId === squad.leaderId);
      if (existing) {
        squadRepo.updateMemberRole(created.id, squad.leaderId, 'leader');
      } else {
        squadRepo.addMember(created.id, squad.leaderId, 'leader');
      }
    }

    return squadRepo.getSquadWithMembers(created.id);
  },

  async update(event, { id, updates }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const existing = squadRepo.getById(id);
    if (!existing) throw IpcError.notFound('Squad', id);

    // If leaderId changed, update member roles
    if (updates.leaderId !== undefined && updates.leaderId !== existing.leaderId) {
      // Demote old leader
      if (existing.leaderId) {
        const oldLeaderMember = squadRepo.listMembers(id).find((m) => m.agentId === existing.leaderId);
        if (oldLeaderMember) {
          squadRepo.updateMemberRole(id, existing.leaderId, 'member');
        }
      }
      // Promote new leader
      if (updates.leaderId) {
        const newLeaderMember = squadRepo.listMembers(id).find((m) => m.agentId === updates.leaderId);
        if (newLeaderMember) {
          squadRepo.updateMemberRole(id, updates.leaderId, 'leader');
        } else {
          squadRepo.addMember(id, updates.leaderId, 'leader');
        }
      }
    }

    return squadRepo.update(id, updates);
  },

  async delete(event, { id }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const deleted = squadRepo.delete(id);
    if (!deleted) throw IpcError.notFound('Squad', id);
    return { deleted: true, id };
  },

  // ── Member management ──

  async addMember(event, { squadId, agentId, role }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const squad = squadRepo.getById(squadId);
    if (!squad) throw IpcError.notFound('Squad', squadId);

    if (agentRepo) {
      const agent = agentRepo.getById(agentId);
      if (!agent) throw IpcError.notFound('Agent', agentId);
    }

    return squadRepo.addMember(squadId, agentId, role || 'member');
  },

  async removeMember(event, { squadId, agentId }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const squad = squadRepo.getById(squadId);
    if (!squad) throw IpcError.notFound('Squad', squadId);
    const removed = squadRepo.removeMember(squadId, agentId);
    if (!removed) throw IpcError.notFound('Member', `${squadId}:${agentId}`);
    return { removed: true, squadId, agentId };
  },

  async listMembers(event, { squadId }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const squad = squadRepo.getById(squadId);
    if (!squad) throw IpcError.notFound('Squad', squadId);
    return squadRepo.listMembers(squadId);
  },

  // ── Batch operations ──

  async batchStart(event, { squadId }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const squad = squadRepo.getSquadWithMembers(squadId);
    if (!squad) throw IpcError.notFound('Squad', squadId);

    const results = [];
    for (const member of squad.members) {
      results.push({ agentId: member.agentId, action: 'start', status: 'queued' });
    }

    squadRepo.update(squadId, { status: 'running' });
    return {
      squadId,
      status: 'running',
      instructions: squad.instructions || null,
      agents: results,
    };
  },

  async batchStop(event, { squadId }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const squad = squadRepo.getSquadWithMembers(squadId);
    if (!squad) throw IpcError.notFound('Squad', squadId);

    const results = [];
    for (const member of squad.members) {
      results.push({ agentId: member.agentId, action: 'stop', status: 'queued' });
    }

    squadRepo.update(squadId, { status: 'idle' });
    return { squadId, status: 'idle', agents: results };
  },

  async getAggregatedStatus(event, { squadId }) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const squad = squadRepo.getSquadWithMembers(squadId);
    if (!squad) throw IpcError.notFound('Squad', squadId);

    const agentStatuses = [];
    if (agentRepo) {
      for (const member of squad.members) {
        const agent = agentRepo.getById(member.agentId);
        if (agent) {
          agentStatuses.push({ agentId: agent.id, name: agent.name, status: agent.status, role: member.role });
        }
      }
    }

    const statusCounts = { idle: 0, running: 0, error: 0, offline: 0 };
    for (const a of agentStatuses) {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    }

    let aggregatedStatus = 'idle';
    if (statusCounts.running > 0) aggregatedStatus = 'running';
    if (statusCounts.error > 0) aggregatedStatus = 'error';
    if (statusCounts.idle === agentStatuses.length && agentStatuses.length > 0) aggregatedStatus = 'idle';

    return {
      squadId,
      squadName: squad.name,
      status: aggregatedStatus,
      memberCount: squad.members.length,
      statusCounts,
      agents: agentStatuses,
    };
  },

  // ── Trigger rule engine ──

  /**
   * Evaluate a trigger rule for a squad event.
   * @param {string} squadId
   * @param {'member_complete'|'error'|'all_complete'} event
   * @returns {{ action: string, rule: string }}
   */
  async evaluateTriggerRule(event, { squadId, agentId } = {}) {
    if (!squadRepo) throw IpcError.internal('Squad repository not initialized');
    const squad = squadRepo.getById(squadId);
    if (!squad) throw IpcError.notFound('Squad', squadId);

    const rules = squad.triggerRules || DEFAULT_TRIGGER_RULES;
    const ruleMap = {
      member_complete: rules.on_member_complete,
      error: rules.on_error,
      all_complete: rules.on_all_complete,
    };
    const action = ruleMap[event] || 'continue';
    return { action, event, squadId, agentId };
  },

  /**
   * Apply a trigger rule: evaluate + execute side effects.
   * Returns the action taken.
   */
  async applyTriggerRule(event, { squadId, agentId } = {}) {
    const result = await this.evaluateTriggerRule(event, { squadId, agentId });
    const { action } = result;

    if (action === 'pause') {
      squadRepo.update(squadId, { status: 'idle' });
      result.newStatus = 'idle';
    } else if (action === 'fail-fast' && event === 'error') {
      squadRepo.update(squadId, { status: 'error' });
      result.newStatus = 'error';
    } else if (action === 'archive' && event === 'all_complete') {
      squadRepo.update(squadId, { status: 'idle' });
      result.newStatus = 'idle';
    }
    // 'continue', 'notify', 'idle' — no side effect on squad status

    return result;
  },
};

squadController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    status: { type: 'string', enum: ['idle', 'running', 'error'] },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    leaderId: { type: 'string' },
    instructions: { type: 'string', maxLength: 10000 },
    triggerRules: { type: 'object' },
    members: { type: 'array' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['name', 'description', 'leaderId', 'instructions', 'triggerRules', 'status'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        if (v.name !== undefined && (typeof v.name !== 'string' || v.name.length === 0)) return 'name must be a non-empty string';
        if (v.triggerRules !== undefined && typeof v.triggerRules !== 'object') return 'triggerRules must be an object';
        return true;
      },
    },
  },
  delete: {
    id: { type: 'string', required: true },
  },
  addMember: {
    squadId: { type: 'string', required: true },
    agentId: { type: 'string', required: true },
    role: { type: 'string', enum: ['member', 'leader'] },
  },
  removeMember: {
    squadId: { type: 'string', required: true },
    agentId: { type: 'string', required: true },
  },
  listMembers: {
    squadId: { type: 'string', required: true },
  },
  batchStart: {
    squadId: { type: 'string', required: true },
  },
  batchStop: {
    squadId: { type: 'string', required: true },
  },
  getAggregatedStatus: {
    squadId: { type: 'string', required: true },
  },
  evaluateTriggerRule: {
    event: { type: 'string', required: true, enum: ['member_complete', 'error', 'all_complete'] },
    squadId: { type: 'string', required: true },
    agentId: { type: 'string' },
  },
  applyTriggerRule: {
    event: { type: 'string', required: true, enum: ['member_complete', 'error', 'all_complete'] },
    squadId: { type: 'string', required: true },
    agentId: { type: 'string' },
  },
};

module.exports = squadController;
