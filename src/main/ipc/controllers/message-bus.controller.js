'use strict';

/** @type {import('../../message-bus').MessageBus} */
let bus = null;
let mainWindow = null;

function setBus(messageBus) {
  bus = messageBus;
}

function setMainWindow(win) {
  mainWindow = win;
}

const messageBusController = {
  setBus,
  setMainWindow,

  schemas: {
    publish: {
      topic: { type: 'string', required: true },
      type: { type: 'string', required: true, enum: ['request', 'response', 'event', 'heartbeat'] },
      payload: { required: true },
      senderId: { type: 'string' },
      ttl: { type: 'number', min: 0 },
    },
    subscribe: {
      topic: { type: 'string', required: true },
    },
    unsubscribe: {
      subscriberId: { type: 'string', required: true },
    },
    request: {
      topic: { type: 'string', required: true },
      payload: { required: true },
      timeout: { type: 'number', min: 100, max: 60000 },
      senderId: { type: 'string' },
    },
    replay: {
      topic: { type: 'string', required: true },
      since: { type: 'number', min: 0 },
      limit: { type: 'number', min: 1, max: 500 },
    },
  },

  /**
   * Publish a message to a topic.
   * @param {_event} _event
   * @param {object} payload
   * @returns {Promise<{ok: boolean, messageId: string}>}
   */
  async publish(_event, { topic, type, payload, senderId, ttl }) {
    const msg = bus.publish(topic, type, payload, { senderId, ttl });

    // Push to renderer for real-time UI updates
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bus:message', {
        id: msg.id,
        type: msg.type,
        topic: msg.topic,
        payload: msg.payload,
        senderId: msg.senderId,
        timestamp: msg.timestamp,
      });
    }

    return { ok: true, messageId: msg.id };
  },

  /**
   * Subscribe to a topic. Returns subscriberId.
   * The handler pushes messages to the renderer via IPC.
   * @param {_event} _event
   * @param {object} payload
   * @returns {Promise<{ok: boolean, subscriberId: string}>}
   */
  async subscribe(_event, { topic }) {
    const subscriberId = bus.subscribe(topic, (msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bus:message', {
          id: msg.id,
          type: msg.type,
          topic: msg.topic,
          payload: msg.payload,
          senderId: msg.senderId,
          timestamp: msg.timestamp,
        });
      }
    });
    return { ok: true, subscriberId };
  },

  /**
   * Unsubscribe from a topic.
   * @param {_event} _event
   * @param {object} payload
   * @returns {Promise<{ok: boolean}>}
   */
  async unsubscribe(_event, { subscriberId }) {
    const result = bus.unsubscribe(subscriberId);
    return { ok: result };
  },

  /**
   * Send a request and wait for a correlated response.
   * @param {_event} _event
   * @param {object} payload
   * @returns {Promise<Message>}
   */
  async request(_event, { topic, payload, timeout, senderId }) {
    const response = await bus.request(topic, payload, { timeout, senderId });
    return {
      id: response.id,
      type: response.type,
      topic: response.topic,
      payload: response.payload,
      correlationId: response.correlationId,
      senderId: response.senderId,
      timestamp: response.timestamp,
    };
  },

  /**
   * Replay persisted messages for a topic (crash recovery).
   * @param {_event} _event
   * @param {object} payload
   * @returns {Promise<{ok: boolean, messages: Message[]}>}
   */
  async replay(_event, { topic, since, limit }) {
    const messages = await bus.replay(topic, () => {}, { since, limit });
    return {
      ok: true,
      messages: messages.map(m => ({
        id: m.id,
        type: m.type,
        topic: m.topic,
        payload: m.payload,
        correlationId: m.correlationId,
        senderId: m.senderId,
        timestamp: m.timestamp,
      })),
    };
  },

  /**
   * Get bus stats.
   * @returns {Promise<object>}
   */
  async stats() {
    return bus.stats();
  },
};

module.exports = messageBusController;
