import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHarness } from './helpers/test-harness.js';

// Mock electron-updater before any source imports
vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

describe('Auth integration', () => {
  let harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('auth:login', () => {
    it('returns a token and expiry', async () => {
      const result = await harness.call('auth:login');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.expiresAt).toBeDefined();
    });

    it('creates session with specified role', async () => {
      const result = await harness.call('auth:login', { role: 'viewer' });
      expect(result.role).toBe('viewer');
    });

    it('defaults to operator role', async () => {
      const result = await harness.call('auth:login');
      expect(result.role).toBe('operator');
    });
  });

  describe('auth:status', () => {
    it('returns isValid false when no session', async () => {
      const result = await harness.call('auth:status');
      expect(result.isValid).toBe(false);
    });

    it('returns session info when logged in', async () => {
      const login = await harness.call('auth:login');
      const result = await harness.call('auth:status');
      expect(result.isValid).toBe(true);
      expect(result.role).toBeDefined();
    });
  });

  describe('auth:logout', () => {
    it('destroys the session', async () => {
      await harness.call('auth:login');
      const result = await harness.call('auth:logout', harness.withAuth({}));
      expect(result.ok).toBe(true);

      const status = await harness.call('auth:status');
      expect(status.isValid).toBe(false);
    });
  });

  describe('protected route auth enforcement', () => {
    it('rejects calls without auth token', async () => {
      await expect(harness.call('agents:list')).rejects.toThrow(/missing token/i);
    });

    it('rejects calls with invalid token', async () => {
      await expect(harness.call('agents:list', { _auth: { token: 'bad-token' } }))
        .rejects.toThrow(/invalid or expired/i);
    });

    it('allows calls with valid token', async () => {
      const result = await harness.call('agents:list', harness.auth());
      expect(Array.isArray(result.items)).toBe(true);
    });
  });
});
