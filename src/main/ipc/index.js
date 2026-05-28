'use strict';

const path = require('path');
const { IpcRouter } = require('./router');
const { TokenManager } = require('./middleware/token-manager');
const { createAuthMiddleware } = require('./middleware/auth');
const { createAuthorizeMiddleware } = require('./middleware/authorize');
const agentController = require('./controllers/agent.controller');
const goalController = require('./controllers/goal.controller');
const taskController = require('./controllers/task.controller');
const logController = require('./controllers/log.controller');
const statsController = require('./controllers/stats.controller');
const settingsController = require('./controllers/settings.controller');
const orchestratorController = require('./controllers/orchestrator.controller');
const monitor = require('../monitor');
const logger = require('../logger');

/** Shared token manager instance */
const tokenManager = new TokenManager();

/**
 * Bootstrap all IPC routes.
 *
 * Route map:
 *   ── Public (no auth) ──
 *   monitor:health      — System health check
 *   auth:login          — Create a session (returns token)
 *   auth:status         — Check session validity
 *
 *   ── Protected (auth required) ──
 *   auth:logout         — Destroy session
 *   auth:rotate         — Rotate session token
 *
 *   agents:list         — List all agent sessions
 *   agents:spawn        — Spawn a CLI agent process
 *   agents:status       — Get agent session status
 *   agents:kill         — Kill an agent session
 *   agents:create       — Create agent config
 *   agents:update       — Update agent config
 *   agents:delete       — Delete agent config
 *   agents:health-check — Validate agent executable
 *
 *   goals:list          — List all goals
 *   goals:create        — Create a goal
 *   goals:update        — Update goal status/details
 *   goals:delete        — Delete a goal
 *
 *   tasks:list          — List all tasks
 *   tasks:create        — Create a task
 *   tasks:update        — Update task status/assignee
 *   tasks:delete        — Delete a task
 *
 *   logs:list           — List log entries (optional agentId filter)
 *   logs:append         — Append a log entry
 *
 *   stats:summary       — Aggregated dashboard stats
 *
 *   docs:api            — Open API documentation in a new window
 */
function bootstrapRoutes(mainWindow, repos, electronIpcMain) {
  logController.setMainWindow(mainWindow);

  // Inject repositories into controllers
  if (repos) {
    agentController.setRepository(repos.agents);
    goalController.setRepository(repos.goals);
    taskController.setRepository(repos.tasks);
    logController.setRepository(repos.taskLogs);
    settingsController.setRepository(repos.settings);
    orchestratorController.setRepository(repos.orchestrator);
  }

  // Initialize token manager
  tokenManager.init();

  // Auto-create session for local desktop app if none exists
  if (!tokenManager.hasValidSession()) {
    tokenManager.createSession({ role: 'admin' });
    logger.info('ipc.auto-session-created');
  }

  // Create auth middleware bound to the token manager
  const authMiddleware = createAuthMiddleware(tokenManager);
  const authorizeMiddleware = createAuthorizeMiddleware(tokenManager);

  const router = new IpcRouter();
  router.setAuthMiddleware(authMiddleware);
  router.setAuthorizeMiddleware(authorizeMiddleware);
  router.setRoleGetter(() => tokenManager.getRole());

  // ── Auth (public) ──
  router.register('auth:login', (_event, payload) => {
    const role = payload?.role || 'operator';
    const session = tokenManager.createSession({ role });
    return { token: session.token, role: session.role, expiresAt: session.expiresAt };
  }, {
    schema: {
      role: { type: 'string', enum: ['admin', 'operator', 'viewer'] },
    },
  });

  router.register('auth:status', () => {
    const info = tokenManager.getSessionInfo();
    return info || { isValid: false };
  });

  // ── Auth (protected) ──
  router.register('auth:logout', () => {
    tokenManager.destroySession();
    return { ok: true };
  }, { auth: true, permission: 'auth:logout' });

  router.register('auth:rotate', () => {
    const session = tokenManager.rotateSession();
    return { token: session.token, role: session.role, expiresAt: session.expiresAt };
  }, { auth: true, permission: 'auth:rotate' });

  // ── Monitoring (public) ──
  router.register('monitor:health', () => monitor.getHealth());

  // ── Agents: config CRUD (protected) ──
  router.register('agents:list', agentController.list, { schema: agentController.schemas.list, auth: true, permission: 'agents:list' });
  router.register('agents:get', agentController.get, { schema: agentController.schemas.get, auth: true, permission: 'agents:get' });
  router.register('agents:create', agentController.create, { schema: agentController.schemas.create, auth: true, permission: 'agents:create' });
  router.register('agents:update', agentController.update, { schema: agentController.schemas.update, auth: true, permission: 'agents:update' });
  router.register('agents:delete', agentController.delete, { schema: agentController.schemas.delete, auth: true, permission: 'agents:delete' });
  router.register('agents:health-check', agentController.healthCheck, { schema: agentController.schemas.healthCheck, auth: true, permission: 'agents:health-check' });

  // ── Agents: live process management (protected) ──
  router.register('agents:spawn', agentController.spawn, { schema: agentController.schemas.spawn, auth: true, permission: 'agents:spawn' });
  router.register('agents:status', agentController.status, { schema: agentController.schemas.status, auth: true, permission: 'agents:status' });
  router.register('agents:kill', agentController.kill, { schema: agentController.schemas.kill, auth: true, permission: 'agents:kill' });

  // ── Goals (protected) ──
  router.register('goals:list', goalController.list, { schema: goalController.schemas.list, auth: true, permission: 'goals:list' });
  router.register('goals:get', goalController.get, { schema: goalController.schemas.get, auth: true, permission: 'goals:get' });
  router.register('goals:create', goalController.create, { schema: goalController.schemas.create, auth: true, permission: 'goals:create' });
  router.register('goals:update', goalController.update, { schema: goalController.schemas.update, auth: true, permission: 'goals:update' });
  router.register('goals:delete', goalController.delete, { schema: goalController.schemas.delete, auth: true, permission: 'goals:delete' });

  // ── Tasks (protected) ──
  router.register('tasks:list', taskController.list, { schema: taskController.schemas.list, auth: true, permission: 'tasks:list' });
  router.register('tasks:get', taskController.get, { schema: taskController.schemas.get, auth: true, permission: 'tasks:get' });
  router.register('tasks:create', taskController.create, { schema: taskController.schemas.create, auth: true, permission: 'tasks:create' });
  router.register('tasks:update', taskController.update, { schema: taskController.schemas.update, auth: true, permission: 'tasks:update' });
  router.register('tasks:delete', taskController.delete, { schema: taskController.schemas.delete, auth: true, permission: 'tasks:delete' });

  // ── Orchestrator (protected) ──
  router.register('orchestrator:list', orchestratorController.list, { schema: orchestratorController.schemas.list, auth: true, permission: 'orchestrator:list' });
  router.register('orchestrator:get', orchestratorController.get, { schema: orchestratorController.schemas.get, auth: true, permission: 'orchestrator:get' });
  router.register('orchestrator:create', orchestratorController.create, { schema: orchestratorController.schemas.create, auth: true, permission: 'orchestrator:create' });
  router.register('orchestrator:start', orchestratorController.start, { schema: orchestratorController.schemas.start, auth: true, permission: 'orchestrator:start' });
  router.register('orchestrator:pause', orchestratorController.pause, { schema: orchestratorController.schemas.pause, auth: true, permission: 'orchestrator:pause' });
  router.register('orchestrator:resume', orchestratorController.resume, { schema: orchestratorController.schemas.resume, auth: true, permission: 'orchestrator:resume' });
  router.register('orchestrator:cancel', orchestratorController.cancel, { schema: orchestratorController.schemas.cancel, auth: true, permission: 'orchestrator:cancel' });
  router.register('orchestrator:progress', orchestratorController.getProgress, { schema: orchestratorController.schemas.getProgress, auth: true, permission: 'orchestrator:progress' });
  router.register('orchestrator:task:get', orchestratorController.getTask, { schema: orchestratorController.schemas.getTask, auth: true, permission: 'orchestrator:get' });
  router.register('orchestrator:task:complete', orchestratorController.completeManualTask, { schema: orchestratorController.schemas.completeManualTask, auth: true, permission: 'orchestrator:create' });

  // Wire orchestrator events → renderer push
  if (orchestratorController._orchestrator && mainWindow) {
    const orch = orchestratorController._orchestrator;
    const events = ['dag:created', 'dag:started', 'dag:completed', 'dag:failed', 'dag:cancelled', 'dag:paused', 'dag:resumed',
      'task:ready', 'task:dispatched', 'task:running', 'task:completed', 'task:failed', 'task:skipped', 'task:cancelled', 'task:retrying'];
    for (const evt of events) {
      orch.on(evt, (data) => {
        try { mainWindow.webContents.send('orchestrator:event', { type: evt, ...data }); } catch {}
      });
    }
    orch.on('dag:progress', (data) => {
      try { mainWindow.webContents.send('orchestrator:progress', data); } catch {}
    });
  }

  // ── Logs (protected) ──
  router.register('logs:list', logController.list, { schema: logController.schemas.list, auth: true, permission: 'logs:list' });
  router.register('logs:append', logController.append, { schema: logController.schemas.append, auth: true, permission: 'logs:append' });

  // ── Stats (protected) ──
  router.register('stats:summary', statsController.summary, { auth: true, permission: 'stats:summary' });

  // ── Settings (protected) ──
  router.register('settings:get', settingsController.get, { schema: settingsController.schemas.get, auth: true, permission: 'settings:get' });
  router.register('settings:update', settingsController.update, { schema: settingsController.schemas.update, auth: true, permission: 'settings:update' });

  // ── Updates (protected) ──
  router.register('update:check', async () => {
    const updater = require('../updater');
    await updater.checkForUpdates();
    return { ok: true };
  }, { auth: true, permission: 'update:check' });

  router.register('update:download', async () => {
    const updater = require('../updater');
    await updater.downloadUpdate();
    return { ok: true };
  }, { auth: true, permission: 'update:download' });

  router.register('update:install', () => {
    const updater = require('../updater');
    updater.quitAndInstall();
    return { ok: true };
  }, { auth: true, permission: 'update:install' });

  // ── Docs (public) ──
  router.register('docs:api', () => {
    const { BrowserWindow } = require('electron');
    const docsPath = path.resolve(__dirname, '..', '..', '..', 'docs', 'api-docs.html');
    const docsWindow = new BrowserWindow({
      width: 1100,
      height: 800,
      title: 'AgentOps API Docs',
      backgroundColor: '#0d1117',
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    docsWindow.loadFile(docsPath);
    return { ok: true };
  });

  router.bootstrap(electronIpcMain);
  return router;
}

module.exports = { bootstrapRoutes, tokenManager };
