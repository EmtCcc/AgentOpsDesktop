'use strict';

const { IpcRouter } = require('./router');
const { TokenManager } = require('./middleware/token-manager');
const { createAuthMiddleware } = require('./middleware/auth');
const systemController = require('./controllers/system.controller');
const agentController = require('./controllers/agent.controller');
const taskController = require('./controllers/task.controller');
const governanceController = require('./controllers/governance.controller');

/** Shared token manager instance */
const tokenManager = new TokenManager();

/**
 * Bootstrap all IPC routes.
 *
 * Route map:
 *   ── Public (no auth) ──
 *   system:health       — Health check
 *   system:routes       — List registered routes
 *   auth:login          — Create a session (returns token)
 *   auth:status         — Check session validity
 *
 *   ── Protected (auth required) ──
 *   auth:logout         — Destroy session
 *   auth:rotate         — Rotate session token
 *
 *   agent:spawn         — Spawn a CLI agent
 *   agent:status        — Get agent session status
 *   agent:kill          — Kill an agent session
 *   agent:list          — List active sessions
 *
 *   task:create         — Create a task
 *   task:get            — Get task by ID
 *   task:list           — List tasks (optional filter by goalId)
 *   task:update         — Update task status/assignee/metadata
 *   task:remove         — Delete a task
 *
 *   governance:approve  — Respond to an approval gate
 *   governance:list     — List pending gates
 *   governance:register — Register a new gate
 */
function bootstrapRoutes() {
  // Initialize token manager
  tokenManager.init();

  // Create auth middleware bound to the token manager
  const authMiddleware = createAuthMiddleware(tokenManager);

  const router = new IpcRouter();
  router.setAuthMiddleware(authMiddleware);

  // ── Auth (public) ──
  router.register('auth:login', () => {
    const session = tokenManager.createSession();
    return { token: session.token, expiresAt: session.expiresAt };
  });

  router.register('auth:status', () => {
    const info = tokenManager.getSessionInfo();
    return info || { isValid: false };
  });

  // ── Auth (protected) ──
  router.register('auth:logout', (_event, _payload) => {
    tokenManager.destroySession();
    return { ok: true };
  }, { auth: true });

  router.register('auth:rotate', () => {
    const session = tokenManager.rotateSession();
    return { token: session.token, expiresAt: session.expiresAt };
  }, { auth: true });

  // ── System (public) ──
  router.register('system:health', systemController.healthCheck);
  router.register('system:routes', (event, payload) => systemController.listRoutes(event, payload, router));

  // ── Agent lifecycle (protected) ──
  router.register('agent:spawn', agentController.spawn, { schema: agentController.schemas.spawn, auth: true });
  router.register('agent:status', agentController.status, { schema: agentController.schemas.status, auth: true });
  router.register('agent:kill', agentController.kill, { schema: agentController.schemas.kill, auth: true });
  router.register('agent:list', agentController.list, { auth: true });

  // ── Task management (protected) ──
  router.register('task:create', taskController.create, { schema: taskController.schemas.create, auth: true });
  router.register('task:get', taskController.get, { schema: taskController.schemas.get, auth: true });
  router.register('task:list', taskController.list, { schema: taskController.schemas.list, auth: true });
  router.register('task:update', taskController.update, { schema: taskController.schemas.update, auth: true });
  router.register('task:remove', taskController.remove, { schema: taskController.schemas.remove, auth: true });

  // ── Governance (protected) ──
  router.register('governance:approve', governanceController.approve, { schema: governanceController.schemas.approve, auth: true });
  router.register('governance:list', governanceController.listPending, { auth: true });
  router.register('governance:register', governanceController.register, { schema: governanceController.schemas.register, auth: true });

  router.bootstrap();
  return router;
}

module.exports = { bootstrapRoutes, tokenManager };
