'use strict';

import { vi } from 'vitest';
import { createRequire } from 'module';

const cjsRequire = createRequire(import.meta.url);

/**
 * Integration test harness.
 *
 * Captures handlers registered on ipcMain.handle during bootstrapRoutes(),
 * then exposes a `call(channel, payload)` helper that runs the full pipeline:
 *   auth check → payload validation → controller handler
 *
 * The test file MUST provide a hoisted vi.mock('electron') with ipcMain.
 * Example:
 *   const { handlers, mockIpcMain } = vi.hoisted(() => { ... });
 *   vi.mock('electron', () => ({ ipcMain: mockIpcMain, ... }));
 *   const harness = await createHarness({ handlers, mockIpcMain });
 */

async function createHarness({ handlers, mockIpcMain } = {}) {
  if (!handlers) handlers = new Map();
  if (!mockIpcMain) mockIpcMain = { handle: vi.fn((ch, h) => handlers.set(ch, h)), removeHandler: vi.fn() };

  // Clear previous handlers
  handlers.clear();

  // Reset modules so controllers get fresh in-memory stores
  vi.resetModules();

  // Also clear Node's CJS require cache for source modules
  for (const key of Object.keys(cjsRequire.cache)) {
    if (key.includes('/src/main/') || key.includes('\\src\\main\\')) {
      delete cjsRequire.cache[key];
    }
  }

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

  // Mock electron-updater to avoid app.getVersion() at import time
  vi.doMock('electron-updater', () => ({
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: true,
      on: vi.fn(),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
    },
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
  bootstrapRoutes(mockMainWindow, null, mockIpcMain);

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
     * @param {string} [role] - Session role (default: 'operator')
     */
    auth(role) {
      const session = tokenManager.createSession(role ? { role } : undefined);
      return { _auth: { token: session.token } };
    },

    /**
     * Merge auth with additional payload fields.
     * @param {Object} payload
     * @param {string} [role] - Session role (default: 'operator')
     */
    withAuth(payload = {}, role) {
      return { ...this.auth(role), ...payload };
    },
  };
}

export { createHarness };
