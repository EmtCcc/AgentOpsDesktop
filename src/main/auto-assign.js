'use strict';

/**
 * Auto-assign service.
 *
 * Finds unassigned pending tasks and assigns them to the best available agent
 * using a role-first, load-balanced strategy:
 *
 *  1. If the task has an ownerRole, prefer idle agents with the same role.
 *  2. Among candidates, pick the one with the fewest active tasks (assigned/running).
 *  3. If no role-matched agent is available, fall back to any idle agent.
 *  4. Tasks with unmet dependencies (depends_on) are skipped.
 *
 * @param {import('./repositories/task.repository').TaskRepository} taskRepo
 * @param {import('./repositories/agent.repository').AgentRepository} agentRepo
 * @param {Object} [opts]
 * @param {number} [opts.limit] - Max tasks to assign in one run (default: all)
 * @returns {{ assigned: Array<{taskId: string, agentId: string}>, skipped: Array<{taskId: string, reason: string}> }}
 */
function autoAssign(taskRepo, agentRepo, opts = {}) {
  const unassigned = taskRepo.listUnassigned('pending');
  const assigned = [];
  const skipped = [];

  // Pre-fetch agent pools
  const allIdleAgents = agentRepo.getIdleAgentsByWorkload();
  const roleCache = new Map(); // role → sorted agents

  for (const task of unassigned) {
    if (opts.limit && assigned.length >= opts.limit) break;

    // Skip tasks with unmet dependencies
    if (task.dependsOn && task.dependsOn.length > 0) {
      const allDone = task.dependsOn.every((depId) => {
        const dep = taskRepo.getById(depId);
        return dep && dep.status === 'done';
      });
      if (!allDone) {
        skipped.push({ taskId: task.id, reason: 'unmet dependencies' });
        continue;
      }
    }

    // Resolve candidate pool
    let candidates;
    if (task.ownerRole) {
      if (!roleCache.has(task.ownerRole)) {
        roleCache.set(task.ownerRole, allIdleAgents.filter((a) => a.ownerRole === task.ownerRole));
      }
      candidates = roleCache.get(task.ownerRole);
    }

    // Fall back to all idle agents if no role match
    if (!candidates || candidates.length === 0) {
      candidates = allIdleAgents;
    }

    if (candidates.length === 0) {
      skipped.push({ taskId: task.id, reason: 'no available agents' });
      continue;
    }

    // Pick agent with lowest workload
    const best = candidates[0];
    taskRepo.update(task.id, { agentId: best.id, status: 'assigned' });

    // Update in-memory workload and re-sort so subsequent picks are correct
    best.workload = (best.workload || 0) + 1;
    candidates.sort((a, b) => a.workload - b.workload);

    assigned.push({ taskId: task.id, agentId: best.id });
  }

  return { assigned, skipped };
}

module.exports = { autoAssign };
