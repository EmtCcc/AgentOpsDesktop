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
 * Paperclip integration:
 *  Also supports auto-assigning Paperclip control-plane issues via
 *  autoAssignPaperclipIssues(), which maps issue roles to agent roles
 *  and uses the same load-balanced selection.
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

// ── Paperclip issue auto-assign ──

/**
 * Role mapping: Paperclip role → AgentOps ownerRole.
 *
 * Paperclip roles from plugin-templates/roles/ are mapped to the internal
 * ownerRole values used by agents.  When no direct match exists, the role
 * name itself is tried as-is (migration v25 supports arbitrary role strings).
 */
const PAPERCLIP_ROLE_MAP = {
  engineer:           'engineer',
  cto:                'engineer',
  qa:                 'engineer',
  devops:             'engineer',
  'security-engineer':'engineer',
  'code-reviewer':    'engineer',
  'product-owner':    'product',
  'ui-designer':      'design',
  'ux-researcher':    'design',
  'technical-writer':  'content',
  'customer-success': 'operations',
  ceo:                'admin',
  cfo:                'admin',
  cmo:                'admin',
  'audio-designer':   'creative',
  'game-artist':      'creative',
  'game-designer':    'creative',
  'level-designer':   'creative',
};

/**
 * Auto-assign Paperclip control-plane issues to the best available agent.
 *
 * Strategy (mirrors internal autoAssign):
 *  1. Fetch unassigned todo/open issues from Paperclip (API or disk fallback).
 *  2. For each issue, resolve the preferred role via PAPERCLIP_ROLE_MAP.
 *  3. Prefer idle agents whose ownerRole matches; fall back to any idle agent.
 *  4. Pick the agent with the fewest active tasks.
 *  5. Assign the issue via PaperclipClient (PATCH or disk write).
 *
 * @param {import('./paperclip-client').PaperclipClient} paperclip
 * @param {import('./repositories/agent.repository').AgentRepository} agentRepo
 * @param {Object} [opts]
 * @param {number} [opts.limit] - Max issues to assign (default: all)
 * @returns {Promise<{ assigned: Array, skipped: Array }>}
 */
async function autoAssignPaperclipIssues(paperclip, agentRepo, opts = {}) {
  const unassigned = await paperclip.getUnassignedIssues();
  const assigned = [];
  const skipped = [];

  // Pre-fetch idle agents sorted by workload
  const allIdleAgents = agentRepo.getIdleAgentsByWorkload();
  const roleCache = new Map();

  for (const issue of unassigned) {
    if (opts.limit && assigned.length >= opts.limit) break;

    const issueId = issue.issueId || issue.id;
    if (!issueId) {
      skipped.push({ issueId: 'unknown', reason: 'missing issue id' });
      continue;
    }

    // Resolve preferred role from issue metadata
    const issueRole = issue.ownerRole || issue.role || issue.labels?.find?.(
      (l) => PAPERCLIP_ROLE_MAP[l] || allIdleAgents.some((a) => a.ownerRole === l)
    ) || null;
    const mappedRole = issueRole ? (PAPERCLIP_ROLE_MAP[issueRole] || issueRole) : null;

    // Resolve candidate pool
    let candidates;
    if (mappedRole) {
      if (!roleCache.has(mappedRole)) {
        roleCache.set(mappedRole, allIdleAgents.filter((a) => a.ownerRole === mappedRole));
      }
      candidates = roleCache.get(mappedRole);
    }

    if (!candidates || candidates.length === 0) {
      candidates = allIdleAgents;
    }

    if (candidates.length === 0) {
      skipped.push({ issueId, reason: 'no available agents' });
      continue;
    }

    const best = candidates[0];

    try {
      await paperclip.assignIssue(issueId, best.id, {
        role: mappedRole,
        reason: `auto-assign: role=${mappedRole || 'any'}, workload=${best.workload}`,
      });

      best.workload = (best.workload || 0) + 1;
      candidates.sort((a, b) => a.workload - b.workload);

      assigned.push({ issueId, agentId: best.id, role: mappedRole });
    } catch (err) {
      skipped.push({ issueId, reason: `assign failed: ${err.message}` });
    }
  }

  return { assigned, skipped };
}

module.exports = { autoAssign, autoAssignPaperclipIssues, PAPERCLIP_ROLE_MAP };
