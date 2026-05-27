'use strict';

const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const { createHarness } = require('./helpers/test-harness');

describe('Auth integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    const { vi } = require('vitest');
    vi.restoreAllMocks();
  });

  describe('auth:login', () => {
    it('returns a token and expiry', async () => {
      const result = await harness.call('auth:login');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('creates a new session each call', async () => {
      const s1 = await harness.call('auth:login');
      const s2 = await harness.call('auth:login');
      expect(s1.token).not.toBe(s2.token);
    });
  });

  describe('auth:status', () => {
    it('returns isValid: false when no session', async () => {
      const result = await harness.call('auth:status');
      expect(result.isValid).toBe(false);
    });

    it('returns session info after login', async () => {
      await harness.call('auth:login');
      const status = await harness.call('auth:status');
      expect(status.isValid).toBe(true);
      expect(status.createdAt).toBeDefined();
      expect(status.expiresAt).toBeDefined();
    });
  });

  describe('auth:logout', () => {
    it('destroys session', async () => {
      const { token } = await harness.call('auth:login');
      const result = await harness.call('auth:logout', { _auth: { token } });
      expect(result.ok).toBe(true);

      const status = await harness.call('auth:status');
      expect(status.isValid).toBe(false);
    });

    it('rejects unauthenticated requests', async () => {
      await expect(harness.call('auth:logout')).rejects.toThrow();
    });
  });

  describe('auth:rotate', () => {
    it('returns a new token and invalidates the old', async () => {
      const { token: oldToken } = await harness.call('auth:login');
      const result = await harness.call('auth:rotate', { _auth: { token: oldToken } });

      expect(result.token).toBeDefined();
      expect(result.token).not.toBe(oldToken);
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      // Old token should be invalid
      const { validate } = harness.tokenManager;
      expect(validate(oldToken)).toBe(false);
      expect(validate(result.token)).toBe(true);
    });

    it('rejects unauthenticated requests', async () => {
      await expect(harness.call('auth:rotate')).rejects.toThrow();
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
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
