'use strict';

const path = require('path');
const { IpcRouter } = require('./router');
const { IpcError } = require('./errors');
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
const scheduleController = require('./controllers/schedule.controller');
const squadController = require('./controllers/squad.controller');
const costController = require('./controllers/cost.controller');
const adapterController = require('./controllers/adapter.controller');
const adapterRegistryController = require('./controllers/adapter-registry.controller');
const skillController = require('./controllers/skill.controller');
const sharedContextController = require('./controllers/shared-context.controller');
const telemetryController = require('./controllers/telemetry.controller');
const chatController = require('./controllers/chat.controller');
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
function bootstrapRoutes(mainWindow, repos, electronIpcMain, { notificationService, chatEngine } = {}) {
  logController.setMainWindow(mainWindow);

  // Local repo references for inline handlers
  let taskRepo = null;

  // Inject repositories into controllers
  if (repos) {
    agentController.setRepository(repos.agents);
    goalController.setRepository(repos.goals);
    taskController.setRepository(repos.tasks);
    taskController.setAgentRepository(repos.agents);
    taskRepo = repos.tasks;
    logController.setRepository(repos.taskLogs);
    settingsController.setRepository(repos.settings);
    orchestratorController.setRepository(repos.orchestrator);
    scheduleController.setRepository(repos.schedules);
    squadController.setRepository(repos.squads);
    squadController.setAgentRepository(repos.agents);
    costController.setRepository(repos.costs);
    statsController.setCostRepository(repos.costs);
    adapterController.setRepository(repos.adapters);
    skillController.setRepository(repos.skills);
    sharedContextController.setRepository(repos.sharedContext);
    telemetryController.setRepository(repos.telemetry);
    chatController.setRepository(repos.chats);
    chatController.setAgentRepository(repos.agents);
    if (chatEngine) {
      chatController.setEngine(chatEngine);
    }
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
  router.register('agents:sendInput', agentController.sendInput, { schema: agentController.schemas.sendInput, auth: true, permission: 'agents:spawn' });

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
  router.register('tasks:autoAssign', taskController.autoAssign, { schema: taskController.schemas.autoAssign, auth: true, permission: 'tasks:update' });

  // ── Task output / handoff (protected) ──
  router.register('tasks:set-output', async (_event, { id, output }) => {
    if (!taskRepo) throw IpcError.notFound('Task', id);
    const task = taskRepo.getById(id);
    if (!task) throw IpcError.notFound('Task', id);
    return taskRepo.setOutput(id, output);
  }, {
    schema: { id: { type: 'string', required: true }, output: { type: 'object', required: true } },
    auth: true, permission: 'tasks:update',
  });

  router.register('tasks:get-upstream', async (_event, { id }) => {
    if (!taskRepo) throw IpcError.notFound('Task', id);
    const task = taskRepo.getById(id);
    if (!task) throw IpcError.notFound('Task', id);
    return taskRepo.getUpstreamOutputs(id);
  }, {
    schema: { id: { type: 'string', required: true } },
    auth: true, permission: 'tasks:get',
  });

  router.register('tasks:list-handoffs', async (_event, { id }) => {
    if (!taskRepo) throw IpcError.notFound('Task', id);
    const task = taskRepo.getById(id);
    if (!task) throw IpcError.notFound('Task', id);
    return {
      outgoing: taskRepo.listHandoffsBySource(id),
      incoming: taskRepo.listHandoffsByTarget(id),
    };
  }, {
    schema: { id: { type: 'string', required: true } },
    auth: true, permission: 'tasks:get',
  });

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

  // ── Schedules (protected) ──
  router.register('schedules:list', scheduleController.list, { schema: scheduleController.schemas.list, auth: true, permission: 'schedules:list' });
  router.register('schedules:get', scheduleController.get, { schema: scheduleController.schemas.get, auth: true, permission: 'schedules:get' });
  router.register('schedules:create', scheduleController.create, { schema: scheduleController.schemas.create, auth: true, permission: 'schedules:create' });
  router.register('schedules:update', scheduleController.update, { schema: scheduleController.schemas.update, auth: true, permission: 'schedules:update' });
  router.register('schedules:delete', scheduleController.delete, { schema: scheduleController.schemas.delete, auth: true, permission: 'schedules:delete' });
  router.register('schedules:pause', scheduleController.pause, { schema: scheduleController.schemas.pause, auth: true, permission: 'schedules:pause' });
  router.register('schedules:resume', scheduleController.resume, { schema: scheduleController.schemas.resume, auth: true, permission: 'schedules:resume' });
  router.register('schedules:triggerNow', scheduleController.triggerNow, { schema: scheduleController.schemas.triggerNow, auth: true, permission: 'schedules:triggerNow' });
  router.register('schedules:listLogs', scheduleController.listLogs, { schema: scheduleController.schemas.listLogs, auth: true, permission: 'schedules:listLogs' });

  // ── Squads (protected) ──
  router.register('squads:list', squadController.list, { schema: squadController.schemas.list, auth: true, permission: 'squads:list' });
  router.register('squads:get', squadController.get, { schema: squadController.schemas.get, auth: true, permission: 'squads:get' });
  router.register('squads:create', squadController.create, { schema: squadController.schemas.create, auth: true, permission: 'squads:create' });
  router.register('squads:update', squadController.update, { schema: squadController.schemas.update, auth: true, permission: 'squads:update' });
  router.register('squads:delete', squadController.delete, { schema: squadController.schemas.delete, auth: true, permission: 'squads:delete' });
  router.register('squads:addMember', squadController.addMember, { schema: squadController.schemas.addMember, auth: true, permission: 'squads:update' });
  router.register('squads:removeMember', squadController.removeMember, { schema: squadController.schemas.removeMember, auth: true, permission: 'squads:update' });
  router.register('squads:listMembers', squadController.listMembers, { schema: squadController.schemas.listMembers, auth: true, permission: 'squads:get' });
  router.register('squads:batchStart', squadController.batchStart, { schema: squadController.schemas.batchStart, auth: true, permission: 'squads:update' });
  router.register('squads:batchStop', squadController.batchStop, { schema: squadController.schemas.batchStop, auth: true, permission: 'squads:update' });
  router.register('squads:aggregatedStatus', squadController.getAggregatedStatus, { schema: squadController.schemas.getAggregatedStatus, auth: true, permission: 'squads:get' });
  router.register('squads:evaluateTriggerRule', squadController.evaluateTriggerRule, { schema: squadController.schemas.evaluateTriggerRule, auth: true, permission: 'squads:get' });
  router.register('squads:applyTriggerRule', squadController.applyTriggerRule, { schema: squadController.schemas.applyTriggerRule, auth: true, permission: 'squads:update' });

  // ── Cost / Budget (protected) ──
  router.register('cost:listBudgets', costController.listBudgets, { schema: costController.schemas.listBudgets, auth: true, permission: 'cost:listBudgets' });
  router.register('cost:getBudget', costController.getBudget, { schema: costController.schemas.getBudget, auth: true, permission: 'cost:getBudget' });
  router.register('cost:getBudgetByAgent', costController.getBudgetByAgent, { schema: costController.schemas.getBudgetByAgent, auth: true, permission: 'cost:getBudgetByAgent' });
  router.register('cost:createBudget', costController.createBudget, { schema: costController.schemas.createBudget, auth: true, permission: 'cost:createBudget' });
  router.register('cost:updateBudget', costController.updateBudget, { schema: costController.schemas.updateBudget, auth: true, permission: 'cost:updateBudget' });
  router.register('cost:deleteBudget', costController.deleteBudget, { schema: costController.schemas.deleteBudget, auth: true, permission: 'cost:deleteBudget' });
  router.register('cost:logUsage', costController.logUsage, { schema: costController.schemas.logUsage, auth: true, permission: 'cost:logUsage' });
  router.register('cost:listUsage', costController.listUsage, { schema: costController.schemas.listUsage, auth: true, permission: 'cost:listUsage' });
  router.register('cost:getCostReport', costController.getCostReport, { schema: costController.schemas.getCostReport, auth: true, permission: 'cost:getCostReport' });
  router.register('cost:resetBudgets', costController.resetBudgets, { schema: costController.schemas.resetBudgets, auth: true, permission: 'cost:resetBudgets' });
  router.register('cost:getSpendByModel', costController.getSpendByModel, { schema: costController.schemas.getSpendByModel, auth: true, permission: 'cost:getSpendByModel' });
  router.register('cost:getSpendByTask', costController.getSpendByTask, { schema: costController.schemas.getSpendByTask, auth: true, permission: 'cost:getSpendByTask' });
  router.register('cost:getTokensByAgent', costController.getTokensByAgent, { schema: costController.schemas.getTokensByAgent, auth: true, permission: 'cost:getTokensByAgent' });
  router.register('cost:getSpendTrends', costController.getSpendTrends, { schema: costController.schemas.getSpendTrends, auth: true, permission: 'cost:getSpendTrends' });

  // ── Adapters (protected) ──
  router.register('adapters:list', adapterController.list, { schema: adapterController.schemas.list, auth: true, permission: 'adapters:list' });
  router.register('adapters:get', adapterController.get, { schema: adapterController.schemas.get, auth: true, permission: 'adapters:get' });
  router.register('adapters:create', adapterController.create, { schema: adapterController.schemas.create, auth: true, permission: 'adapters:create' });
  router.register('adapters:update', adapterController.update, { schema: adapterController.schemas.update, auth: true, permission: 'adapters:update' });
  router.register('adapters:delete', adapterController.delete, { schema: adapterController.schemas.delete, auth: true, permission: 'adapters:delete' });
  router.register('adapters:load', adapterController.load, { schema: adapterController.schemas.load, auth: true, permission: 'adapters:load' });
  router.register('adapters:unload', adapterController.unload, { schema: adapterController.schemas.unload, auth: true, permission: 'adapters:unload' });
  router.register('adapters:listLoaded', adapterController.listLoaded, { auth: true, permission: 'adapters:list' });
  router.register('adapters:healthCheck', adapterController.healthCheck, { schema: adapterController.schemas.healthCheck, auth: true, permission: 'adapters:healthCheck' });

  // ── Adapter Registry (protected) ──
  router.register('adapterRegistry:search', adapterRegistryController.search, { schema: adapterRegistryController.schemas.search, auth: true, permission: 'adapters:list' });
  router.register('adapterRegistry:listInstalled', adapterRegistryController.listInstalled, { schema: adapterRegistryController.schemas.listInstalled, auth: true, permission: 'adapters:list' });
  router.register('adapterRegistry:getPackage', adapterRegistryController.getPackage, { schema: adapterRegistryController.schemas.getPackage, auth: true, permission: 'adapters:list' });
  router.register('adapterRegistry:install', adapterRegistryController.install, { schema: adapterRegistryController.schemas.install, auth: true, permission: 'adapters:create' });
  router.register('adapterRegistry:installFromFile', adapterRegistryController.installFromFile, { schema: adapterRegistryController.schemas.installFromFile, auth: true, permission: 'adapters:create' });
  router.register('adapterRegistry:uninstall', adapterRegistryController.uninstall, { schema: adapterRegistryController.schemas.uninstall, auth: true, permission: 'adapters:delete' });
  router.register('adapterRegistry:update', adapterRegistryController.update, { schema: adapterRegistryController.schemas.update, auth: true, permission: 'adapters:update' });
  router.register('adapterRegistry:checkUpdates', adapterRegistryController.checkUpdates, { auth: true, permission: 'adapters:list' });
  router.register('adapterRegistry:featured', adapterRegistryController.getFeatured, { schema: adapterRegistryController.schemas.getFeatured, auth: true, permission: 'adapters:list' });
  router.register('adapterRegistry:scanLocal', adapterRegistryController.scanLocal, { auth: true, permission: 'adapters:list' });
  router.register('adapterRegistry:registerLocal', adapterRegistryController.registerLocal, { schema: adapterRegistryController.schemas.registerLocal, auth: true, permission: 'adapters:create' });

  // ── Skills (protected) ──
  router.register('skills:list', skillController.list, { schema: skillController.schemas.list, auth: true, permission: 'skills:list' });
  router.register('skills:get', skillController.get, { schema: skillController.schemas.get, auth: true, permission: 'skills:get' });
  router.register('skills:create', skillController.create, { schema: skillController.schemas.create, auth: true, permission: 'skills:create' });
  router.register('skills:update', skillController.update, { schema: skillController.schemas.update, auth: true, permission: 'skills:update' });
  router.register('skills:delete', skillController.delete, { schema: skillController.schemas.delete, auth: true, permission: 'skills:delete' });
  router.register('skills:listTags', skillController.listTags, { auth: true, permission: 'skills:list' });
  router.register('skills:searchByTags', skillController.searchByTags, { schema: skillController.schemas.searchByTags, auth: true, permission: 'skills:list' });
  router.register('skills:importSkillMd', skillController.importSkillMd, { schema: skillController.schemas.importSkillMd, auth: true, permission: 'skills:create' });
  router.register('skills:exportSkillMd', skillController.exportSkillMd, { schema: skillController.schemas.exportSkillMd, auth: true, permission: 'skills:get' });
  router.register('skills:validateSkillMd', skillController.validateSkillMd, { schema: skillController.schemas.validateSkillMd, auth: true, permission: 'skills:list' });
  router.register('skills:importFromDirectory', skillController.importFromDirectory, { schema: skillController.schemas.importFromDirectory, auth: true, permission: 'skills:create' });

  // ── Shared Context / Blackboard (protected) ──
  router.register('sharedContext:set', sharedContextController.set, { schema: sharedContextController.schemas.set, auth: true, permission: 'orchestrator:create' });
  router.register('sharedContext:get', sharedContextController.get, { schema: sharedContextController.schemas.get, auth: true, permission: 'orchestrator:get' });
  router.register('sharedContext:getMany', sharedContextController.getMany, { schema: sharedContextController.schemas.getMany, auth: true, permission: 'orchestrator:get' });
  router.register('sharedContext:list', sharedContextController.list, { schema: sharedContextController.schemas.list, auth: true, permission: 'orchestrator:get' });
  router.register('sharedContext:delete', sharedContextController.delete, { schema: sharedContextController.schemas.delete, auth: true, permission: 'orchestrator:create' });

  // ── Group Chat (protected) ──
  router.register('chat:list', chatController.list, { schema: chatController.schemas.list, auth: true, permission: 'orchestrator:list' });
  router.register('chat:get', chatController.get, { schema: chatController.schemas.get, auth: true, permission: 'orchestrator:get' });
  router.register('chat:create', chatController.create, { schema: chatController.schemas.create, auth: true, permission: 'orchestrator:create' });
  router.register('chat:update', chatController.update, { schema: chatController.schemas.update, auth: true, permission: 'orchestrator:create' });
  router.register('chat:delete', chatController.delete, { schema: chatController.schemas.delete, auth: true, permission: 'orchestrator:create' });
  router.register('chat:start', chatController.start, { schema: chatController.schemas.start, auth: true, permission: 'orchestrator:create' });
  router.register('chat:pause', chatController.pause, { schema: chatController.schemas.pause, auth: true, permission: 'orchestrator:create' });
  router.register('chat:resume', chatController.resume, { schema: chatController.schemas.resume, auth: true, permission: 'orchestrator:create' });
  router.register('chat:stop', chatController.stop, { schema: chatController.schemas.stop, auth: true, permission: 'orchestrator:create' });
  router.register('chat:sendMessage', chatController.sendMessage, { schema: chatController.schemas.sendMessage, auth: true, permission: 'orchestrator:create' });
  router.register('chat:listMessages', chatController.listMessages, { schema: chatController.schemas.listMessages, auth: true, permission: 'orchestrator:get' });
  router.register('chat:addParticipant', chatController.addParticipant, { schema: chatController.schemas.addParticipant, auth: true, permission: 'orchestrator:create' });
  router.register('chat:removeParticipant', chatController.removeParticipant, { schema: chatController.schemas.removeParticipant, auth: true, permission: 'orchestrator:create' });
  router.register('chat:getState', chatController.getState, { schema: chatController.schemas.getState, auth: true, permission: 'orchestrator:get' });

  // Wire orchestrator events → renderer push
  if (orchestratorController._orchestrator && mainWindow) {
    const orch = orchestratorController._orchestrator;
    const events = ['dag:created', 'dag:started', 'dag:completed', 'dag:failed', 'dag:cancelled', 'dag:paused', 'dag:resumed',
      'task:ready', 'task:dispatched', 'task:running', 'task:completed', 'task:failed', 'task:skipped', 'task:cancelled', 'task:retrying'];
    for (const evt of events) {
      orch.on(evt, (data) => {
        try { mainWindow.webContents.send('orchestrator:event', { type: evt, ...data }); } catch { /* window closed */ }
      });
    }
    orch.on('dag:progress', (data) => {
      try { mainWindow.webContents.send('orchestrator:progress', data); } catch { /* window closed */ }
    });
    orch.on('task:budget-blocked', (data) => {
      try { mainWindow.webContents.send('cost:budget-blocked', data); } catch { /* window closed */ }
    });
    orch.on('squad:leader-reactivated', (data) => {
      try { mainWindow.webContents.send('squad:event', { type: 'leader-reactivated', ...data }); } catch { /* window closed */ }
    });
    orch.on('squad:member-complete', (data) => {
      try { mainWindow.webContents.send('squad:event', { type: 'member-complete', ...data }); } catch { /* window closed */ }
    });
    orch.on('squad:member-spawned', (data) => {
      try { mainWindow.webContents.send('squad:event', { type: 'member-spawned', ...data }); } catch { /* window closed */ }
    });
  }

  // Wire chat engine events → renderer push
  if (chatEngine && mainWindow) {
    const chatEvents = ['message', 'agent-status', 'turn-change', 'session-status', 'stream', 'error'];
    for (const evt of chatEvents) {
      chatEngine.on(evt, (data) => {
        try { mainWindow.webContents.send('chat:event', { type: evt, ...data }); } catch { /* window closed */ }
      });
    }
  }

  // ── Logs (protected) ──
  router.register('logs:list', logController.list, { schema: logController.schemas.list, auth: true, permission: 'logs:list' });
  router.register('logs:append', logController.append, { schema: logController.schemas.append, auth: true, permission: 'logs:append' });

  // ── Stats (protected) ──
  router.register('stats:summary', statsController.summary, { auth: true, permission: 'stats:summary' });

  // ── Settings (protected) ──
  router.register('settings:get', settingsController.get, { schema: settingsController.schemas.get, auth: true, permission: 'settings:get' });
  router.register('settings:update', settingsController.update, { schema: settingsController.schemas.update, auth: true, permission: 'settings:update' });

  // ── Telemetry (protected) ──
  router.register('telemetry:stats', telemetryController.getStats, { schema: telemetryController.schemas.getStats, auth: true, permission: 'settings:get' });
  router.register('telemetry:setEnabled', telemetryController.setEnabled, { schema: telemetryController.schemas.setEnabled, auth: true, permission: 'settings:update' });
  router.register('telemetry:export', telemetryController.exportData, { schema: telemetryController.schemas.exportData, auth: true, permission: 'settings:get' });
  router.register('telemetry:clear', telemetryController.clearData, { schema: telemetryController.schemas.clearData, auth: true, permission: 'settings:update' });

  // ── Notifications (protected) ──
  if (notificationService) {
    router.register('notifications:get', () => notificationService.getConfig(), {
      auth: true, permission: 'settings:get',
    });
    router.register('notifications:update', (_event, { config }) => notificationService.setConfig(config), {
      schema: { config: { type: 'object', required: true } },
      auth: true, permission: 'settings:update',
    });
  }

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

  router.register('update:defer', (_event, { version }) => {
    const updater = require('../updater');
    updater.deferVersion(version);
    return { ok: true };
  }, { schema: { version: { type: 'string', required: true } }, auth: true, permission: 'update:install' });

  router.register('update:clear-defer', () => {
    const updater = require('../updater');
    updater.clearDefer();
    return { ok: true };
  }, { auth: true, permission: 'update:install' });

  router.register('update:info', () => {
    const updater = require('../updater');
    return updater.getUpdateInfo();
  }, { auth: true, permission: 'update:check' });

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
