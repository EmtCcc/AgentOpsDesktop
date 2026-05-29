import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrations } from '../src/main/db/schema.js';
import { TaskRepository } from '../src/main/repositories/task.repository.js';
import { AgentRepository } from '../src/main/repositories/agent.repository.js';
import { autoAssign } from '../src/main/auto-assign.js';

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
