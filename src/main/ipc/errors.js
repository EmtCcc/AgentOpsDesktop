'use strict';

/**
 * Structured IPC error with machine-readable codes.
 * Maps to HTTP-like semantics for renderer consumption.
 */
class IpcError extends Error {
  /**
   * @param {string} code - Machine-readable error code (e.g. 'NOT_FOUND')
   * @param {string} message - Human-readable message
   * @param {number} [status] - HTTP-like status code for renderer mapping
   */
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'IpcError';
    this.code = code;
    this.status = status;
  }

  static notFound(entity, id) {
    return new IpcError('NOT_FOUND', `${entity} not found: ${id}`, 404);
  }

  static validation(message, field) {
    const err = new IpcError('VALIDATION_ERROR', message, 400);
    err.field = field;
    return err;
  }

  static conflict(message) {
    return new IpcError('CONFLICT', message, 409);
  }

  static forbidden(message = 'Forbidden') {
    return new IpcError('FORBIDDEN', message, 403);
  }

  static internal(message = 'Internal error') {
    return new IpcError('INTERNAL_ERROR', message, 500);
  }
}

module.exports = { IpcError };
