'use strict';

const { IpcRouter } = require('./router');
const systemController = require('./controllers/system.controller');
const agentController = require('./controllers/agent.controller');
const taskController = require('./controllers/task.controller');
const governanceController = require('./controllers/governance.controller');

/**
 * Bootstrap all IPC routes.
 *
 * Route map:
 *   system:health       — Health check
 *   system:routes       — List registered routes
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
  const router = new IpcRouter();

  // System
  router.register('system:health', systemController.healthCheck);
  router.register('system:routes', (event, payload) => systemController.listRoutes(event, payload, router));

  // Agent lifecycle
  router.register('agent:spawn', agentController.spawn, { schema: agentController.schemas.spawn });
  router.register('agent:status', agentController.status, { schema: agentController.schemas.status });
  router.register('agent:kill', agentController.kill, { schema: agentController.schemas.kill });
  router.register('agent:list', agentController.list);

  // Task management
  router.register('task:create', taskController.create, { schema: taskController.schemas.create });
  router.register('task:get', taskController.get, { schema: taskController.schemas.get });
  router.register('task:list', taskController.list, { schema: taskController.schemas.list });
  router.register('task:update', taskController.update, { schema: taskController.schemas.update });
  router.register('task:remove', taskController.remove, { schema: taskController.schemas.remove });

  // Governance
  router.register('governance:approve', governanceController.approve, { schema: governanceController.schemas.approve });
  router.register('governance:list', governanceController.listPending);
  router.register('governance:register', governanceController.register, { schema: governanceController.schemas.register });

  router.bootstrap();
  return router;
}

module.exports = { bootstrapRoutes };
