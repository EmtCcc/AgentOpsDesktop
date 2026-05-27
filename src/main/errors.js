'use strict';

/**
 * IPC error types with structured codes.
 * Used by controllers to throw typed errors that the router/monitor can categorize.
 */
class IpcError extends Error {
  constructor(message, code = 'IPC_ERROR', details = null) {
    super(message);
    this.name = 'IpcError';
    this.code = code;
    this.details = details;
  }

  static notFound(resource, id) {
    return new IpcError(`${resource} not found: ${id}`, 'NOT_FOUND', { resource, id });
  }

  static validation(message, field) {
    return new IpcError(message, 'VALIDATION_ERROR', { field });
  }

  static conflict(message) {
    return new IpcError(message, 'CONFLICT');
  }
}

module.exports = { IpcError };
