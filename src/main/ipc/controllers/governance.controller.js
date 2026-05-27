'use strict';

/**
 * Governance controller — approval gates and policy checks.
 *
 * Placeholder implementations. Full governance integration
 * with Paperclip control plane comes in Phase 3+.
 */

/** @type {Map<string, object>} */
const gates = new Map();

const governanceController = {
  /**
   * Respond to an approval gate.
   */
  async approve(_event, payload) {
    const gate = gates.get(payload.gateId);
    if (!gate) {
      throw new Error(`Gate not found: ${payload.gateId}`);
    }

    gate.decision = payload.decision;
    gate.comment = payload.comment || null;
    gate.decidedAt = Date.now();

    return gate;
  },

  /**
   * List pending approval gates.
   */
  async listPending() {
    return Array.from(gates.values()).filter(g => !g.decision);
  },

  /**
   * Register a new approval gate (internal use).
   */
  async register(_event, payload) {
    const gateId = `gate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const gate = {
      gateId,
      taskId: payload.taskId,
      type: payload.type || 'manual',
      description: payload.description || '',
      createdAt: Date.now(),
      decision: null,
    };

    gates.set(gateId, gate);
    return gate;
  },
};

// Validation schemas
governanceController.schemas = {
  approve: {
    gateId: { type: 'string', required: true },
    decision: { type: 'string', required: true, enum: ['approve', 'reject', 'rollback'] },
    comment: { type: 'string', maxLength: 2000 },
  },
  register: {
    taskId: { type: 'string', required: true },
    type: { type: 'string', enum: ['manual', 'auto'] },
    description: { type: 'string', maxLength: 1000 },
  },
};

module.exports = governanceController;
