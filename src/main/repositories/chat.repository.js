'use strict';

const { randomUUID } = require('crypto');

/**
 * Repository for Group Chat persistence.
 * Manages chat_sessions, chat_participants, and chat_messages tables.
 */
class ChatRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmts = {
      // ── Sessions ──
      insertSession: this.db.prepare(`
        INSERT INTO chat_sessions (id, title, status, strategy_type, strategy_config, created_at, updated_at)
        VALUES (@id, @title, @status, @strategyType, @strategyConfig, @createdAt, @updatedAt)
      `),
      updateSession: this.db.prepare(`
        UPDATE chat_sessions SET title = @title, status = @status, strategy_type = @strategyType,
          strategy_config = @strategyConfig, updated_at = @updatedAt
        WHERE id = @id
      `),
      deleteSession: this.db.prepare('DELETE FROM chat_sessions WHERE id = @id'),
      getSessionById: this.db.prepare('SELECT * FROM chat_sessions WHERE id = @id'),
      listSessions: this.db.prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC'),
      listSessionsByStatus: this.db.prepare('SELECT * FROM chat_sessions WHERE status = @status ORDER BY updated_at DESC'),

      // ── Participants ──
      insertParticipant: this.db.prepare(`
        INSERT OR IGNORE INTO chat_participants (chat_id, agent_id, role, status, added_at)
        VALUES (@chatId, @agentId, @role, @status, @addedAt)
      `),
      deleteParticipant: this.db.prepare('DELETE FROM chat_participants WHERE chat_id = @chatId AND agent_id = @agentId'),
      deleteAllParticipants: this.db.prepare('DELETE FROM chat_participants WHERE chat_id = @chatId'),
      listParticipants: this.db.prepare('SELECT * FROM chat_participants WHERE chat_id = @chatId'),
      getParticipant: this.db.prepare('SELECT * FROM chat_participants WHERE chat_id = @chatId AND agent_id = @agentId'),
      updateParticipantStatus: this.db.prepare('UPDATE chat_participants SET status = @status WHERE chat_id = @chatId AND agent_id = @agentId'),

      // ── Messages ──
      insertMessage: this.db.prepare(`
        INSERT INTO chat_messages (id, chat_id, agent_id, content, type, created_at)
        VALUES (@id, @chatId, @agentId, @content, @type, @createdAt)
      `),
      listMessages: this.db.prepare('SELECT * FROM chat_messages WHERE chat_id = @chatId ORDER BY created_at ASC'),
      listMessagesSince: this.db.prepare('SELECT * FROM chat_messages WHERE chat_id = @chatId AND created_at > @since ORDER BY created_at ASC'),
      countMessages: this.db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE chat_id = @chatId'),
      deleteMessages: this.db.prepare('DELETE FROM chat_messages WHERE chat_id = @chatId'),

      // ── Aggregate ──
      getSessionStats: this.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM chat_messages WHERE chat_id = @chatId) as messageCount,
          (SELECT MIN(created_at) FROM chat_messages WHERE chat_id = @chatId) as firstMessageAt,
          (SELECT MAX(created_at) FROM chat_messages WHERE chat_id = @chatId) as lastMessageAt
      `),
    };
  }

  // ── Mapping helpers ──

  _sessionToRecord(row) {
    if (!row) return null;
    let strategyConfig = {};
    if (row.strategy_config) {
      try { strategyConfig = JSON.parse(row.strategy_config); } catch { /* keep empty */ }
    }
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      strategyType: row.strategy_type,
      strategyConfig,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  _sessionToDbParams(session) {
    const now = new Date().toISOString();
    return {
      id: session.id || randomUUID(),
      title: session.title,
      status: session.status || 'active',
      strategyType: session.strategyType || 'round-robin',
      strategyConfig: session.strategyConfig ? JSON.stringify(session.strategyConfig) : '{}',
      createdAt: session.createdAt || now,
      updatedAt: now,
    };
  }

  _participantToRecord(row) {
    if (!row) return null;
    return {
      chatId: row.chat_id,
      agentId: row.agent_id,
      role: row.role,
      status: row.status,
      addedAt: row.added_at,
    };
  }

  _messageToRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      chatId: row.chat_id,
      agentId: row.agent_id || null,
      content: row.content,
      type: row.type,
      createdAt: row.created_at,
    };
  }

  // ── Session CRUD ──

  create(session) {
    const params = this._sessionToDbParams(session);
    this._stmts.insertSession.run(params);
    return this._sessionToRecord(this._stmts.getSessionById.get({ id: params.id }));
  }

  getById(id) {
    return this._sessionToRecord(this._stmts.getSessionById.get({ id }));
  }

  getSessionWithDetails(id) {
    const session = this.getById(id);
    if (!session) return null;
    const participants = this._stmts.listParticipants.all({ chatId: id }).map((r) => this._participantToRecord(r));
    const stats = this._stmts.getSessionStats.get({ chatId: id });
    return {
      ...session,
      participants,
      messageCount: stats?.messageCount || 0,
      firstMessageAt: stats?.firstMessageAt || null,
      lastMessageAt: stats?.lastMessageAt || null,
    };
  }

  update(id, updates) {
    const existing = this._stmts.getSessionById.get({ id });
    if (!existing) return null;
    const merged = { ...this._sessionToRecord(existing), ...updates, id };
    const params = this._sessionToDbParams(merged);
    this._stmts.updateSession.run(params);
    return this._sessionToRecord(this._stmts.getSessionById.get({ id }));
  }

  delete(id) {
    this._stmts.deleteMessages.run({ chatId: id });
    this._stmts.deleteAllParticipants.run({ chatId: id });
    const result = this._stmts.deleteSession.run({ id });
    return result.changes > 0;
  }

  list(params = {}) {
    const { offset = 0, limit = 20, status } = params;
    let rows;
    if (status) {
      rows = this._stmts.listSessionsByStatus.all({ status });
    } else {
      rows = this._stmts.listSessions.all();
    }
    const total = rows.length;
    const items = rows.slice(offset, offset + limit).map((r) => this._sessionToRecord(r));
    return { items, total, offset, limit, hasMore: offset + limit < total };
  }

  listWithDetails(params = {}) {
    const result = this.list(params);
    result.items = result.items.map((session) => {
      const participants = this._stmts.listParticipants.all({ chatId: session.id }).map((r) => this._participantToRecord(r));
      const stats = this._stmts.getSessionStats.get({ chatId: session.id });
      return {
        ...session,
        participants,
        messageCount: stats?.messageCount || 0,
      };
    });
    return result;
  }

  // ── Participant management ──

  addParticipant(chatId, agentId, role = 'expert') {
    const now = new Date().toISOString();
    this._stmts.insertParticipant.run({ chatId, agentId, role, status: 'idle', addedAt: now });
    return this._participantToRecord(this._stmts.getParticipant.get({ chatId, agentId }));
  }

  removeParticipant(chatId, agentId) {
    const result = this._stmts.deleteParticipant.run({ chatId, agentId });
    return result.changes > 0;
  }

  updateParticipantStatus(chatId, agentId, status) {
    this._stmts.updateParticipantStatus.run({ chatId, agentId, status });
    return this._participantToRecord(this._stmts.getParticipant.get({ chatId, agentId }));
  }

  listParticipants(chatId) {
    return this._stmts.listParticipants.all({ chatId }).map((r) => this._participantToRecord(r));
  }

  // ── Message management ──

  addMessage(chatId, content, { agentId = null, type = 'chat' } = {}) {
    const now = new Date().toISOString();
    const id = randomUUID();
    this._stmts.insertMessage.run({ id, chatId, agentId, content, type, createdAt: now });
    // Update session's updated_at
    this.db.prepare('UPDATE chat_sessions SET updated_at = @now WHERE id = @id').run({ now, id: chatId });
    return this._messageToRecord(this._stmts.listMessages.all({ chatId }).pop());
  }

  listMessages(chatId, { since } = {}) {
    if (since) {
      return this._stmts.listMessagesSince.all({ chatId, since }).map((r) => this._messageToRecord(r));
    }
    return this._stmts.listMessages.all({ chatId }).map((r) => this._messageToRecord(r));
  }
}

module.exports = { ChatRepository };
