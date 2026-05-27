'use strict';

/**
 * Agent lifecycle controller.
 * In-memory store; will be replaced by SQLite in Phase 2.1.
 */

const agents = new Map();
let nextId = 1;

const agentController = {
  async list() {
    return Array.from(agents.values());
  },

  async create(_event, agent) {
    const id = `agent-${nextId++}`;
    const record = { id, status: 'idle', createdAt: Date.now(), ...agent };
    agents.set(id, record);
    return record;
  },

  async update(_event, { id, updates }) {
    const existing = agents.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    agents.set(id, updated);
    return updated;
  },

  async delete(_event, id) {
    return agents.delete(id);
  },

  async healthCheck(_event, id) {
    const agent = agents.get(id);
    if (!agent) return { status: 'error', message: 'Agent not found' };
    const isHealthy = Math.random() > 0.1;
    agent.status = isHealthy ? 'idle' : 'error';
    agent.lastHealthCheck = Date.now();
    agents.set(id, agent);
    return { status: agent.status, timestamp: agent.lastHealthCheck };
  },
};

// Validation schemas
agentController.schemas = {
  create: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    type: { type: 'string' },
    command: { type: 'string' },
    cwd: { type: 'string' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: { type: 'object', required: true },
  },
  delete: {
    // positional string arg, validated inline
  },
};

module.exports = agentController;
