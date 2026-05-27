'use strict';

/**
 * Agent lifecycle controller — spawn, status, output, kill.
 *
 * Placeholder implementations. Real agent runtime integration
 * will be added in Phase 3 (Agent Runtime Connection).
 */

/** @type {Map<string, {pid: number, sessionId: string, status: string}>} */
const sessions = new Map();

const agentController = {
  /**
   * Spawn a CLI agent for a given task.
   * TODO: Integrate with PTY-based agent runtime.
   */
  async spawn(_event, payload) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const session = {
      sessionId,
      taskId: payload.taskId,
      agentType: payload.agentType,
      status: 'starting',
      pid: null,
      startedAt: Date.now(),
    };

    sessions.set(sessionId, session);

    // Placeholder: real spawn logic goes here
    session.status = 'running';

    return { sessionId, pid: session.pid, status: session.status };
  },

  /**
   * Get status of an agent session.
   */
  async status(_event, payload) {
    const session = sessions.get(payload.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${payload.sessionId}`);
    }
    return { sessionId: session.sessionId, status: session.status };
  },

  /**
   * Kill a running agent session.
   */
  async kill(_event, payload) {
    const session = sessions.get(payload.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${payload.sessionId}`);
    }

    session.status = 'killed';
    // Placeholder: real kill logic (send signal to process)

    return { sessionId: session.sessionId, status: session.status };
  },

  /**
   * List all active agent sessions.
   */
  async list() {
    return Array.from(sessions.values()).map(s => ({
      sessionId: s.sessionId,
      taskId: s.taskId,
      agentType: s.agentType,
      status: s.status,
      startedAt: s.startedAt,
    }));
  },
};

// Validation schemas
agentController.schemas = {
  spawn: {
    taskId: { type: 'string', required: true },
    agentType: { type: 'string', required: true, enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'custom'] },
    command: { type: 'string' },
    args: { type: 'array' },
    cwd: { type: 'string' },
    env: { type: 'object' },
  },
  status: {
    sessionId: { type: 'string', required: true },
  },
  kill: {
    sessionId: { type: 'string', required: true },
    signal: { type: 'string', enum: ['SIGTERM', 'SIGKILL'] },
  },
};

module.exports = agentController;
