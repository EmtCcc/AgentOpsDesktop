'use strict';

const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');

/**
 * Client library for agent processes to connect to SocketBusServer.
 *
 * Usage:
 *   const client = new SocketBusClient({ socketPath, agentId, squadId });
 *   await client.connect();
 *   client.subscribe('task.update', (msg) => { ... });
 *   client.publish('task.update', 'event', { status: 'done' });
 *   const res = await client.request('query.status', { taskId: '123' });
 *   client.close();
 */

class SocketBusClient extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} opts.socketPath - Unix socket path
   * @param {string} opts.agentId
   * @param {string} opts.squadId
   * @param {string} [opts.token]
   * @param {number} [opts.connectTimeout=5000]
   * @param {number} [opts.requestTimeout=10000]
   */
  constructor(opts) {
    super();
    this._socketPath = opts.socketPath;
    this._agentId = opts.agentId;
    this._squadId = opts.squadId;
    this._token = opts.token ?? null;
    this._connectTimeout = opts.connectTimeout ?? 5000;
    this._requestTimeout = opts.requestTimeout ?? 10000;

    this._socket = null;
    this._buffer = '';
    this._connected = false;
    this._closed = false;
    this._role = 'member';
    this._roster = null;

    /** @type {Map<string, function>} topic -> handler for local subscriptions */
    this._subscriptions = new Map();

    /** @type {Map<string, {resolve, reject, timer}>} request correlationId -> pending */
    this._pending = new Map();

    this._subscriberIdMap = new Map(); // localTopic -> serverSubscriberId

    // Handshake promise callbacks, set during connect()
    this._handshakeResolve = null;
    this._handshakeReject = null;
  }

  /**
   * Connect to the bus server and perform handshake.
   * @returns {Promise<void>}
   */
  async connect() {
    if (this._connected) return;

    return new Promise((resolve, reject) => {
      this._handshakeResolve = resolve;
      this._handshakeReject = reject;

      const timeout = setTimeout(() => {
        this._handshakeResolve = null;
        this._handshakeReject = null;
        reject(new Error('Connection timeout'));
        if (this._socket) this._socket.destroy();
      }, this._connectTimeout);

      this._socket = net.createConnection(this._socketPath);
      this._socket.setEncoding('utf8');

      this._socket.on('connect', () => {
        this._rawSend({
          type: 'handshake',
          agentId: this._agentId,
          squadId: this._squadId,
          token: this._token,
        });
      });

      this._socket.on('data', (data) => {
        this._buffer += data;
        this._processBuffer();
      });

      this._socket.on('error', (err) => {
        clearTimeout(timeout);
        if (this._handshakeReject) {
          const rej = this._handshakeReject;
          this._handshakeResolve = null;
          this._handshakeReject = null;
          rej(err);
        } else if (this._connected) {
          this.emit('error', err);
        }
      });

      this._socket.on('close', () => {
        clearTimeout(timeout);
        if (this._handshakeReject) {
          const rej = this._handshakeReject;
          this._handshakeResolve = null;
          this._handshakeReject = null;
          rej(new Error('Connection closed before handshake'));
        }
        this._connected = false;
        this.emit('disconnected');
      });
    });
  }

  /**
   * Subscribe to a topic (within squad namespace).
   * @param {string} topic
   * @param {function(object): void} handler
   */
  subscribe(topic, handler) {
    this._assertConnected();
    this._subscriptions.set(topic, handler);
    this._rawSend({ type: 'subscribe', topic });
  }

  /**
   * Unsubscribe from a topic.
   * @param {string} topic
   */
  unsubscribe(topic) {
    this._assertConnected();
    const subscriberId = this._subscriberIdMap.get(topic);
    if (subscriberId) {
      this._rawSend({ type: 'unsubscribe', subscriberId });
      this._subscriberIdMap.delete(topic);
    }
    this._subscriptions.delete(topic);
  }

  /**
   * Publish a message.
   * @param {string} topic
   * @param {string} msgType - 'request'|'response'|'event'|'heartbeat'
   * @param {*} payload
   * @param {object} [meta]
   */
  publish(topic, msgType, payload, meta = {}) {
    this._assertConnected();
    this._rawSend({ type: 'publish', topic, msgType, payload, meta });
  }

  /**
   * Send a request and wait for a correlated response.
   * @param {string} topic
   * @param {*} payload
   * @param {object} [opts]
   * @param {number} [opts.timeout]
   * @returns {Promise<object>}
   */
  request(topic, payload, opts = {}) {
    this._assertConnected();
    const timeout = opts.timeout ?? this._requestTimeout;
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(requestId);
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);

      this._pending.set(requestId, { resolve, reject, timer });

      this._rawSend({ type: 'request', topic, payload, timeout, requestId });
    });
  }

  /**
   * Close the connection.
   */
  close() {
    if (this._closed) return;
    this._closed = true;
    this._connected = false;

    // Reject all pending requests
    for (const [, entry] of this._pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Client closed'));
    }
    this._pending.clear();

    if (this._socket) {
      this._socket.destroy();
      this._socket = null;
    }

    this._subscriptions.clear();
    this._subscriberIdMap.clear();
    this.removeAllListeners();
  }

  /** @returns {boolean} */
  get connected() {
    return this._connected;
  }

  /** @returns {string} 'leader' or 'member' */
  get role() {
    return this._role || 'member';
  }

  /** @returns {Array|null} squad roster (leader only) */
  get roster() {
    return this._roster || null;
  }

  /**
   * Delegate a task to a specific squad member (leader only).
   * Publishes a 'delegate' event on the member's private topic.
   * @param {string} targetAgentId
   * @param {*} taskPayload
   */
  delegate(targetAgentId, taskPayload) {
    this._assertConnected();
    this.publish(`member.${targetAgentId}.delegate`, 'event', taskPayload);
  }

  /**
   * Publish a squad-level delegation command (leader only).
   * Topic on bus: squad.{squadId}.delegate
   * @param {string} targetAgentId - agent to delegate to
   * @param {*} taskPayload - task description
   */
  delegateTask(targetAgentId, taskPayload) {
    this._assertConnected();
    this.publish('delegate', 'event', { targetAgentId, ...taskPayload });
  }

  /**
   * Delegate a task to any idle agent matching a role (leader only).
   * The server resolves the role to a concrete agent via wildcard members.
   * @param {string} targetRole - role to match (e.g. 'engineer')
   * @param {*} taskPayload - task description
   * @returns {Promise<{agentId: string, targetRole: string}>}
   */
  delegateToRole(targetRole, taskPayload) {
    this._assertConnected();
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(requestId);
        reject(new Error(`delegateToRole timed out for role: ${targetRole}`));
      }, this._requestTimeout);

      this._pending.set(requestId, {
        resolve: (msg) => resolve(msg.payload || { agentId: msg.agentId, targetRole }),
        reject,
        timer,
      });

      this._rawSend({ type: 'delegateToRole', targetRole, taskPayload, requestId });
    });
  }

  /**
   * Report task completion back to the squad (member only).
   * Topic on bus: squad.{squadId}.complete
   * @param {*} resultPayload - task output
   */
  complete(resultPayload) {
    this._assertConnected();
    this.publish('complete', 'event', { agentId: this._agentId, ...resultPayload });
  }

  /**
   * Report task error back to the squad (member only).
   * Topic on bus: squad.{squadId}.error
   * @param {string} error - error message
   * @param {*} [details] - additional error details
   */
  error(error, details) {
    this._assertConnected();
    this.publish('error', 'event', { agentId: this._agentId, error, details });
  }

  // ── Internals ─────────────────────────────────────────────

  _processBuffer() {
    let newlineIdx;
    while ((newlineIdx = this._buffer.indexOf('\n')) !== -1) {
      const line = this._buffer.slice(0, newlineIdx);
      this._buffer = this._buffer.slice(newlineIdx + 1);

      if (line.length === 0) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      this._handleMessage(msg);
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'handshake_ok':
        this._connected = true;
        this._role = msg.role || 'member';
        this._roster = msg.roster || null;
        if (this._handshakeResolve) {
          const res = this._handshakeResolve;
          this._handshakeResolve = null;
          this._handshakeReject = null;
          res();
        }
        this.emit('connected', { agentId: msg.agentId, role: this._role, roster: this._roster });
        break;

      case 'handshake_error': {
        const err = new Error(`Handshake failed: ${msg.error}`);
        if (this._handshakeReject) {
          const rej = this._handshakeReject;
          this._handshakeResolve = null;
          this._handshakeReject = null;
          rej(err);
          this._socket.destroy();
        } else {
          this.emit('error', err);
          this.close();
        }
        break;
      }

      case 'subscribed': {
        if (msg.topic) {
          this._subscriberIdMap.set(msg.topic, msg.subscriberId);
        }
        break;
      }

      case 'unsubscribed':
        break;

      case 'message': {
        const handler = this._subscriptions.get(msg.topic);
        if (handler) {
          try {
            handler({
              id: msg.id,
              type: msg.type,
              topic: msg.topic,
              payload: msg.payload,
              senderId: msg.senderId,
              timestamp: msg.timestamp,
              correlationId: msg.correlationId,
            });
          } catch { /* handler errors don't break client */ }
        }
        break;
      }

      case 'response': {
        const key = msg.requestId || msg.correlationId;
        if (key) {
          const pending = this._pending.get(key);
          if (pending) {
            clearTimeout(pending.timer);
            this._pending.delete(key);
            pending.resolve({
              id: msg.id,
              type: msg.type,
              topic: msg.topic,
              payload: msg.payload,
              correlationId: msg.correlationId,
              senderId: msg.senderId,
              timestamp: msg.timestamp,
            });
          }
        }
        break;
      }

      case 'published':
        this.emit('published', { messageId: msg.messageId, topic: msg.topic });
        break;

      case 'delegateToRole_ok': {
        const key = msg.requestId;
        if (key) {
          const pending = this._pending.get(key);
          if (pending) {
            clearTimeout(pending.timer);
            this._pending.delete(key);
            pending.resolve({ agentId: msg.agentId, targetRole: msg.targetRole });
          }
        }
        break;
      }

      case 'delegateToRole_error': {
        const key = msg.requestId;
        if (key) {
          const pending = this._pending.get(key);
          if (pending) {
            clearTimeout(pending.timer);
            this._pending.delete(key);
            pending.reject(new Error(msg.error));
          }
        }
        break;
      }

      case 'error':
        this.emit('error', new Error(msg.error));
        break;

      default:
        this.emit('unknown', msg);
    }
  }

  _rawSend(obj) {
    if (!this._socket || this._socket.destroyed) return;
    try {
      this._socket.write(JSON.stringify(obj) + '\n');
    } catch { /* socket may have died */ }
  }

  _assertConnected() {
    if (!this._connected) throw new Error('Not connected to bus');
  }
}

module.exports = { SocketBusClient };
