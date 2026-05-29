'use strict';

const { MessageBus, VALID_TYPES } = require('./message-bus');
const { MessagePersistence } = require('./persistence');
const { SocketBusServer } = require('./socket-server');
const { SocketBusClient } = require('./socket-client');

/**
 * Create a fully configured MessageBus instance.
 * @param {object} [options]
 * @param {import('better-sqlite3').Database} [options.db] - SQLite connection for persistence
 * @param {number} [options.defaultTimeout=5000]
 * @param {number} [options.maxQueueSize=1000]
 * @returns {MessageBus}
 */
function createMessageBus(options = {}) {
  let persistence = null;
  if (options.db) {
    persistence = new MessagePersistence(options.db);
  }
  return new MessageBus({
    defaultTimeout: options.defaultTimeout,
    maxQueueSize: options.maxQueueSize,
    persistence,
  });
}

module.exports = {
  createMessageBus,
  MessageBus,
  MessagePersistence,
  SocketBusServer,
  SocketBusClient,
  VALID_TYPES,
};
