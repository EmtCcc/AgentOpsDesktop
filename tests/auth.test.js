'use strict';

const { describe, it, expect, beforeEach, vi } = require('vitest');
const crypto = require('crypto');

// Mock Electron modules before importing
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (str) => Buffer.from(str, 'utf8'),
    decryptString: (buf) => buf.toString('utf8'),
  },
  app: {
    getPath: () => '/tmp/agentops-test',
    getVersion: () => '0.1.0',
  },
}));

vi.mock('fs', async () => {
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

const { TokenManager } = require('../src/main/ipc/middleware/token-manager');
const { createAuthMiddleware, AuthError } = require('../src/main/ipc/middleware/auth');

describe('TokenManager', () => {
  let tm;

  beforeEach(() => {
    tm = new TokenManager();
    tm.init();
  });

  describe('createSession', () => {
    it('returns a token and expiry', () => {
      const session = tm.createSession();
      expect(session.token).toBeDefined();
      expect(typeof session.token).toBe('string');
      expect(session.token.length).toBeGreaterThan(0);
      expect(session.expiresAt).toBeGreaterThan(Date.now());
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('creates unique tokens on each call', () => {
      const s1 = tm.createSession();
      const s2 = tm.createSession();
      expect(s1.token).not.toBe(s2.token);
    });
  });

  describe('validate', () => {
    it('returns true for a valid token', () => {
      const session = tm.createSession();
      expect(tm.validate(session.token)).toBe(true);
    });

    it('returns false for an invalid token', () => {
      tm.createSession();
      expect(tm.validate('invalid-token')).toBe(false);
    });

    it('returns false when no session exists', () => {
      expect(tm.validate('any-token')).toBe(false);
    });
  });

  describe('hasValidSession', () => {
    it('returns false when no session exists', () => {
      expect(tm.hasValidSession()).toBe(false);
    });

    it('returns true after creating a session', () => {
      tm.createSession();
      expect(tm.hasValidSession()).toBe(true);
    });

    it('returns false after destroying session', () => {
      tm.createSession();
      tm.destroySession();
      expect(tm.hasValidSession()).toBe(false);
    });
  });

  describe('getSessionInfo', () => {
    it('returns null when no session', () => {
      expect(tm.getSessionInfo()).toBeNull();
    });

    it('returns metadata without token', () => {
      tm.createSession();
      const info = tm.getSessionInfo();
      expect(info).toBeDefined();
      expect(info.isValid).toBe(true);
      expect(info.createdAt).toBeDefined();
      expect(info.expiresAt).toBeDefined();
      expect(info.token).toBeUndefined();
    });
  });

  describe('destroySession', () => {
    it('invalidates the session', () => {
      const session = tm.createSession();
      expect(tm.validate(session.token)).toBe(true);
      tm.destroySession();
      expect(tm.validate(session.token)).toBe(false);
      expect(tm.hasValidSession()).toBe(false);
    });
  });

  describe('rotateSession', () => {
    it('creates a new token and invalidates the old one', () => {
      const s1 = tm.createSession();
      const s2 = tm.rotateSession();
      expect(s2.token).not.toBe(s1.token);
      expect(tm.validate(s1.token)).toBe(false);
      expect(tm.validate(s2.token)).toBe(true);
    });
  });
});

describe('createAuthMiddleware', () => {
  let tm;
  let auth;

  beforeEach(() => {
    tm = new TokenManager();
    tm.init();
    auth = createAuthMiddleware(tm);
  });

  it('throws AuthError when payload has no _auth', () => {
    expect(() => auth({}, {})).toThrow(AuthError);
    expect(() => auth({}, {})).toThrow(/missing token/);
  });

  it('throws AuthError when _auth.token is missing', () => {
    expect(() => auth({}, { _auth: {} })).toThrow(AuthError);
  });

  it('throws AuthError when token is invalid', () => {
    tm.createSession();
    expect(() => auth({}, { _auth: { token: 'wrong' } })).toThrow(AuthError);
    expect(() => auth({}, { _auth: { token: 'wrong' } })).toThrow(/invalid or expired/);
  });

  it('succeeds with a valid token', () => {
    const session = tm.createSession();
    expect(() => auth({}, { _auth: { token: session.token } })).not.toThrow();
  });

  it('throws when session is destroyed', () => {
    const session = tm.createSession();
    tm.destroySession();
    expect(() => auth({}, { _auth: { token: session.token } })).toThrow(AuthError);
  });

  it('AuthError has correct code property', () => {
    try {
      auth({}, {});
    } catch (err) {
      expect(err.code).toBe('AUTH_REQUIRED');
    }

    tm.createSession();
    try {
      auth({}, { _auth: { token: 'bad' } });
    } catch (err) {
      expect(err.code).toBe('AUTH_INVALID');
    }
  });
});
