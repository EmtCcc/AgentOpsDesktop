'use strict';

const { IpcRouter } = require('./router');
const agentController = require('./controllers/agent.controller');
const goalController = require('./controllers/goal.controller');
const taskController = require('./controllers/task.controller');
const logController = require('./controllers/log.controller');
const statsController = require('./controllers/stats.controller');
const monitor = require('../monitor');

/**
 * Bootstrap all IPC routes.
 *
 * Route map:
 *   monitor:health      — System health check
 *
 *   agents:list         — List all agent sessions
 *   agents:spawn        — Spawn a CLI agent process
 *   agents:status       — Get agent session status
 *   agents:kill         — Kill an agent session
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
 */
function bootstrapRoutes(mainWindow) {
  logController.setMainWindow(mainWindow);

  const router = new IpcRouter();

  // ── Monitoring ──
  router.register('monitor:health', () => monitor.getHealth());

  // ── Agents: config CRUD ──
  router.register('agents:list', agentController.list);
  router.register('agents:create', agentController.create, { schema: agentController.schemas.create });
  router.register('agents:update', agentController.update, { schema: agentController.schemas.update });
  router.register('agents:delete', agentController.delete);
  router.register('agents:health-check', agentController.healthCheck);

  // ── Agents: live process management ──
  router.register('agents:spawn', agentController.spawn, { schema: agentController.schemas.spawn });
  router.register('agents:status', agentController.status, { schema: agentController.schemas.status });
  router.register('agents:kill', agentController.kill, { schema: agentController.schemas.kill });

  // ── Goals ──
  router.register('goals:list', goalController.list);
  router.register('goals:create', goalController.create, { schema: goalController.schemas.create });
  router.register('goals:update', goalController.update, { schema: goalController.schemas.update });
  router.register('goals:delete', goalController.delete);

  // ── Tasks ──
  router.register('tasks:list', taskController.list);
  router.register('tasks:create', taskController.create, { schema: taskController.schemas.create });
  router.register('tasks:update', taskController.update, { schema: taskController.schemas.update });
  router.register('tasks:delete', taskController.delete);

  // ── Logs ──
  router.register('logs:list', logController.list, { schema: logController.schemas.list });
  router.register('logs:append', logController.append, { schema: logController.schemas.append });

  // ── Stats ──
  router.register('stats:summary', statsController.summary);

  router.bootstrap();
  return router;
}

module.exports = { bootstrapRoutes };
