'use strict';

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock Electron modules
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

const { ROLES, ROLE_LIST, PERMISSIONS, hasPermission, isValidRole } = require('../src/main/ipc/middleware/rbac');
const { createAuthorizeMiddleware } = require('../src/main/ipc/middleware/authorize');
const { TokenManager } = require('../src/main/ipc/middleware/token-manager');
const { IpcError } = require('../src/main/ipc/errors');

describe('RBAC definitions', () => {
  describe('ROLES', () => {
    it('defines three roles', () => {
      expect(ROLES.ADMIN).toBe('admin');
      expect(ROLES.OPERATOR).toBe('operator');
      expect(ROLES.VIEWER).toBe('viewer');
    });

    it('ROLE_LIST is ordered by privilege', () => {
      expect(ROLE_LIST).toEqual(['admin', 'operator', 'viewer']);
    });
  });

  describe('isValidRole', () => {
    it('returns true for valid roles', () => {
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('operator')).toBe(true);
      expect(isValidRole('viewer')).toBe(true);
    });

    it('returns false for invalid roles', () => {
      expect(isValidRole('superadmin')).toBe(false);
      expect(isValidRole('')).toBe(false);
      expect(isValidRole('ADMIN')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    describe('admin role', () => {
      it('has wildcard permission for everything', () => {
        expect(hasPermission('admin', 'agents:create')).toBe(true);
        expect(hasPermission('admin', 'tasks:delete')).toBe(true);
        expect(hasPermission('admin', 'anything:whatever')).toBe(true);
      });
    });

    describe('operator role', () => {
      it('has full access to agents, goals, tasks, logs, stats', () => {
        expect(hasPermission('operator', 'agents:create')).toBe(true);
        expect(hasPermission('operator', 'agents:update')).toBe(true);
        expect(hasPermission('operator', 'agents:delete')).toBe(true);
        expect(hasPermission('operator', 'goals:create')).toBe(true);
        expect(hasPermission('operator', 'tasks:create')).toBe(true);
        expect(hasPermission('operator', 'logs:list')).toBe(true);
        expect(hasPermission('operator', 'stats:summary')).toBe(true);
      });

      it('has auth:logout and auth:rotate', () => {
        expect(hasPermission('operator', 'auth:logout')).toBe(true);
        expect(hasPermission('operator', 'auth:rotate')).toBe(true);
      });

      it('cannot manage system settings', () => {
        expect(hasPermission('operator', 'settings:update')).toBe(false);
        expect(hasPermission('operator', 'system:config')).toBe(false);
      });
    });

    describe('viewer role', () => {
      it('can read agents', () => {
        expect(hasPermission('viewer', 'agents:list')).toBe(true);
        expect(hasPermission('viewer', 'agents:get')).toBe(true);
        expect(hasPermission('viewer', 'agents:health-check')).toBe(true);
        expect(hasPermission('viewer', 'agents:status')).toBe(true);
      });

      it('can read goals and tasks', () => {
        expect(hasPermission('viewer', 'goals:list')).toBe(true);
        expect(hasPermission('viewer', 'goals:get')).toBe(true);
        expect(hasPermission('viewer', 'tasks:list')).toBe(true);
        expect(hasPermission('viewer', 'tasks:get')).toBe(true);
      });

      it('can read logs and stats', () => {
        expect(hasPermission('viewer', 'logs:list')).toBe(true);
        expect(hasPermission('viewer', 'stats:summary')).toBe(true);
      });

      it('has auth:logout and auth:rotate', () => {
        expect(hasPermission('viewer', 'auth:logout')).toBe(true);
        expect(hasPermission('viewer', 'auth:rotate')).toBe(true);
      });

      it('cannot create, update, or delete resources', () => {
        expect(hasPermission('viewer', 'agents:create')).toBe(false);
        expect(hasPermission('viewer', 'agents:update')).toBe(false);
        expect(hasPermission('viewer', 'agents:delete')).toBe(false);
        expect(hasPermission('viewer', 'goals:create')).toBe(false);
        expect(hasPermission('viewer', 'goals:update')).toBe(false);
        expect(hasPermission('viewer', 'goals:delete')).toBe(false);
        expect(hasPermission('viewer', 'tasks:create')).toBe(false);
        expect(hasPermission('viewer', 'tasks:update')).toBe(false);
        expect(hasPermission('viewer', 'tasks:delete')).toBe(false);
        expect(hasPermission('viewer', 'logs:append')).toBe(false);
      });

      it('cannot spawn or kill agents', () => {
        expect(hasPermission('viewer', 'agents:spawn')).toBe(false);
        expect(hasPermission('viewer', 'agents:kill')).toBe(false);
      });
    });

    it('returns false for unknown role', () => {
      expect(hasPermission('unknown', 'agents:list')).toBe(false);
    });
  });
});

describe('createAuthorizeMiddleware', () => {
  let tm;
  let authorize;

  beforeEach(() => {
    tm = new TokenManager();
    tm.init();
    authorize = createAuthorizeMiddleware(tm);
  });

  it('throws when no session exists', () => {
    expect(() => authorize({}, {}, 'agents:list')).toThrow(IpcError);
    try {
      authorize({}, {}, 'agents:list');
    } catch (err) {
      expect(err.code).toBe('FORBIDDEN');
      expect(err.status).toBe(403);
    }
  });

  it('allows access when role has permission', () => {
    tm.createSession({ role: 'operator' });
    expect(() => authorize({}, {}, 'agents:create')).not.toThrow();
  });

  it('denies access when role lacks permission', () => {
    tm.createSession({ role: 'viewer' });
    expect(() => authorize({}, {}, 'agents:create')).toThrow(IpcError);
    try {
      authorize({}, {}, 'agents:create');
    } catch (err) {
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toContain('viewer');
      expect(err.message).toContain('agents:create');
    }
  });

  it('admin can access everything', () => {
    tm.createSession({ role: 'admin' });
    expect(() => authorize({}, {}, 'agents:create')).not.toThrow();
    expect(() => authorize({}, {}, 'tasks:delete')).not.toThrow();
    expect(() => authorize({}, {}, 'anything:whatever')).not.toThrow();
  });

  it('operator can manage resources but not system', () => {
    tm.createSession({ role: 'operator' });
    expect(() => authorize({}, {}, 'agents:create')).not.toThrow();
    expect(() => authorize({}, {}, 'tasks:delete')).not.toThrow();
    expect(() => authorize({}, {}, 'settings:update')).toThrow(IpcError);
  });

  it('viewer can read but not write', () => {
    tm.createSession({ role: 'viewer' });
    expect(() => authorize({}, {}, 'agents:list')).not.toThrow();
    expect(() => authorize({}, {}, 'agents:get')).not.toThrow();
    expect(() => authorize({}, {}, 'agents:create')).toThrow(IpcError);
    expect(() => authorize({}, {}, 'agents:delete')).toThrow(IpcError);
  });

  it('throws when session is expired', () => {
    tm.createSession({ role: 'admin' });
    // Simulate expiry by destroying session
    tm.destroySession();
    expect(() => authorize({}, {}, 'agents:list')).toThrow(IpcError);
  });
});

describe('TokenManager role support', () => {
  let tm;

  beforeEach(() => {
    tm = new TokenManager();
    tm.init();
  });

  it('createSession accepts role option', () => {
    const session = tm.createSession({ role: 'admin' });
    expect(session.role).toBe('admin');
  });

  it('createSession defaults to operator role', () => {
    const session = tm.createSession();
    expect(session.role).toBe('operator');
  });

  it('getSessionInfo includes role', () => {
    tm.createSession({ role: 'viewer' });
    const info = tm.getSessionInfo();
    expect(info.role).toBe('viewer');
  });

  it('getRole returns the session role', () => {
    tm.createSession({ role: 'admin' });
    expect(tm.getRole()).toBe('admin');
  });

  it('getRole returns null when no session', () => {
    expect(tm.getRole()).toBeNull();
  });

  it('rotateSession preserves role', () => {
    tm.createSession({ role: 'viewer' });
    const rotated = tm.rotateSession();
    expect(rotated.role).toBe('operator'); // rotateSession creates new session with default role
  });
});
