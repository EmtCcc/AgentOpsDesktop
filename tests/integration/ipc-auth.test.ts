import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { handlers, mockIpcMain } = vi.hoisted(() => {
  const _handlers = new Map();
  const _mockIpcMain = {
    handle: vi.fn((channel: string, handler: Function) => { _handlers.set(channel, handler); }),
    removeHandler: vi.fn(),
  };
  return { handlers: _handlers, mockIpcMain: _mockIpcMain };
});

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (str: string) => Buffer.from(str, 'utf8'),
    decryptString: (buf: Buffer) => buf.toString('utf8'),
  },
  app: {
    getPath: () => '/tmp/agentops-test',
    getVersion: () => '0.1.0',
    getName: () => 'agentops-desktop',
    isReady: () => true,
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    webContents: { send: vi.fn() },
  })),
}));

import { createHarness } from './helpers/test-harness.js';

describe('IPC auth/RBAC pipeline', () => {
  let harness: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    harness = await createHarness({ handlers, mockIpcMain });

    // Register notifications routes with a mock service
    // (bootstrapRoutes only registers these when notificationService is provided)
    mockNotificationService = {
      getConfig: vi.fn().mockReturnValue({ enabled: true }),
      setConfig: vi.fn(),
    };
    const { bootstrapRoutes } = await import('../../src/main/ipc/index.js');
    bootstrapRoutes(harness.mockMainWindow, null, mockIpcMain, {
      notificationService: mockNotificationService,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Scenario 1: Unauthenticated call → auth error ──

  describe('unauthenticated access to mutating handler', () => {
    it('rejects call with no token', async () => {
      await expect(
        harness.call('agents:create', { name: 'test' })
      ).rejects.toThrow(/missing token/i);
    });

    it('rejects call with empty _auth object', async () => {
      await expect(
        harness.call('agents:create', { name: 'test', _auth: {} })
      ).rejects.toThrow(/missing token/i);
    });

    it('rejects call with invalid token', async () => {
      await expect(
        harness.call('agents:create', { name: 'test', _auth: { token: 'bogus' } })
      ).rejects.toThrow(/invalid or expired/i);
    });
  });

  // ── Scenario 2: Authenticated without required permission → RBAC error ──

  describe('authenticated without required permission', () => {
    it('viewer cannot create agents (RBAC denied)', async () => {
      await expect(
        harness.call('agents:create', harness.withAuth({ name: 'test' }, 'viewer'))
      ).rejects.toThrow(/lacks permission/i);
    });

    it('viewer cannot delete agents (RBAC denied)', async () => {
      const created = await harness.call('agents:create', harness.withAuth({ name: 'to-delete' }, 'admin'));
      await expect(
        harness.call('agents:delete', harness.withAuth({ id: created.id }, 'viewer'))
      ).rejects.toThrow(/lacks permission/i);
    });

    it('viewer cannot create goals (RBAC denied)', async () => {
      await expect(
        harness.call('goals:create', harness.withAuth({ title: 'test' }, 'viewer'))
      ).rejects.toThrow(/lacks permission/i);
    });

    it('operator cannot update settings (RBAC denied)', async () => {
      await expect(
        harness.call('notifications:update', harness.withAuth({ config: { enabled: true } }, 'operator'))
      ).rejects.toThrow(/lacks permission/i);
    });
  });

  // ── Scenario 3: Authenticated with correct permission → succeeds ──

  describe('authenticated with correct permission', () => {
    it('operator can create agents', async () => {
      const result = await harness.call('agents:create', harness.withAuth({ name: 'op-agent' }, 'operator'));
      expect(result.id).toMatch(/^agent-/);
      expect(result.name).toBe('op-agent');
    });

    it('admin can create agents', async () => {
      const result = await harness.call('agents:create', harness.withAuth({ name: 'admin-agent' }, 'admin'));
      expect(result.id).toMatch(/^agent-/);
    });

    it('operator can create goals', async () => {
      const result = await harness.call('goals:create', harness.withAuth({ title: 'op-goal' }, 'operator'));
      expect(result.id).toMatch(/^goal-/);
    });

    it('operator can create tasks', async () => {
      const goal = await harness.call('goals:create', harness.withAuth({ title: 'g' }, 'operator'));
      const result = await harness.call('tasks:create', harness.withAuth({ title: 'op-task', goalId: goal.id }, 'operator'));
      expect(result.id).toMatch(/^task-/);
    });

    it('admin can update notifications settings', async () => {
      await harness.call('notifications:update', harness.withAuth({ config: { enabled: true } }, 'admin'));
      expect(mockNotificationService.setConfig).toHaveBeenCalledWith({ enabled: true });
    });

    it('viewer can list agents (read-only)', async () => {
      await harness.call('agents:create', harness.withAuth({ name: 'a1' }, 'admin'));
      const result = await harness.call('agents:list', harness.auth('viewer'));
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Scenario 4: Session token expiry mid-flight → graceful rejection ──

  describe('session token expiry mid-flight', () => {
    it('rejects call after session is destroyed', async () => {
      // Use harness.withAuth to get a payload with valid token embedded
      const authPayload = harness.auth('admin');
      const token = authPayload._auth.token;

      // Token is valid right now
      const result1 = await harness.call('agents:list', { _auth: { token } });
      expect(result1.items).toBeDefined();

      // Simulate session expiry by destroying the session
      harness.tokenManager.destroySession();

      // Same token should now be rejected as expired
      await expect(
        harness.call('agents:list', { _auth: { token } })
      ).rejects.toThrow(/invalid or expired/i);
    });

    it('rejects mutating call after session rotation', async () => {
      const authPayload = harness.auth('admin');
      const oldToken = authPayload._auth.token;

      // Rotate creates a new session, invalidating the old token
      harness.tokenManager.rotateSession();

      await expect(
        harness.call('agents:create', { name: 'test', _auth: { token: oldToken } })
      ).rejects.toThrow(/invalid or expired/i);
    });

    it('new token works after rotation', async () => {
      harness.auth('admin');
      const newSession = harness.tokenManager.rotateSession();

      const result = await harness.call('agents:list', { _auth: { token: newSession.token } });
      expect(result.items).toBeDefined();
    });
  });

  // ── Scenario 5: notifications:update payload validation ──

  describe('notifications:update payload validation', () => {
    it('rejects missing config field', async () => {
      await expect(
        harness.call('notifications:update', harness.withAuth({}, 'admin'))
      ).rejects.toThrow(/config.*required/i);
    });

    it('rejects config with wrong type (string)', async () => {
      await expect(
        harness.call('notifications:update', harness.withAuth({ config: 'not-an-object' }, 'admin'))
      ).rejects.toThrow(/config.*must be of type object/i);
    });

    it('rejects config with wrong type (number)', async () => {
      await expect(
        harness.call('notifications:update', harness.withAuth({ config: 42 }, 'admin'))
      ).rejects.toThrow(/config.*must be of type object/i);
    });

    it('rejects config with wrong type (array)', async () => {
      await expect(
        harness.call('notifications:update', harness.withAuth({ config: [1, 2, 3] }, 'admin'))
      ).rejects.toThrow(/config.*must be of type object/i);
    });

    it('accepts valid config object', async () => {
      await harness.call(
        'notifications:update',
        harness.withAuth({ config: { enabled: true, channel: 'email' } }, 'admin')
      );
      expect(mockNotificationService.setConfig).toHaveBeenCalledWith({ enabled: true, channel: 'email' });
    });
  });
});
