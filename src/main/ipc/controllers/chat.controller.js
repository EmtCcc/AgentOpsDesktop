'use strict';

const { IpcError } = require('../errors');

let chatRepo = null;
let agentRepo = null;
let chatEngine = null;

const chatController = {
  setRepository(repo) {
    chatRepo = repo;
  },

  setAgentRepository(repo) {
    agentRepo = repo;
  },

  setEngine(engine) {
    chatEngine = engine;
  },

  // ── Session CRUD ──

  async list(event, params = {}) {
    if (!chatRepo) throw IpcError.internal('Chat repository not initialized');
    return chatRepo.listWithDetails(params);
  },

  async get(event, { id }) {
    if (!chatRepo) throw IpcError.internal('Chat repository not initialized');
    const session = chatRepo.getSessionWithDetails(id);
    if (!session) throw IpcError.notFound('Chat session', id);
    return session;
  },

  async create(event, { title, agentIds, strategyType, strategyConfig }) {
    if (!chatEngine) throw IpcError.internal('Chat engine not initialized');
    return chatEngine.createSession({ title, agentIds, strategyType, strategyConfig });
  },

  async update(event, { id, updates }) {
    if (!chatRepo) throw IpcError.internal('Chat repository not initialized');
    const existing = chatRepo.getById(id);
    if (!existing) throw IpcError.notFound('Chat session', id);
    return chatRepo.update(id, updates);
  },

  async delete(event, { id }) {
    if (!chatRepo) throw IpcError.internal('Chat repository not initialized');
    if (chatEngine && chatEngine.isRunning(id)) {
      chatEngine.stopSession(id);
    }
    const deleted = chatRepo.delete(id);
    if (!deleted) throw IpcError.notFound('Chat session', id);
    return { deleted: true, id };
  },

  // ── Session control ──

  async start(event, { id }) {
    if (!chatEngine) throw IpcError.internal('Chat engine not initialized');
    return chatEngine.startSession(id);
  },

  async pause(event, { id }) {
    if (!chatEngine) throw IpcError.internal('Chat engine not initialized');
    return chatEngine.pauseSession(id);
  },

  async resume(event, { id }) {
    if (!chatEngine) throw IpcError.internal('Chat engine not initialized');
    return chatEngine.resumeSession(id);
  },

  async stop(event, { id }) {
    if (!chatEngine) throw IpcError.internal('Chat engine not initialized');
    return chatEngine.stopSession(id);
  },

  // ── Human intervention ──

  async sendMessage(event, { id, content }) {
    if (!chatEngine) throw IpcError.internal('Chat engine not initialized');
    return chatEngine.sendHumanMessage(id, content);
  },

  // ── Messages ──

  async listMessages(event, { id, since }) {
    if (!chatRepo) throw IpcError.internal('Chat repository not initialized');
    const session = chatRepo.getById(id);
    if (!session) throw IpcError.notFound('Chat session', id);
    return chatRepo.listMessages(id, { since });
  },

  // ── Participants ──

  async addParticipant(event, { id, agentId, role }) {
    if (!chatRepo) throw IpcError.internal('Chat repository not initialized');
    const session = chatRepo.getById(id);
    if (!session) throw IpcError.notFound('Chat session', id);
    if (agentRepo) {
      const agent = agentRepo.getById(agentId);
      if (!agent) throw IpcError.notFound('Agent', agentId);
    }
    return chatRepo.addParticipant(id, agentId, role || 'expert');
  },

  async removeParticipant(event, { id, agentId }) {
    if (!chatRepo) throw IpcError.internal('Chat repository not initialized');
    const session = chatRepo.getById(id);
    if (!session) throw IpcError.notFound('Chat session', id);
    const removed = chatRepo.removeParticipant(id, agentId);
    if (!removed) throw IpcError.notFound('Participant', `${id}:${agentId}`);
    return { removed: true, chatId: id, agentId };
  },

  // ── Engine state ──

  async getState(event, { id }) {
    if (!chatEngine) throw IpcError.internal('Chat engine not initialized');
    return chatEngine.getSessionState(id);
  },
};

chatController.schemas = {
  list: {
    offset: { type: 'number' },
    limit: { type: 'number' },
    status: { type: 'string', enum: ['active', 'paused', 'completed'] },
  },
  get: {
    id: { type: 'string', required: true },
  },
  create: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    agentIds: { type: 'array', required: true },
    strategyType: { type: 'string', enum: ['round-robin', 'manager-assign', 'topic-trigger', 'human-assign'] },
    strategyConfig: { type: 'object' },
  },
  update: {
    id: { type: 'string', required: true },
    updates: {
      type: 'object',
      required: true,
      validate: (v) => {
        if (!v || typeof v !== 'object') return 'updates must be an object';
        const allowed = ['title', 'status', 'strategyType', 'strategyConfig'];
        const keys = Object.keys(v);
        if (keys.length === 0) return 'updates must not be empty';
        const invalid = keys.filter((k) => !allowed.includes(k));
        if (invalid.length > 0) return `invalid fields: ${invalid.join(', ')}`;
        return true;
      },
    },
  },
  delete: {
    id: { type: 'string', required: true },
  },
  start: {
    id: { type: 'string', required: true },
  },
  pause: {
    id: { type: 'string', required: true },
  },
  resume: {
    id: { type: 'string', required: true },
  },
  stop: {
    id: { type: 'string', required: true },
  },
  sendMessage: {
    id: { type: 'string', required: true },
    content: { type: 'string', required: true, minLength: 1 },
  },
  listMessages: {
    id: { type: 'string', required: true },
    since: { type: 'string' },
  },
  addParticipant: {
    id: { type: 'string', required: true },
    agentId: { type: 'string', required: true },
    role: { type: 'string', enum: ['manager', 'expert', 'observer'] },
  },
  removeParticipant: {
    id: { type: 'string', required: true },
    agentId: { type: 'string', required: true },
  },
  getState: {
    id: { type: 'string', required: true },
  },
};

module.exports = chatController;
