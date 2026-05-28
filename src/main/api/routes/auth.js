'use strict';

const { Hono } = require('hono');

/**
 * Create auth routes bound to a TokenManager instance.
 * @param {import('../../ipc/middleware/token-manager').TokenManager} tokenManager
 * @returns {Hono}
 */
function createAuthRoutes(tokenManager) {
  const auth = new Hono();

  /**
   * POST /auth/login — Create a session.
   */
  auth.post('/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const role = body.role || 'operator';
    const session = tokenManager.createSession({ role });
    return c.json({ ok: true, data: { token: session.token, role: session.role, expiresAt: session.expiresAt } });
  });

  /**
   * POST /auth/logout — Destroy session.
   */
  auth.post('/logout', async (c) => {
    tokenManager.destroySession();
    return c.json({ ok: true, data: { ok: true } });
  });

  /**
   * GET /auth/status — Check session validity.
   */
  auth.get('/status', (c) => {
    const info = tokenManager.getSessionInfo();
    return c.json({ ok: true, data: info || { isValid: false } });
  });

  /**
   * POST /auth/rotate — Rotate session token.
   */
  auth.post('/rotate', (c) => {
    const session = tokenManager.rotateSession();
    return c.json({ ok: true, data: { token: session.token, role: session.role, expiresAt: session.expiresAt } });
  });

  return auth;
}

module.exports = { createAuthRoutes };
