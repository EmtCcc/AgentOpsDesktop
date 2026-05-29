'use strict';

const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');

/**
 * @typedef {'request'|'response'|'event'|'heartbeat'} MessageType
 */

/**
 * @typedef {'critical'|'high'|'normal'|'low'} MessagePriority
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {MessageType} type
 * @property {string} topic
 * @property {*} payload
 * @property {string} [correlationId]
 * @property {string} [replyTo]
 * @property {string} senderId
 * @property {number} timestamp
 * @property {number} [ttl]
 * @property {MessagePriority} [priority]
 */

/**
 * @typedef {Object} BusOptions
 * @property {number} [defaultTimeout=5000] - Default request timeout in ms
 * @property {number} [maxQueueSize=1000] - Max queued messages per slow consumer
 * @property {number} [maxTopicDepth=5] - Max nesting depth for topic segments
 * @property {import('./persistence')} [persistence] - Optional persistence layer
 */

const VALID_TYPES = new Set(['request', 'response', 'event', 'heartbeat']);
const VALID_PRIORITIES = new Set(['critical', 'high', 'normal', 'low']);
/** Numeric weight for priority ordering — higher number = delivered first */
const PRIORITY_ORDER = { critical: 4, high: 3, normal: 2, low: 1 };
const DEFAULT_PRIORITY = 'normal';
const WILDCARD = '*';
const MULTI_WILDCARD = '**';
const MAX_TOPIC_LEN = 256;

class MessageBus extends EventEmitter {
  /** @param {BusOptions} [options] */
  constructor(options = {}) {
    super();
    this.setMaxListeners(200);

    this._defaultTimeout = options.defaultTimeout ?? 5000;
    this._maxQueueSize = options.maxQueueSize ?? 1000;
    this._maxTopicDepth = options.maxTopicDepth ?? 5;
    this._persistence = options.persistence ?? null;

    /** @type {Map<string, Set<function>>} topic -> handlers */
    this._subscriptions = new Map();

    /** @type {Map<string, {resolve, reject, timer}>} correlationId -> pending */
    this._pending = new Map();

    /** @type {Map<string, Message[]>} subscriberId -> queued messages */
    this._queues = new Map();

    /** @type {Map<string, {topic: string, handler: function}>} subscriberId -> subscription info */
    this._subscribers = new Map();

    /** @type {Set<string>} subscriberIds currently draining */
    this._draining = new Set();

    this._closed = false;
  }

  // ─── Pub/Sub ──────────────────────────────────────────────────

  /**
   * Subscribe to a topic. Supports wildcards: `*` for one segment, `**` for many.
   * @param {string} topic
   * @param {function(Message): void} handler
   * @returns {string} subscriberId for unsubscribe
   */
  subscribe(topic, handler) {
    this._assertOpen();
    this._validateTopic(topic);
    if (typeof handler !== 'function') throw new Error('handler must be a function');

    const subscriberId = randomUUID();
    if (!this._subscriptions.has(topic)) {
      this._subscriptions.set(topic, new Set());
    }
    this._subscriptions.get(topic).add(handler);
    this._subscribers.set(subscriberId, { topic, handler });
    this._queues.set(subscriberId, []);

    return subscriberId;
  }

  /**
   * Unsubscribe by subscriberId.
   * @param {string} subscriberId
   * @returns {boolean}
   */
  unsubscribe(subscriberId) {
    const info = this._subscribers.get(subscriberId);
    if (!info) return false;

    const handlers = this._subscriptions.get(info.topic);
    if (handlers) {
      handlers.delete(info.handler);
      if (handlers.size === 0) this._subscriptions.delete(info.topic);
    }
    this._subscribers.delete(subscriberId);
    this._queues.delete(subscriberId);
    return true;
  }

  /**
   * Publish a typed message to a topic.
   * @param {string} topic
   * @param {MessageType} type
   * @param {*} payload
   * @param {Partial<Message>} [meta]
   * @returns {Message}
   */
  publish(topic, type, payload, meta = {}) {
    this._assertOpen();
    this._validateTopic(topic);
    if (!VALID_TYPES.has(type)) throw new Error(`Invalid message type: ${type}`);
    const priority = meta.priority ?? DEFAULT_PRIORITY;
    if (!VALID_PRIORITIES.has(priority)) throw new Error(`Invalid priority: ${priority}`);

    const msg = {
      id: randomUUID(),
      type,
      topic,
      payload,
      correlationId: meta.correlationId,
      replyTo: meta.replyTo,
      senderId: meta.senderId ?? 'system',
      timestamp: Date.now(),
      ttl: meta.ttl,
      priority,
    };

    // Persist if available (fire-and-forget for events, await for requests)
    if (this._persistence) {
      this._persistence.enqueue(msg).catch(() => {});
    }

    this._dispatch(msg);
    return msg;
  }

  // ─── Request/Reply ────────────────────────────────────────────

  /**
   * Send a request and wait for a correlated response.
   * @param {string} topic
   * @param {*} payload
   * @param {object} [options]
   * @param {number} [options.timeout]
   * @param {string} [options.senderId]
   * @returns {Promise<Message>}
   */
  request(topic, payload, options = {}) {
    this._assertOpen();
    const timeout = options.timeout ?? this._defaultTimeout;
    const correlationId = randomUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(correlationId);
        reject(new Error(`Request timed out after ${timeout}ms on topic: ${topic}`));
      }, timeout);

      this._pending.set(correlationId, { resolve, reject, timer });

      this.publish(topic, 'request', payload, {
        correlationId,
        senderId: options.senderId,
      });
    });
  }

  /**
   * Reply to a request message.
   * @param {Message} request
   * @param {*} payload
   * @param {object} [meta]
   * @returns {Message}
   */
  reply(request, payload, meta = {}) {
    this._assertOpen();
    if (!request.correlationId) throw new Error('Cannot reply: message has no correlationId');

    return this.publish(request.topic, 'response', payload, {
      correlationId: request.correlationId,
      replyTo: request.id,
      senderId: meta.senderId ?? 'system',
    });
  }

  // ─── Heartbeat ────────────────────────────────────────────────

  /**
   * Publish a heartbeat message.
   * @param {string} topic
   * @param {string} senderId
   * @param {*} [payload]
   * @returns {Message}
   */
  heartbeat(topic, senderId, payload) {
    return this.publish(topic, 'heartbeat', payload ?? {}, { senderId });
  }

  // ─── Back-pressure ────────────────────────────────────────────

  /**
   * Get queue depth for a subscriber.
   * @param {string} subscriberId
   * @returns {number}
   */
  queueDepth(subscriberId) {
    const q = this._queues.get(subscriberId);
    return q ? q.length : 0;
  }

  /**
   * Drain queued messages for a subscriber. Calls handler for each.
   * @param {string} subscriberId
   * @param {number} [maxBatch=50]
   * @returns {number} messages drained
   */
  drain(subscriberId, maxBatch = 50) {
    const q = this._queues.get(subscriberId);
    const info = this._subscribers.get(subscriberId);
    if (!q || !info || this._draining.has(subscriberId)) return 0;

    this._draining.add(subscriberId);
    let count = 0;
    while (q.length > 0 && count < maxBatch) {
      const msg = q.shift();
      try {
        info.handler(msg);
      } catch {
        // Handler errors don't break the drain
      }
      count++;
    }
    this._draining.delete(subscriberId);
    return count;
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  /**
   * Replay persisted messages for a topic (for crash recovery).
   * @param {string} topic
   * @param {function(Message): void} handler
   * @param {object} [options]
   * @param {number} [options.since] - Only replay messages after this timestamp
   * @param {number} [options.limit=100]
   * @returns {Promise<Message[]>}
   */
  async replay(topic, handler, options = {}) {
    if (!this._persistence) return [];
    const messages = await this._persistence.replay(topic, options);
    for (const msg of messages) {
      try { handler(msg); } catch { /* skip */ }
    }
    return messages;
  }

  /**
   * Gracefully close the bus: clear pending timers, flush queues.
   */
  close() {
    if (this._closed) return;
    this._closed = true;

    for (const [, entry] of this._pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('MessageBus closed'));
    }
    this._pending.clear();

    this._subscriptions.clear();
    this._subscribers.clear();
    this._queues.clear();
    this._draining.clear();
    this.removeAllListeners();
  }

  /** @returns {object} Bus stats */
  stats() {
    return {
      topics: this._subscriptions.size,
      subscribers: this._subscribers.size,
      pendingRequests: this._pending.size,
      totalQueued: [...this._queues.values()].reduce((s, q) => s + q.length, 0),
      closed: this._closed,
    };
  }

  // ─── Internal ─────────────────────────────────────────────────

  /** @param {Message} msg */
  _dispatch(msg) {
    // Check if this is a response to a pending request
    if (msg.type === 'response' && msg.correlationId) {
      const pending = this._pending.get(msg.correlationId);
      if (pending) {
        clearTimeout(pending.timer);
        this._pending.delete(msg.correlationId);
        pending.resolve(msg);
      }
    }

    // Fan out to matching subscribers
    for (const [topic, handlers] of this._subscriptions) {
      if (this._topicMatches(topic, msg.topic)) {
        for (const handler of handlers) {
          // Find the subscriberId for this handler to manage back-pressure
          let subscriberId = null;
          for (const [sid, info] of this._subscribers) {
            if (info.handler === handler && info.topic === topic) {
              subscriberId = sid;
              break;
            }
          }

          if (subscriberId) {
            const q = this._queues.get(subscriberId);
            if (q && q.length > 0) {
              // Slow consumer: queue with priority ordering
              this._enqueueByPriority(q, msg);
              continue;
            }
          }

          try {
            handler(msg);
          } catch {
            // If handler throws, start queuing for this subscriber
            if (subscriberId) {
              const q = this._queues.get(subscriberId);
              if (q) {
                this._enqueueByPriority(q, msg);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Check if subscriptionTopic matches messageTopic.
   * Supports `*` (one segment) and `**` (zero or more segments).
   * @param {string} subscription
   * @param {string} message
   * @returns {boolean}
   */
  _topicMatches(subscription, message) {
    if (subscription === message) return true;

    const subParts = subscription.split('.');
    const msgParts = message.split('.');

    let si = 0, mi = 0;
    while (si < subParts.length && mi < msgParts.length) {
      if (subParts[si] === MULTI_WILDCARD) {
        if (si === subParts.length - 1) return true; // ** at end matches all
        // Try matching 0..N segments
        for (let skip = mi; skip <= msgParts.length; skip++) {
          if (this._topicMatches(
            subParts.slice(si + 1).join('.'),
            msgParts.slice(skip).join('.')
          )) return true;
        }
        return false;
      }
      if (subParts[si] !== WILDCARD && subParts[si] !== msgParts[mi]) return false;
      si++;
      mi++;
    }
    return si === subParts.length && mi === msgParts.length;
  }

  /**
   * Insert a message into a queue maintaining priority order (highest first).
   * When the queue is full, drops the lowest-priority message if the new one is higher.
   * @param {Message[]} q
   * @param {Message} msg
   */
  _enqueueByPriority(q, msg) {
    const msgWeight = PRIORITY_ORDER[msg.priority] ?? PRIORITY_ORDER[DEFAULT_PRIORITY];

    if (q.length >= this._maxQueueSize) {
      // Queue full: compare with the lowest-priority message (tail)
      const tailWeight = PRIORITY_ORDER[q[q.length - 1].priority] ?? PRIORITY_ORDER[DEFAULT_PRIORITY];
      if (msgWeight <= tailWeight) return; // drop new message
      q.pop(); // evict lowest
    }

    // Binary-ish insert: find first position with strictly lower priority
    let lo = 0, hi = q.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const midWeight = PRIORITY_ORDER[q[mid].priority] ?? PRIORITY_ORDER[DEFAULT_PRIORITY];
      if (midWeight >= msgWeight) lo = mid + 1;
      else hi = mid;
    }
    q.splice(lo, 0, msg);
  }

  _validateTopic(topic) {
    if (typeof topic !== 'string' || topic.length === 0) {
      throw new Error('Topic must be a non-empty string');
    }
    if (topic.length > MAX_TOPIC_LEN) {
      throw new Error(`Topic exceeds max length of ${MAX_TOPIC_LEN}`);
    }
    const parts = topic.split('.');
    if (parts.length > this._maxTopicDepth) {
      throw new Error(`Topic depth exceeds max of ${this._maxTopicDepth}`);
    }
    for (const part of parts) {
      if (part.length === 0) throw new Error('Topic segments cannot be empty');
    }
  }

  _assertOpen() {
    if (this._closed) throw new Error('MessageBus is closed');
  }
}

module.exports = { MessageBus, VALID_TYPES, VALID_PRIORITIES, PRIORITY_ORDER };
