'use strict';

const { EventEmitter } = require('events');
const CHAT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
};

const DEFAULT_CONFIG = {
  maxTurns: 50,
  turnTimeoutMs: 60000,
  systemPromptTemplate: `You are participating in a group chat discussion.

Chat title: {title}
Your role: {role}
Participants: {participants}

Guidelines:
- Stay on topic and contribute constructively
- Reference other participants' points when relevant
- Be concise but thorough
- If the discussion has reached a natural conclusion, indicate you have nothing more to add`,
};

/**
 * Group Chat Engine — orchestrates multi-agent conversations.
 *
 * Turn strategies:
 *   round-robin: cycles through participants in order
 *   human-assign: waits for human to specify the next speaker
 *
 * Events:
 *   message        — new message added to chat
 *   agent-status   — participant status changed
 *   turn-change    — current speaker changed
 *   session-status — chat session status changed
 *   error          — an error occurred
 */
class GroupChatEngine extends EventEmitter {
  /**
   * @param {object} opts
   * @param {import('./repositories/chat.repository').ChatRepository} opts.chatRepo
   * @param {import('./repositories/agent.repository').AgentRepository} opts.agentRepo
   * @param {import('./agent-runtime').AgentRuntime} opts.runtime
   */
  constructor({ chatRepo, agentRepo, runtime }) {
    super();
    this.chatRepo = chatRepo;
    this.agentRepo = agentRepo;
    this.runtime = runtime;

    /** @type {Map<string, { turnIndex: number, turnCount: number, config: object, running: boolean, abortController: AbortController }>} */
    this._sessions = new Map();
  }

  /**
   * Create a new group chat session.
   */
  createSession({ title, agentIds, strategyType = 'round-robin', strategyConfig = {} }) {
    if (!title || !agentIds || agentIds.length < 2) {
      throw new Error('Title and at least 2 agents are required');
    }

    const session = this.chatRepo.create({
      title,
      strategyType,
      strategyConfig,
    });

    // Add participants
    for (const agentId of agentIds) {
      const agent = this.agentRepo.getById(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      this.chatRepo.addParticipant(session.id, agentId, 'expert');
    }

    // Add system message
    this.chatRepo.addMessage(session.id, `群聊 "${title}" 已创建，${agentIds.length} 位 Agent 参与。`, {
      type: 'system',
    });

    this.emit('session-status', { sessionId: session.id, status: 'active' });
    return this.chatRepo.getSessionWithDetails(session.id);
  }

  /**
   * Start a chat session — begins the turn loop.
   */
  async startSession(sessionId) {
    const session = this.chatRepo.getSessionWithDetails(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status === 'completed') throw new Error('Session already completed');
    if (session.participants.length < 2) throw new Error('Need at least 2 participants');

    if (this._sessions.has(sessionId) && this._sessions.get(sessionId).running) {
      throw new Error('Session already running');
    }

    const config = { ...DEFAULT_CONFIG, ...session.strategyConfig };
    const abortController = new AbortController();

    this._sessions.set(sessionId, {
      turnIndex: 0,
      turnCount: 0,
      config,
      running: true,
      abortController,
    });

    this.chatRepo.update(sessionId, { status: 'active' });
    this.emit('session-status', { sessionId, status: CHAT_STATUS.RUNNING });

    // Start the turn loop
    this._turnLoop(sessionId).catch((err) => {
      this.emit('error', { sessionId, error: err.message });
    });

    return { sessionId, status: CHAT_STATUS.RUNNING };
  }

  /**
   * Pause a running session.
   */
  pauseSession(sessionId) {
    const state = this._sessions.get(sessionId);
    if (!state || !state.running) throw new Error('Session not running');

    state.running = false;
    this.chatRepo.update(sessionId, { status: 'paused' });
    this.emit('session-status', { sessionId, status: CHAT_STATUS.PAUSED });
    return { sessionId, status: CHAT_STATUS.PAUSED };
  }

  /**
   * Resume a paused session.
   */
  async resumeSession(sessionId) {
    const state = this._sessions.get(sessionId);
    if (!state) throw new Error('Session not found in engine');
    if (state.running) throw new Error('Session already running');

    state.running = true;
    this.chatRepo.update(sessionId, { status: 'active' });
    this.emit('session-status', { sessionId, status: CHAT_STATUS.RUNNING });

    this._turnLoop(sessionId).catch((err) => {
      this.emit('error', { sessionId, error: err.message });
    });

    return { sessionId, status: CHAT_STATUS.RUNNING };
  }

  /**
   * Stop a session permanently.
   */
  stopSession(sessionId) {
    const state = this._sessions.get(sessionId);
    if (state) {
      state.running = false;
      state.abortController.abort();
    }

    this.chatRepo.update(sessionId, { status: 'completed' });
    this.emit('session-status', { sessionId, status: CHAT_STATUS.COMPLETED });
    this._sessions.delete(sessionId);
    return { sessionId, status: CHAT_STATUS.COMPLETED };
  }

  /**
   * Human sends a message into the chat.
   * If strategy is human-assign, this also advances the turn.
   */
  async sendHumanMessage(sessionId, content) {
    const session = this.chatRepo.getById(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const message = this.chatRepo.addMessage(sessionId, content, {
      agentId: 'human',
      type: 'instruction',
    });

    this.emit('message', { sessionId, message });

    // If session is running with human-assign strategy, trigger next turn
    const state = this._sessions.get(sessionId);
    if (state && state.running && session.strategyType === 'human-assign') {
      this._runNextTurn(sessionId).catch((err) => {
        this.emit('error', { sessionId, error: err.message });
      });
    }

    return message;
  }

  /**
   * Internal turn loop — runs agents one by one.
   */
  async _turnLoop(sessionId) {
    const state = this._sessions.get(sessionId);
    if (!state || !state.running) return;

    while (state.running && state.turnCount < state.config.maxTurns) {
      await this._runNextTurn(sessionId);
      if (!state.running) break;

      // Small delay between turns to prevent tight loops
      await new Promise((r) => { setTimeout(r, 500); });
    }

    if (state.turnCount >= state.config.maxTurns) {
      this.chatRepo.addMessage(sessionId, `已达到最大轮次 (${state.config.maxTurns})，群聊自动结束。`, {
        type: 'system',
      });
      this.stopSession(sessionId);
    }
  }

  /**
   * Execute a single turn: pick next agent, send prompt, capture response.
   */
  async _runNextTurn(sessionId) {
    const state = this._sessions.get(sessionId);
    if (!state || !state.running) return;

    const session = this.chatRepo.getSessionWithDetails(sessionId);
    if (!session) return;

    const participants = session.participants.filter((p) => p.role !== 'observer');
    if (participants.length === 0) return;

    // Pick next speaker
    let nextAgentId;
    if (session.strategyType === 'human-assign') {
      // Wait for human to specify — for now, use round-robin as fallback
      nextAgentId = participants[state.turnIndex % participants.length].agentId;
    } else {
      // round-robin
      nextAgentId = participants[state.turnIndex % participants.length].agentId;
    }

    const agent = this.agentRepo.getById(nextAgentId);
    if (!agent) {
      state.turnIndex++;
      return;
    }

    // Update participant status
    for (const p of participants) {
      this.chatRepo.updateParticipantStatus(sessionId, p.agentId, p.agentId === nextAgentId ? 'speaking' : 'listening');
      this.emit('agent-status', { sessionId, agentId: p.agentId, status: p.agentId === nextAgentId ? 'speaking' : 'listening' });
    }

    this.emit('turn-change', {
      sessionId,
      turnIndex: state.turnIndex,
      turnCount: state.turnCount,
      agentId: nextAgentId,
      agentName: agent.name,
    });

    // Build conversation history for context
    const messages = this.chatRepo.listMessages(sessionId);
    const history = messages.map((m) => {
      if (m.agentId === 'human') return `Human: ${m.content}`;
      if (m.type === 'system') return `[System] ${m.content}`;
      const p = participants.find((pp) => pp.agentId === m.agentId);
      const agentName = p ? (this.agentRepo.getById(m.agentId)?.name || m.agentId) : m.agentId;
      return `${agentName}: ${m.content}`;
    });

    const participantNames = participants.map((p) => {
      const a = this.agentRepo.getById(p.agentId);
      return `${a?.name || p.agentId} (${p.role})`;
    }).join(', ');

    const systemPrompt = state.config.systemPromptTemplate
      .replace('{title}', session.title)
      .replace('{role}', participants.find((p) => p.agentId === nextAgentId)?.role || 'expert')
      .replace('{participants}', participantNames);

    const fullPrompt = `${systemPrompt}\n\n--- Conversation History ---\n${history.join('\n')}\n\n---\nNow it's your turn to contribute. Respond with your message:`;

    // Spawn agent and capture response
    try {
      const response = await this._getAgentResponse(agent, fullPrompt, state);

      if (!state.running) return;

      // Save response as message
      const message = this.chatRepo.addMessage(sessionId, response, {
        agentId: nextAgentId,
        type: 'chat',
      });

      this.emit('message', { sessionId, message });

      // Mark participant back to idle
      this.chatRepo.updateParticipantStatus(sessionId, nextAgentId, 'idle');
      this.emit('agent-status', { sessionId, agentId: nextAgentId, status: 'idle' });

      state.turnIndex++;
      state.turnCount++;
    } catch (err) {
      if (!state.running) return;

      this.chatRepo.addMessage(sessionId, `${agent.name} 执行出错: ${err.message}`, {
        type: 'system',
      });

      this.chatRepo.updateParticipantStatus(sessionId, nextAgentId, 'idle');
      this.emit('agent-status', { sessionId, agentId: nextAgentId, status: 'idle' });
      this.emit('error', { sessionId, agentId: nextAgentId, error: err.message });

      state.turnIndex++;
      state.turnCount++;
    }
  }

  /**
   * Spawn an agent process and capture its response.
   * Returns a promise that resolves with the agent's text output.
   */
  _getAgentResponse(agent, prompt, state) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const execPath = agent.executable_path || agent.execPath;
      if (!execPath) {
        reject(new Error('Agent executable path not set'));
        return;
      }

      let output = '';
      let stderr = '';
      const timeout = state.config.turnTimeoutMs;

      const proc = spawn(execPath, [], {
        cwd: agent.working_directory || agent.cwd || process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });

      const timer = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
        reject(new Error(`Agent response timed out after ${timeout}ms`));
      }, timeout);

      // Send the prompt via stdin and close
      proc.stdin.write(prompt);
      proc.stdin.end();

      proc.stdout.on('data', (data) => {
        output += data.toString();
        // Emit streaming chunks for real-time display
        this.emit('stream', {
          sessionId: state.sessionId,
          agentId: agent.id,
          chunk: data.toString(),
        });
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 || output.length > 0) {
          resolve(output.trim() || '(no response)');
        } else {
          reject(new Error(`Agent exited with code ${code}: ${stderr.trim()}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Get current engine state for a session.
   */
  getSessionState(sessionId) {
    const state = this._sessions.get(sessionId);
    return {
      sessionId,
      running: state?.running || false,
      turnIndex: state?.turnIndex || 0,
      turnCount: state?.turnCount || 0,
      maxTurns: state?.config?.maxTurns || DEFAULT_CONFIG.maxTurns,
    };
  }

  /**
   * Check if a session is running.
   */
  isRunning(sessionId) {
    const state = this._sessions.get(sessionId);
    return state?.running || false;
  }
}

module.exports = { GroupChatEngine, CHAT_STATUS };
