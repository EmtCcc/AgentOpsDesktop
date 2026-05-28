'use strict';

const { Hono } = require('hono');

const stats = new Hono();

/**
 * GET /stats/summary — Aggregate dashboard stats.
 */
stats.get('/summary', async (c) => {
  const repos = c.get('repos');
  const agents = repos.agents.list ? repos.agents.list({ limit: 1000 }) : { items: [] };
  const tasks = repos.tasks.list ? repos.tasks.list({ limit: 1000 }) : { items: [] };
  const goals = repos.goals.list ? repos.goals.list({ limit: 1000 }) : { items: [] };

  const agentItems = agents.items || agents || [];
  const taskItems = tasks.items || tasks || [];
  const goalItems = goals.items || goals || [];

  return c.json({
    ok: true,
    data: {
      agents: {
        total: agentItems.length,
        running: agentItems.filter((a) => a.status === 'running').length,
        idle: agentItems.filter((a) => a.status === 'idle').length,
        error: agentItems.filter((a) => a.status === 'error').length,
      },
      tasks: {
        total: taskItems.length,
        pending: taskItems.filter((t) => t.status === 'pending').length,
        running: taskItems.filter((t) => t.status === 'running').length,
        done: taskItems.filter((t) => t.status === 'done').length,
        failed: taskItems.filter((t) => t.status === 'failed').length,
      },
      goals: {
        total: goalItems.length,
        active: goalItems.filter((g) => g.status === 'active').length,
        completed: goalItems.filter((g) => g.status === 'completed').length,
      },
    },
  });
});

module.exports = stats;
