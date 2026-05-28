'use strict';

/**
 * Standalone smoke test for auth modules.
 * Does not depend on vitest — uses Node.js assert.
 * Run with: node tests/auth.smoke.js
 */

const assert = require('assert');
const Module = require('module');
const fs = require('fs');
const path = require('path');

// ── Mock Electron ──
const mockPath = path.join(__dirname, '_mock_electron.js');
fs.writeFileSync(mockPath, `
  module.exports = {
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (s) => Buffer.from(s, 'utf8'),
      decryptString: (b) => b.toString('utf8'),
    },
    app: { getPath: () => '/tmp/test-auth-smoke', getVersion: () => '0.0.1' },
  };
`);

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'electron') return mockPath;
  return origResolve.call(this, request, parent, isMain, options);
};

// ── Clean up persisted session from prior runs ──
const authEncPath = path.join('/tmp/test-auth-smoke', 'auth.enc');
try { fs.unlinkSync(authEncPath); } catch {}

// ── Load modules ──
const { TokenManager } = require('../src/main/ipc/middleware/token-manager');
const { createAuthMiddleware, AuthError } = require('../src/main/ipc/middleware/auth');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}: ${err.message}`);
  }
}

// ── TokenManager tests ──
console.log('\nTokenManager:');

const tm = new TokenManager();
tm.init();

test('createSession returns token, expiry, role', () => {
  const s = tm.createSession();
  assert.ok(s.token);
  assert.ok(typeof s.token === 'string');
  assert.ok(s.expiresAt > Date.now());
  assert.strictEqual(s.role, 'operator');
});

test('createSession with custom role', () => {
  const s = tm.createSession({ role: 'admin' });
  assert.strictEqual(s.role, 'admin');
});

test('validate returns true for valid token', () => {
  const s = tm.createSession();
  assert.strictEqual(tm.validate(s.token), true);
});

test('validate returns false for invalid token', () => {
  tm.createSession();
  assert.strictEqual(tm.validate('nope'), false);
});

test('validate returns false when no session', () => {
  const tm2 = new TokenManager();
  tm2.init();
  assert.strictEqual(tm2.validate('any'), false);
});

test('hasValidSession works', () => {
  const tm2 = new TokenManager();
  tm2.init();
  tm2.destroySession(); // ensure clean state
  assert.strictEqual(tm2.hasValidSession(), false);
  tm2.createSession();
  assert.strictEqual(tm2.hasValidSession(), true);
  tm2.destroySession();
  assert.strictEqual(tm2.hasValidSession(), false);
});

test('getSessionInfo returns metadata without token', () => {
  tm.createSession();
  const info = tm.getSessionInfo();
  assert.ok(info);
  assert.strictEqual(info.isValid, true);
  assert.ok(info.createdAt);
  assert.ok(info.expiresAt);
  assert.strictEqual(info.token, undefined);
});

test('getRole returns session role', () => {
  tm.createSession({ role: 'admin' });
  assert.strictEqual(tm.getRole(), 'admin');
});

test('getRole returns null when no session', () => {
  const tm2 = new TokenManager();
  tm2.init();
  tm2.destroySession(); // ensure clean state
  assert.strictEqual(tm2.getRole(), null);
});

test('destroySession invalidates', () => {
  const s = tm.createSession();
  assert.strictEqual(tm.validate(s.token), true);
  tm.destroySession();
  assert.strictEqual(tm.validate(s.token), false);
});

test('rotateSession creates new token, invalidates old', () => {
  const s1 = tm.createSession();
  const s2 = tm.rotateSession();
  assert.notStrictEqual(s1.token, s2.token);
  assert.strictEqual(tm.validate(s1.token), false);
  assert.strictEqual(tm.validate(s2.token), true);
});

// ── Auth middleware tests ──
console.log('\nAuth Middleware:');

const tmAuth = new TokenManager();
tmAuth.init();
const auth = createAuthMiddleware(tmAuth);

test('throws AUTH_REQUIRED when no _auth', () => {
  try {
    auth({}, {});
    assert.fail('should throw');
  } catch (e) {
    assert.ok(e instanceof AuthError);
    assert.strictEqual(e.code, 'AUTH_REQUIRED');
  }
});

test('throws AUTH_REQUIRED when _auth.token missing', () => {
  try {
    auth({}, { _auth: {} });
    assert.fail('should throw');
  } catch (e) {
    assert.ok(e instanceof AuthError);
    assert.strictEqual(e.code, 'AUTH_REQUIRED');
  }
});

test('throws AUTH_INVALID when token is wrong', () => {
  tmAuth.createSession();
  try {
    auth({}, { _auth: { token: 'bad' } });
    assert.fail('should throw');
  } catch (e) {
    assert.ok(e instanceof AuthError);
    assert.strictEqual(e.code, 'AUTH_INVALID');
  }
});

test('succeeds with valid token', () => {
  const s = tmAuth.createSession();
  assert.doesNotThrow(() => auth({}, { _auth: { token: s.token } }));
});

test('throws after session destroyed', () => {
  const s = tmAuth.createSession();
  tmAuth.destroySession();
  try {
    auth({}, { _auth: { token: s.token } });
    assert.fail('should throw');
  } catch (e) {
    assert.ok(e instanceof AuthError);
  }
});

// ── Summary ──
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

// Cleanup
try { fs.unlinkSync(mockPath); } catch {}
try { fs.unlinkSync(path.join('/tmp/test-auth-smoke', 'auth.enc')); } catch {}

process.exit(failed > 0 ? 1 : 0);
