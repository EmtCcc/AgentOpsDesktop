'use strict';

const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

/**
 * Wire protocol: newline-delimited JSON (NDJSON).
 *
 * Client -> Server messages:
 *   { type: 'handshake', agentId, squadId, token? }
 *   { type: 'subscribe', topic }
 *   { type: 'unsubscribe', subscriberId }
 *   { type: 'publish', topic, msgType, payload, meta? }
 *   { type: 'request', topic, payload, timeout? }
 *   { type: 'reply', requestMsg, payload }
 *   { type: 'heartbeat', topic, payload? }
 *
 * Server -> Client messages:
 *   { type: 'handshake_ok', agentId }
 *   { type: 'handshake_error', error }
 *   { type: 'subscribed', subscriberId, topic }
 *   { type: 'unsubscribed', ok }
 *   { type: 'message', ...msg }       (incoming pub/sub delivery)
 *   { type: 'response', ...msg }      (request reply)
 *   { type: 'error', error }
 */

const MAX_FRAME_BYTES = 1024 * 1024; // 1 MB per frame

class SocketBusServer extends EventEmitter {
  /**
   * @param {import('./message-bus').MessageBus} bus
   * @param {object} opts
   * @param {string} opts.socketPath - Unix socket path
   * @param {import('../repositories/squad.repository').SquadRepository} [opts.squadRepo]
   * @param {(agentId: string, squadId: string, token?: string) => boolean} [opts.authenticate]
   */
  constructor(bus, opts = {}) {
    super();
    this._bus = bus;
    this._socketPath = opts.socketPath;
    this._squadRepo = opts.squadRepo ?? null;
    this._authenticate = opts.authenticate ?? null;

    /** @type {Map<import('node:net').Socket, ClientState>} */
    this._clients = new Map();

    this._server = null;
    this._closed = false;
  }

  /**
   * Start listening on the Unix socket.
   * @returns {Promise<void>}
   */
  async listen() {
    // Clean up stale socket file
    try { fs.unlinkSync(this._socketPath); } catch { /* ok */ }

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(this._socketPath), { recursive: true });

    return new Promise((resolve, reject) => {
      this._server = net.createServer((socket) => this._onConnection(socket));

      this._server.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this._server.listen(this._socketPath, () => {
        // Restrict socket permissions: owner + group only
        try { fs.chmodSync(this._socketPath, 0o660); } catch { /* ok */ }
        this.emit('listening', this._socketPath);
        resolve();
      });
    });
  }

  /**
   * Gracefully shut down: disconnect clients, close server, remove socket.
   * @returns {Promise<void>}
   */
  async close() {
    if (this._closed) return;
    this._closed = true;

    // Disconnect all clients
    for (const [socket, state] of this._clients) {
      this._cleanupClient(socket, state);
      socket.destroy();
    }
    this._clients.clear();

    // Close server
    if (this._server) {
      await new Promise((resolve) => this._server.close(resolve));
    }

    // Remove socket file
    try { fs.unlinkSync(this._socketPath); } catch { /* ok */ }

    this.removeAllListeners();
  }

  /**
   * Get connected client count.
   */
  get clientCount() {
    return this._clients.size;
  }

  /**
   * List connected clients.
   */
  listClients() {
    const result = [];
    for (const [, state] of this._clients) {
      result.push({
        agentId: state.agentId,
        squadId: state.squadId,
        subscriberIds: [...state.subscriberIds],
        connectedAt: state.connectedAt,
      });
    }
    return result;
  }

  // ── Internals ─────────────────────────────────────────────

  /** @param {net.Socket} socket */
  _onConnection(socket) {
    const state = {
      agentId: null,
      squadId: null,
      authenticated: false,
      subscriberIds: [],
      buffer: '',
      connectedAt: Date.now(),
    };

    this._clients.set(socket, state);

    socket.setEncoding('utf8');
    socket.on('data', (data) => this._onData(socket, state, data));
    socket.on('close', () => this._onDisconnect(socket, state));
    socket.on('error', () => this._onDisconnect(socket, state));
  }

  _onData(socket, state, data) {
    state.buffer += data;

    // Prevent runaway buffers
    if (state.buffer.length > MAX_FRAME_BYTES * 2) {
      this._send(socket, { type: 'error', error: 'Buffer overflow' });
      socket.destroy();
      return;
    }

    // Process complete NDJSON frames
    let newlineIdx;
    while ((newlineIdx = state.buffer.indexOf('\n')) !== -1) {
      const line = state.buffer.slice(0, newlineIdx);
      state.buffer = state.buffer.slice(newlineIdx + 1);

      if (line.length === 0) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        this._send(socket, { type: 'error', error: 'Invalid JSON' });
        continue;
      }

      this._handleMessage(socket, state, msg);
    }
  }

  _handleMessage(socket, state, msg) {
    // Handshake must happen first
    if (!state.authenticated) {
      if (msg.type === 'handshake') {
        this._handleHandshake(socket, state, msg);
      } else {
        this._send(socket, { type: 'error', error: 'Handshake required' });
      }
      return;
    }

    switch (msg.type) {
      case 'subscribe':
        this._handleSubscribe(socket, state, msg);
        break;
      case 'unsubscribe':
        this._handleUnsubscribe(socket, state, msg);
        break;
      case 'publish':
        this._handlePublish(socket, state, msg);
        break;
      case 'request':
        this._handleRequest(socket, state, msg);
        break;
      case 'reply':
        this._handleReply(socket, state, msg);
        break;
      case 'heartbeat':
        this._handleHeartbeat(socket, state, msg);
        break;
      default:
        this._send(socket, { type: 'error', error: `Unknown message type: ${msg.type}` });
    }
  }

  _handleHandshake(socket, state, msg) {
    const { agentId, squadId, token } = msg;

    if (!agentId || !squadId) {
      this._send(socket, { type: 'handshake_error', error: 'agentId and squadId required' });
      socket.destroy();
      return;
    }

    // Authenticate if handler provided
    if (this._authenticate && !this._authenticate(agentId, squadId, token)) {
      this._send(socket, { type: 'handshake_error', error: 'Authentication failed' });
      socket.destroy();
      return;
    }

    // Validate squad exists if repo provided
    let role = 'member';
    let roster = null;
    if (this._squadRepo) {
      const squad = this._squadRepo.getById(squadId);
      if (!squad) {
        this._send(socket, { type: 'handshake_error', error: `Squad not found: ${squadId}` });
        socket.destroy();
        return;
      }

      // Check agent is member of squad and determine role
      const members = this._squadRepo.listMembers(squadId);
      const membership = members.find((m) => m.agentId === agentId);
      if (!membership) {
        this._send(socket, { type: 'handshake_error', error: 'Agent is not a member of this squad' });
        socket.destroy();
        return;
      }
      role = membership.role;

      // Leader gets the full roster for delegation
      if (role === 'leader') {
        roster = members.map((m) => ({ agentId: m.agentId, role: m.role }));
      }
    }

    state.agentId = agentId;
    state.squadId = squadId;
    state.role = role;
    state.authenticated = true;

    const response = { type: 'handshake_ok', agentId, role };
    if (roster) response.roster = roster;
    this._send(socket, response);
    this.emit('client-connected', { agentId, squadId, role });
  }

  _handleSubscribe(socket, state, msg) {
    const { topic } = msg;
    if (!topic) {
      this._send(socket, { type: 'error', error: 'topic required for subscribe' });
      return;
    }

    // Enforce namespace: agent can only subscribe to their squad's topics
    const namespaced = this._namespaceTopic(topic, state.squadId);

    const subscriberId = this._bus.subscribe(namespaced, (busMsg) => {
      // Strip namespace prefix before sending to client
      const stripped = this._stripNamespace(busMsg, state.squadId);
      stripped.type = 'message';
      this._send(socket, stripped);
    });

    state.subscriberIds.push(subscriberId);
    this._send(socket, { type: 'subscribed', subscriberId, topic });
  }

  _handleUnsubscribe(socket, state, msg) {
    const { subscriberId } = msg;
    if (!subscriberId) {
      this._send(socket, { type: 'error', error: 'subscriberId required for unsubscribe' });
      return;
    }

    const ok = this._bus.unsubscribe(subscriberId);
    if (ok) {
      state.subscriberIds = state.subscriberIds.filter((id) => id !== subscriberId);
    }
    this._send(socket, { type: 'unsubscribed', ok });
  }

  _handlePublish(socket, state, msg) {
    const { topic, msgType, payload, meta = {} } = msg;
    if (!topic || !msgType) {
      this._send(socket, { type: 'error', error: 'topic and msgType required for publish' });
      return;
    }

    const namespaced = this._namespaceTopic(topic, state.squadId);
    const busMsg = this._bus.publish(namespaced, msgType, payload, {
      ...meta,
      senderId: state.agentId,
    });

    this._send(socket, {
      type: 'published',
      messageId: busMsg.id,
      topic, // echo back the un-namespaced topic
    });
  }

  _handleRequest(socket, state, msg) {
    const { topic, payload, timeout } = msg;
    if (!topic) {
      this._send(socket, { type: 'error', error: 'topic required for request' });
      return;
    }

    const namespaced = this._namespaceTopic(topic, state.squadId);

    const { requestId } = msg;

    this._bus.request(namespaced, payload, { timeout, senderId: state.agentId })
      .then((response) => {
        const stripped = this._stripNamespace(response, state.squadId);
        stripped.type = 'response';
        stripped.requestId = requestId;
        this._send(socket, stripped);
      })
      .catch((err) => {
        this._send(socket, { type: 'error', error: err.message, requestId });
      });
  }

  _handleReply(socket, state, msg) {
    const { requestMsg, payload } = msg;
    if (!requestMsg || !requestMsg.correlationId) {
      this._send(socket, { type: 'error', error: 'requestMsg with correlationId required' });
      return;
    }

    // Reconstruct the namespaced request for the bus
    const namespacedRequest = {
      ...requestMsg,
      topic: this._namespaceTopic(requestMsg.topic, state.squadId),
    };

    this._bus.reply(namespacedRequest, payload, { senderId: state.agentId });
  }

  _handleHeartbeat(socket, state, msg) {
    const { topic, payload } = msg;
    const namespaced = this._namespaceTopic(topic || 'heartbeat', state.squadId);
    this._bus.heartbeat(namespaced, state.agentId, payload);
  }

  _onDisconnect(socket, state) {
    this._cleanupClient(socket, state);
    this._clients.delete(socket);

    if (state.agentId) {
      this.emit('client-disconnected', {
        agentId: state.agentId,
        squadId: state.squadId,
      });
    }
  }

  _cleanupClient(socket, state) {
    // Unsubscribe all bus subscriptions for this client
    for (const subscriberId of state.subscriberIds) {
      try { this._bus.unsubscribe(subscriberId); } catch { /* ok */ }
    }
    state.subscriberIds = [];
  }

  /**
   * Prefix topic with squad namespace.
   * 'task.update' with squadId 'alpha' -> 'squad.alpha.task.update'
   */
  _namespaceTopic(topic, squadId) {
    // Don't double-prefix if already namespaced
    const prefix = `squad.${squadId}.`;
    if (topic.startsWith(prefix)) return topic;
    return `${prefix}${topic}`;
  }

  /**
   * Strip squad namespace prefix from message topic.
   */
  _stripNamespace(msg, squadId) {
    const prefix = `squad.${squadId}.`;
    return {
      ...msg,
      topic: msg.topic.startsWith(prefix) ? msg.topic.slice(prefix.length) : msg.topic,
    };
  }

  /** @param {net.Socket} socket @param {object} msg */
  _send(socket, msg) {
    if (socket.destroyed) return;
    try {
      socket.write(JSON.stringify(msg) + '\n');
    } catch { /* socket may have died */ }
  }
}

module.exports = { SocketBusServer };
