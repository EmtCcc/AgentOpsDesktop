'use strict';

const { Hono } = require('hono');
const { validateRequest } = require('../middleware/validate');

const squads = new Hono();

const listQuerySchema = {
  offset: { type: 'number', min: 0 },
  limit: { type: 'number', min: 1, max: 100 },
  status: { type: 'string', enum: ['idle', 'running', 'error'] },
};

const createBodySchema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  description: { type: 'string', maxLength: 1000 },
  leaderId: { type: 'string' },
  members: { type: 'array' },
};

const updateBodySchema = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: 'string', maxLength: 1000 },
  leaderId: { type: 'string' },
  status: { type: 'string', enum: ['idle', 'running', 'error'] },
};

const memberBodySchema = {
  agentId: { type: 'string', required: true },
  role: { type: 'string', enum: ['member', 'leader'] },
};

/**
 * GET /squads — List squads (paginated, with members).
 */
squads.get('/', validateRequest({ query: listQuerySchema }), async (c) => {
  const repo = c.get('repos').squads;
  const { offset, limit, status } = c.req.query();
  const params = {
    offset: offset ? parseInt(offset, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    status,
  };
  const result = repo.listWithMembers(params);
  return c.json({ ok: true, data: result.items, meta: { total: result.total, offset: result.offset, limit: result.limit } });
});

/**
 * GET /squads/:id — Get a single squad with members.
 */
squads.get('/:id', async (c) => {
  const repo = c.get('repos').squads;
  const squad = repo.getSquadWithMembers(c.req.param('id'));
  if (!squad) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Squad not found' } }, 404);
  return c.json({ ok: true, data: squad });
});

/**
 * POST /squads — Create a new squad.
 */
squads.post('/', validateRequest({ body: createBodySchema }), async (c) => {
  const repo = c.get('repos').squads;
  const body = c.get('validatedBody');

  const created = repo.create(body);

  // Add members if provided
  if (body.members && Array.isArray(body.members)) {
    for (const member of body.members) {
      const agentId = typeof member === 'string' ? member : member.agentId;
      const role = typeof member === 'string' ? 'member' : (member.role || 'member');
      repo.addMember(created.id, agentId, role);
    }
  }

  // Set leader as member with 'leader' role
  if (body.leaderId) {
    const existing = repo.listMembers(created.id).find((m) => m.agentId === body.leaderId);
    if (existing) {
      repo.updateMemberRole(created.id, body.leaderId, 'leader');
    } else {
      repo.addMember(created.id, body.leaderId, 'leader');
    }
  }

  const squad = repo.getSquadWithMembers(created.id);
  return c.json({ ok: true, data: squad }, 201);
});

/**
 * PATCH /squads/:id — Update a squad.
 */
squads.patch('/:id', validateRequest({ body: updateBodySchema }), async (c) => {
  const repo = c.get('repos').squads;
  const body = c.get('validatedBody');
  const id = c.req.param('id');

  const existing = repo.getById(id);
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Squad not found' } }, 404);

  // Handle leaderId change
  if (body.leaderId !== undefined && body.leaderId !== existing.leaderId) {
    if (existing.leaderId) {
      const oldLeader = repo.listMembers(id).find((m) => m.agentId === existing.leaderId);
      if (oldLeader) repo.updateMemberRole(id, existing.leaderId, 'member');
    }
    if (body.leaderId) {
      const newLeader = repo.listMembers(id).find((m) => m.agentId === body.leaderId);
      if (newLeader) {
        repo.updateMemberRole(id, body.leaderId, 'leader');
      } else {
        repo.addMember(id, body.leaderId, 'leader');
      }
    }
  }

  const updated = repo.update(id, body);
  return c.json({ ok: true, data: updated });
});

/**
 * DELETE /squads/:id — Delete a squad.
 */
squads.delete('/:id', async (c) => {
  const repo = c.get('repos').squads;
  const deleted = repo.delete(c.req.param('id'));
  if (!deleted) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Squad not found' } }, 404);
  return c.json({ ok: true, data: { deleted: true, id: c.req.param('id') } });
});

/**
 * POST /squads/:id/members — Add a member to a squad.
 */
squads.post('/:id/members', validateRequest({ body: memberBodySchema }), async (c) => {
  const repo = c.get('repos').squads;
  const body = c.get('validatedBody');
  const squadId = c.req.param('id');

  const squad = repo.getById(squadId);
  if (!squad) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Squad not found' } }, 404);

  const member = repo.addMember(squadId, body.agentId, body.role || 'member');
  return c.json({ ok: true, data: member }, 201);
});

/**
 * DELETE /squads/:id/members/:agentId — Remove a member from a squad.
 */
squads.delete('/:id/members/:agentId', async (c) => {
  const repo = c.get('repos').squads;
  const removed = repo.removeMember(c.req.param('id'), c.req.param('agentId'));
  if (!removed) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);
  return c.json({ ok: true, data: { removed: true } });
});

/**
 * GET /squads/:id/status — Get aggregated squad status.
 */
squads.get('/:id/status', async (c) => {
  const repos = c.get('repos');
  const squadRepo = repos.squads;
  const agentRepo = repos.agents;
  const id = c.req.param('id');

  const squad = squadRepo.getSquadWithMembers(id);
  if (!squad) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Squad not found' } }, 404);

  const agentStatuses = [];
  for (const member of squad.members) {
    const agent = agentRepo.getById(member.agentId);
    if (agent) {
      agentStatuses.push({ agentId: agent.id, name: agent.name, status: agent.status, role: member.role });
    }
  }

  const statusCounts = { idle: 0, running: 0, error: 0, offline: 0 };
  for (const a of agentStatuses) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  }

  let aggregatedStatus = 'idle';
  if (statusCounts.running > 0) aggregatedStatus = 'running';
  if (statusCounts.error > 0) aggregatedStatus = 'error';

  return c.json({
    ok: true,
    data: {
      squadId: id,
      squadName: squad.name,
      status: aggregatedStatus,
      memberCount: squad.members.length,
      statusCounts,
      agents: agentStatuses,
    },
  });
});

/**
 * POST /squads/:id/start — Batch start all agents in squad.
 */
squads.post('/:id/start', async (c) => {
  const repo = c.get('repos').squads;
  const id = c.req.param('id');
  const squad = repo.getSquadWithMembers(id);
  if (!squad) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Squad not found' } }, 404);

  repo.update(id, { status: 'running' });
  return c.json({ ok: true, data: { squadId: id, status: 'running', memberCount: squad.members.length } });
});

/**
 * POST /squads/:id/stop — Batch stop all agents in squad.
 */
squads.post('/:id/stop', async (c) => {
  const repo = c.get('repos').squads;
  const id = c.req.param('id');
  const squad = repo.getSquadWithMembers(id);
  if (!squad) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Squad not found' } }, 404);

  repo.update(id, { status: 'idle' });
  return c.json({ ok: true, data: { squadId: id, status: 'idle', memberCount: squad.members.length } });
});

module.exports = squads;
