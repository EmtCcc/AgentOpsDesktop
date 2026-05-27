'use strict';

import { vi } from 'vitest';

/**
 * Integration test harness.
 *
 * Captures handlers registered on ipcMain.handle during bootstrapRoutes(),
 * then exposes a `call(channel, payload)` helper that runs the full pipeline:
 *   auth check → payload validation → controller handler
 *
 * Usage:
 *   const harness = createHarness();
 *   const result = await harness.call('agents:list', { _auth: { token } });
 */

// Module-level mocks that survive across test files
const handlers = new Map();
let mockIpcMainHandle = null;

async function createHarness() {
  // Clear previous handlers
  handlers.clear();

  // Reset modules so controllers get fresh in-memory stores
  vi.resetModules();

  // Mock electron
  vi.doMock('electron', () => {
    mockIpcMainHandle = vi.fn((channel, handler) => {
      handlers.set(channel, handler);
    });
    return {
      ipcMain: {
        handle: mockIpcMainHandle,
        removeHandler: vi.fn(),
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (str) => Buffer.from(str, 'utf8'),
        decryptString: (buf) => buf.toString('utf8'),
      },
      app: {
        getPath: () => '/tmp/agentops-test',
        getVersion: () => '0.1.0',
        getName: () => 'agentops-desktop',
        isReady: () => true,
        on: vi.fn(),
        whenReady: () => Promise.resolve(),
      },
    };
  });

  // Mock fs for token persistence
  vi.doMock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
      ...actual,
      existsSync: () => false,
      readFileSync: actual.readFileSync,
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      mkdirSync: vi.fn(),
      createWriteStream: () => ({ write: vi.fn() }),
    };
  });

  // Mock updater to avoid electron-updater loading at import time
  vi.doMock('../../../src/main/updater', () => ({
    init: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  }));

  // Mock logger to silence output
  vi.doMock('../../../src/main/logger', () => ({
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
    },
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  }));

  // Import bootstrapRoutes after mocks are in place
  const { bootstrapRoutes } = await import('../../../src/main/ipc/index.js');

  // Bootstrap routes (registers handlers on mocked ipcMain)
  const mockMainWindow = {
    webContents: { send: vi.fn() },
  };
  bootstrapRoutes(mockMainWindow);

  // Get the token manager for creating test sessions
  const { tokenManager } = await import('../../../src/main/ipc/index.js');

  return {
    handlers,
    tokenManager,
    mockMainWindow,

    /**
     * Call a registered IPC handler as if Electron invoked it.
     * @param {string} channel
     * @param {Object} [payload]
     * @returns {Promise<any>}
     */
    async call(channel, payload = {}) {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`No handler registered for channel: ${channel}`);
      const mockEvent = {};
      return handler(mockEvent, payload);
    },

    /**
     * Get a valid auth token payload.
     */
    auth() {
      const session = tokenManager.createSession();
      return { _auth: { token: session.token } };
    },

    /**
     * Merge auth with additional payload fields.
     */
    withAuth(payload = {}) {
      return { ...this.auth(), ...payload };
    },
  };
}

export { createHarness };
