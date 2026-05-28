'use strict';

/**
 * SQLite-backed message queue for crash recovery.
 * Uses the existing better-sqlite3 connection from the app.
 */
class MessagePersistence {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this._db = db;
    this._init();
  }

  _init() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS message_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        topic TEXT NOT NULL,
        payload TEXT NOT NULL,
        correlation_id TEXT,
        reply_to TEXT,
        sender_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        ttl INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_mq_topic ON message_queue(topic);
      CREATE INDEX IF NOT EXISTS idx_mq_correlation ON message_queue(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_mq_timestamp ON message_queue(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mq_created ON message_queue(created_at);
    `);

    // Prepared statements for hot paths
    this._insert = this._db.prepare(`
      INSERT INTO message_queue (id, type, topic, payload, correlation_id, reply_to, sender_id, timestamp, ttl)
      VALUES (@id, @type, @topic, @payload, @correlationId, @replyTo, @senderId, @timestamp, @ttl)
    `);

    this._selectByTopic = this._db.prepare(`
      SELECT * FROM message_queue
      WHERE topic = ? AND timestamp > ?
      ORDER BY timestamp ASC
      LIMIT ?
    `);

    this._selectByCorrelation = this._db.prepare(`
      SELECT * FROM message_queue
      WHERE correlation_id = ?
      ORDER BY timestamp ASC
    `);

    this._deleteOlderThan = this._db.prepare(`
      DELETE FROM message_queue WHERE created_at < ?
    `);

    this._deleteById = this._db.prepare(`
      DELETE FROM message_queue WHERE id = ?
    `);

    this._countByTopic = this._db.prepare(`
      SELECT COUNT(*) as count FROM message_queue WHERE topic = ?
    `);
  }

  /**
   * Persist a message to the queue.
   * @param {import('./message-bus').Message} msg
   * @returns {Promise<void>}
   */
  async enqueue(msg) {
    this._insert.run({
      id: msg.id,
      type: msg.type,
      topic: msg.topic,
      payload: JSON.stringify(msg.payload),
      correlationId: msg.correlationId ?? null,
      replyTo: msg.replyTo ?? null,
      senderId: msg.senderId,
      timestamp: msg.timestamp,
      ttl: msg.ttl ?? null,
    });
  }

  /**
   * Replay messages for a topic.
   * @param {string} topic
   * @param {object} [options]
   * @param {number} [options.since]
   * @param {number} [options.limit=100]
   * @returns {Promise<import('./message-bus').Message[]>}
   */
  async replay(topic, options = {}) {
    const since = options.since ?? 0;
    const limit = options.limit ?? 100;
    const rows = this._selectByTopic.all(topic, since, limit);
    return rows.map(this._rowToMessage);
  }

  /**
   * Find all messages with a given correlation ID.
   * @param {string} correlationId
   * @returns {Promise<import('./message-bus').Message[]>}
   */
  async findByCorrelation(correlationId) {
    const rows = this._selectByCorrelation.all(correlationId);
    return rows.map(this._rowToMessage);
  }

  /**
   * Purge messages older than maxAge ms.
   * @param {number} maxAge - Max age in milliseconds
   * @returns {number} rows deleted
   */
  purge(maxAge) {
    const cutoff = Date.now() - maxAge;
    const result = this._deleteOlderThan.run(cutoff);
    return result.changes;
  }

  /**
   * Remove a specific message by ID.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const result = this._deleteById.run(id);
    return result.changes > 0;
  }

  /**
   * Get message count for a topic.
   * @param {string} topic
   * @returns {number}
   */
  count(topic) {
    const row = this._countByTopic.get(topic);
    return row ? row.count : 0;
  }

  /** @param {object} row @returns {import('./message-bus').Message} */
  _rowToMessage(row) {
    return {
      id: row.id,
      type: row.type,
      topic: row.topic,
      payload: JSON.parse(row.payload),
      correlationId: row.correlation_id,
      replyTo: row.reply_to,
      senderId: row.sender_id,
      timestamp: row.timestamp,
      ttl: row.ttl,
    };
  }
}

module.exports = { MessagePersistence };
