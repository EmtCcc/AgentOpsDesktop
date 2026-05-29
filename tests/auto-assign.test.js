import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrations } from '../src/main/db/schema.js';
import { TaskRepository } from '../src/main/repositories/task.repository.js';
import { AgentRepository } from '../src/main/repositories/agent.repository.js';
import { autoAssign, autoAssignPaperclipIssues, PAPERCLIP_ROLE_MAP } from '../src/main/auto-assign.js';

/**
 * Create an in-memory SQLite DB with all migrations applied.
 */
function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const migration of migrations) {
    db.exec(migration.up);
  }
  return db;
}

describe('autoAssign', () => {
  let db, taskRepo, agentRepo;

  beforeEach(() => {
    db = createTestDb();
    taskRepo = new TaskRepository(db);
    agentRepo = new AgentRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  function createGoal(title = 'Test Goal') {
    const { randomUUID } = require('crypto');
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO goals (id, title, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)`)
      .run(id, title, now, now);
    return id;
  }

  function createAgent(name, opts = {}) {
    return agentRepo.create({
      name,
      execPath: '/usr/bin/echo',
      cwd: '/tmp',
      type: 'custom',
      status: opts.status || 'idle',
      ownerRole: opts.ownerRole || null,
    });
  }

  it('assigns a pending task to an idle agent', () => {
    const goalId = createGoal();
    const agent = createAgent('Worker-1');
    const task = taskRepo.create({ title: 'Do something', goalId });

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].taskId).toBe(task.id);
    expect(result.assigned[0].agentId).toBe(agent.id);
    expect(result.skipped).toHaveLength(0);

    const updated = taskRepo.getById(task.id);
    expect(updated.agentId).toBe(agent.id);
    expect(updated.status).toBe('assigned');
  });

  it('skips tasks with unmet dependencies', () => {
    const goalId = createGoal();
    const worker = createAgent('Worker');
    // Create dependency and mark it as assigned (not done) — simulating a prior auto-assign run
    const dep = taskRepo.create({ title: 'Dependency', goalId });
    taskRepo.update(dep.id, { status: 'assigned', agentId: worker.id });
    const task = taskRepo.create({ title: 'Blocked task', goalId, dependsOn: [dep.id] });

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].taskId).toBe(task.id);
    expect(result.skipped[0].reason).toBe('unmet dependencies');
  });

  it('assigns task whose dependencies are all done', () => {
    const goalId = createGoal();
    createAgent('Worker');
    const dep = taskRepo.create({ title: 'Dependency', goalId });
    taskRepo.update(dep.id, { status: 'done' });
    const task = taskRepo.create({ title: 'Ready task', goalId, dependsOn: [dep.id] });

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].taskId).toBe(task.id);
  });

  it('skips tasks when no agents are available', () => {
    const goalId = createGoal();
    taskRepo.create({ title: 'Orphan task', goalId });

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe('no available agents');
  });

  it('picks agent with lowest workload', () => {
    const goalId = createGoal();
    const agent1 = createAgent('Busy');
    const agent2 = createAgent('Free');

    // Give agent1 existing active tasks
    for (let i = 0; i < 3; i++) {
      taskRepo.create({ title: `Existing-${i}`, goalId, agentId: agent1.id, status: 'running' });
    }

    taskRepo.create({ title: 'New task', goalId });

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].agentId).toBe(agent2.id);
  });

  it('respects ownerRole matching', () => {
    const goalId = createGoal();
    const agent = createAgent('AdminBot', { ownerRole: 'admin' });
    const task = taskRepo.create({ title: 'Admin task', goalId, ownerRole: 'admin' });

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].agentId).toBe(agent.id);
  });

  it('falls back to non-role-matched agents when no role match exists', () => {
    const goalId = createGoal();
    const agent = createAgent('GeneralWorker');
    const task = taskRepo.create({ title: 'Admin task', goalId, ownerRole: 'admin' });

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].agentId).toBe(agent.id);
  });

  it('respects limit parameter', () => {
    const goalId = createGoal();
    createAgent('Worker');
    taskRepo.create({ title: 'Task-1', goalId });
    taskRepo.create({ title: 'Task-2', goalId });

    const result = autoAssign(taskRepo, agentRepo, { limit: 1 });

    expect(result.assigned).toHaveLength(1);
  });

  it('returns empty when no pending tasks exist', () => {
    createAgent('Worker');

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('balances across multiple agents round-robin style', () => {
    const goalId = createGoal();
    const a1 = createAgent('A1');
    const a2 = createAgent('A2');

    taskRepo.create({ title: 'T1', goalId });
    taskRepo.create({ title: 'T2', goalId });
    taskRepo.create({ title: 'T3', goalId });
    taskRepo.create({ title: 'T4', goalId });

    const result = autoAssign(taskRepo, agentRepo);

    expect(result.assigned).toHaveLength(4);
    // First two should go to different agents (both at workload 0)
    const agentIds = result.assigned.map((a) => a.agentId);
    const uniqueAgents = new Set(agentIds);
    expect(uniqueAgents.size).toBe(2);
  });
});

// ── Paperclip auto-assign tests ──

/**
 * Mock PaperclipClient for testing.
 */
function createMockPaperclip(issues = []) {
  const assigned = [];
  return {
    issues: [...issues],
    assigned,
    async getUnassignedIssues() {
      return this.issues.filter((i) => {
        const s = (i.status || '').toLowerCase();
        return (s === 'todo' || s === 'open' || s === 'pending') && !i.assignee;
      });
    },
    async assignIssue(issueId, agentId, meta) {
      const issue = this.issues.find((i) => (i.issueId || i.id) === issueId);
      if (issue) {
        issue.assignee = agentId;
        issue.status = 'in_progress';
        issue.assignedAt = new Date().toISOString();
        if (meta.role) issue.ownerRole = meta.role;
      }
      assigned.push({ issueId, agentId, ...meta });
      return issue;
    },
  };
}

describe('autoAssignPaperclipIssues', () => {
  let db, agentRepo;

  beforeEach(() => {
    db = createTestDb();
    agentRepo = new AgentRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  function createAgent(name, opts = {}) {
    return agentRepo.create({
      name,
      execPath: '/usr/bin/echo',
      cwd: '/tmp',
      type: 'custom',
      status: opts.status || 'idle',
      ownerRole: opts.ownerRole || null,
    });
  }

  it('assigns unassigned todo issues to idle agents', async () => {
    const agent = createAgent('Worker');
    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-100', title: 'Fix bug', status: 'todo' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].issueId).toBe('CMPAAA-100');
    expect(result.assigned[0].agentId).toBe(agent.id);
    expect(result.skipped).toHaveLength(0);
    expect(paperclip.issues[0].assignee).toBe(agent.id);
    expect(paperclip.issues[0].status).toBe('in_progress');
  });

  it('skips issues when no agents are available', async () => {
    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-101', title: 'Orphan issue', status: 'todo' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo);

    expect(result.assigned).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe('no available agents');
  });

  it('maps Paperclip roles to agent ownerRole', async () => {
    const agent = createAgent('EngineerBot', { ownerRole: 'engineer' });
    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-102', title: 'Implement feature', status: 'todo', ownerRole: 'engineer' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].agentId).toBe(agent.id);
    expect(result.assigned[0].role).toBe('engineer');
  });

  it('falls back to any idle agent when no role match', async () => {
    const agent = createAgent('GeneralWorker');
    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-103', title: 'Design task', status: 'todo', ownerRole: 'ui-designer' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].agentId).toBe(agent.id);
  });

  it('picks agent with lowest workload', async () => {
    const busy = createAgent('Busy', { ownerRole: 'engineer' });
    const free = createAgent('Free', { ownerRole: 'engineer' });

    // Give busy agent existing tasks
    const goalId = createGoal(db);
    for (let i = 0; i < 3; i++) {
      const { randomUUID } = require('crypto');
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO tasks (id, goal_id, agent_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'running', ?, ?)`)
        .run(randomUUID(), goalId, busy.id, `Existing-${i}`, now, now);
    }

    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-104', title: 'New issue', status: 'todo', ownerRole: 'engineer' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo);

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].agentId).toBe(free.id);
  });

  it('respects limit parameter', async () => {
    createAgent('Worker');
    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-105', title: 'Issue 1', status: 'todo' },
      { issueId: 'CMPAAA-106', title: 'Issue 2', status: 'todo' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo, { limit: 1 });

    expect(result.assigned).toHaveLength(1);
  });

  it('handles open status issues', async () => {
    const agent = createAgent('Worker');
    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-107', title: 'Open issue', status: 'open' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo);

    expect(result.assigned).toHaveLength(1);
  });

  it('skips already assigned issues', async () => {
    createAgent('Worker');
    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-108', title: 'Already assigned', status: 'in_progress', assignee: 'other-agent' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo);

    expect(result.assigned).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('balances across multiple agents', async () => {
    createAgent('A1');
    createAgent('A2');
    const paperclip = createMockPaperclip([
      { issueId: 'CMPAAA-109', title: 'I1', status: 'todo' },
      { issueId: 'CMPAAA-110', title: 'I2', status: 'todo' },
      { issueId: 'CMPAAA-111', title: 'I3', status: 'todo' },
      { issueId: 'CMPAAA-112', title: 'I4', status: 'todo' },
    ]);

    const result = await autoAssignPaperclipIssues(paperclip, agentRepo);

    expect(result.assigned).toHaveLength(4);
    const agentIds = result.assigned.map((a) => a.agentId);
    const uniqueAgents = new Set(agentIds);
    expect(uniqueAgents.size).toBe(2);
  });
});

function createGoal(db) {
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO goals (id, title, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)`)
    .run(id, 'Test Goal', now, now);
  return id;
}

describe('PAPERCLIP_ROLE_MAP', () => {
  it('maps all Paperclip roles to internal roles', () => {
    const roles = [
      'engineer', 'cto', 'qa', 'devops', 'security-engineer', 'code-reviewer',
      'product-owner', 'ui-designer', 'ux-researcher', 'technical-writer',
      'customer-success', 'ceo', 'cfo', 'cmo',
      'audio-designer', 'game-artist', 'game-designer', 'level-designer',
    ];
    for (const role of roles) {
      expect(PAPERCLIP_ROLE_MAP[role]).toBeDefined();
    }
  });

  it('maps engineering roles to engineer', () => {
    expect(PAPERCLIP_ROLE_MAP.engineer).toBe('engineer');
    expect(PAPERCLIP_ROLE_MAP.cto).toBe('engineer');
    expect(PAPERCLIP_ROLE_MAP.qa).toBe('engineer');
    expect(PAPERCLIP_ROLE_MAP.devops).toBe('engineer');
  });

  it('maps design roles correctly', () => {
    expect(PAPERCLIP_ROLE_MAP['ui-designer']).toBe('design');
    expect(PAPERCLIP_ROLE_MAP['ux-researcher']).toBe('design');
  });

  it('maps leadership roles to admin', () => {
    expect(PAPERCLIP_ROLE_MAP.ceo).toBe('admin');
    expect(PAPERCLIP_ROLE_MAP.cfo).toBe('admin');
    expect(PAPERCLIP_ROLE_MAP.cmo).toBe('admin');
  });
});
