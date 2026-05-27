import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { AgentRepository } from '../src/main/repositories/agent.repository.js';
import { GoalRepository } from '../src/main/repositories/goal.repository.js';
import { TaskRepository } from '../src/main/repositories/task.repository.js';
import { TaskLogRepository } from '../src/main/repositories/task-log.repository.js';

describe('SQLite Repositories', () => {
  let db;
  let agentRepo;
  let goalRepo;
  let taskRepo;
  let taskLogRepo;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
      CREATE TABLE agents (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        agent_type      TEXT NOT NULL DEFAULT 'custom',
        status          TEXT NOT NULL DEFAULT 'idle',
        command         TEXT,
        executable_path TEXT,
        working_directory TEXT,
        config_json     TEXT DEFAULT '{}',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE goals (
        id              TEXT PRIMARY KEY,
        title           TEXT NOT NULL,
        description     TEXT,
        status          TEXT NOT NULL DEFAULT 'active',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE tasks (
        id              TEXT PRIMARY KEY,
        goal_id         TEXT REFERENCES goals(id) ON DELETE CASCADE,
        agent_id        TEXT REFERENCES agents(id) ON DELETE SET NULL,
        title           TEXT NOT NULL,
        description     TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        output_summary  TEXT,
        started_at      TEXT,
        completed_at    TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE task_logs (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        stream    TEXT NOT NULL,
        content   TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX idx_tasks_goal ON tasks(goal_id);
      CREATE INDEX idx_tasks_agent ON tasks(agent_id);
      CREATE INDEX idx_task_logs_task ON task_logs(task_id);
    `);

    agentRepo = new AgentRepository(db);
    goalRepo = new GoalRepository(db);
    taskRepo = new TaskRepository(db);
    taskLogRepo = new TaskLogRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('AgentRepository', () => {
    it('creates and retrieves an agent', () => {
      const agent = agentRepo.create({
        name: 'Claude Code',
        type: 'claude',
        execPath: '/usr/local/bin/claude',
        cwd: '/project',
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('Claude Code');
      expect(agent.type).toBe('claude');
      expect(agent.execPath).toBe('/usr/local/bin/claude');

      const retrieved = agentRepo.getById(agent.id);
      expect(retrieved).toEqual(agent);
    });

    it('lists all agents', () => {
      agentRepo.create({ name: 'Agent 1', execPath: '/bin/echo' });
      agentRepo.create({ name: 'Agent 2', execPath: '/bin/ls' });

      const result = agentRepo.list();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('updates an agent', () => {
      const agent = agentRepo.create({ name: 'Test Agent', execPath: '/bin/echo' });
      const updated = agentRepo.update(agent.id, { name: 'Updated Agent', status: 'running' });

      expect(updated.name).toBe('Updated Agent');
      expect(updated.status).toBe('running');
    });

    it('deletes an agent', () => {
      const agent = agentRepo.create({ name: 'Test Agent', execPath: '/bin/echo' });
      const deleted = agentRepo.delete(agent.id);

      expect(deleted).toBe(true);
      expect(agentRepo.getById(agent.id)).toBeNull();
    });

    it('returns null for nonexistent agent', () => {
      expect(agentRepo.getById('nonexistent')).toBeNull();
      expect(agentRepo.update('nonexistent', { name: 'Test' })).toBeNull();
    });
  });

  describe('GoalRepository', () => {
    it('creates and retrieves a goal', () => {
      const goal = goalRepo.create({
        title: 'Build TODO API',
        description: 'Implement a REST API for TODO items',
      });

      expect(goal.id).toBeDefined();
      expect(goal.title).toBe('Build TODO API');
      expect(goal.status).toBe('active');

      const retrieved = goalRepo.getById(goal.id);
      expect(retrieved).toEqual(goal);
    });

    it('updates a goal', () => {
      const goal = goalRepo.create({ title: 'Test Goal' });
      const updated = goalRepo.update(goal.id, { status: 'completed' });

      expect(updated.status).toBe('completed');
    });

    it('deletes a goal', () => {
      const goal = goalRepo.create({ title: 'Test Goal' });
      const deleted = goalRepo.delete(goal.id);

      expect(deleted).toBe(true);
      expect(goalRepo.getById(goal.id)).toBeNull();
    });
  });

  describe('TaskRepository', () => {
    it('creates a task', () => {
      const goal = goalRepo.create({ title: 'Goal' });
      const task = taskRepo.create({
        goalId: goal.id,
        title: 'Design schema',
        description: 'Create the database schema',
        agentId: 'agent-1',
      });

      expect(task.id).toBeDefined();
      expect(task.goalId).toBe(goal.id);
      expect(task.status).toBe('pending');
    });

    it('lists tasks by goal', () => {
      const goal1 = goalRepo.create({ title: 'Goal 1' });
      const goal2 = goalRepo.create({ title: 'Goal 2' });

      taskRepo.create({ goalId: goal1.id, title: 'Task 1' });
      taskRepo.create({ goalId: goal1.id, title: 'Task 2' });
      taskRepo.create({ goalId: goal2.id, title: 'Task 3' });

      const result = taskRepo.list({ goalId: goal1.id });
      expect(result.items).toHaveLength(2);
    });

    it('sets startedAt when status changes to running', () => {
      const task = taskRepo.create({ title: 'Test' });
      expect(task.startedAt).toBeNull();

      const updated = taskRepo.update(task.id, { status: 'running' });
      expect(updated.startedAt).toBeDefined();
      expect(updated.startedAt).toBeGreaterThan(0);
    });

    it('sets completedAt when status changes to done', () => {
      const task = taskRepo.create({ title: 'Test' });
      const updated = taskRepo.update(task.id, { status: 'done' });

      expect(updated.completedAt).toBeDefined();
    });

    it('deletes a task', () => {
      const task = taskRepo.create({ title: 'Test' });
      const deleted = taskRepo.delete(task.id);

      expect(deleted).toBe(true);
      expect(taskRepo.getById(task.id)).toBeNull();
    });
  });

  describe('TaskLogRepository', () => {
    it('appends and retrieves logs', () => {
      const task = taskRepo.create({ title: 'Test Task' });

      taskLogRepo.append(task.id, 'stdout', 'Hello');
      taskLogRepo.append(task.id, 'stderr', 'Error');
      taskLogRepo.append(task.id, 'stdout', 'World');

      const logs = taskLogRepo.listByTask(task.id);
      expect(logs).toHaveLength(3);
      expect(logs[0].content).toBe('Hello');
      expect(logs[1].content).toBe('Error');
      expect(logs[2].content).toBe('World');
    });

    it('limits log retrieval', () => {
      const task = taskRepo.create({ title: 'Test Task' });

      for (let i = 0; i < 10; i++) {
        taskLogRepo.append(task.id, 'stdout', `Line ${i}`);
      }

      const logs = taskLogRepo.listByTask(task.id, 5);
      expect(logs).toHaveLength(5);
    });

    it('deletes logs by task', () => {
      const task = taskRepo.create({ title: 'Test Task' });

      taskLogRepo.append(task.id, 'stdout', 'Hello');
      taskLogRepo.append(task.id, 'stdout', 'World');

      const deleted = taskLogRepo.deleteByTask(task.id);
      expect(deleted).toBe(2);

      const logs = taskLogRepo.listByTask(task.id);
      expect(logs).toHaveLength(0);
    });
  });

  describe('Cascading deletes', () => {
    it('deletes tasks when goal is deleted', () => {
      const goal = goalRepo.create({ title: 'Goal' });
      taskRepo.create({ goalId: goal.id, title: 'Task 1' });
      taskRepo.create({ goalId: goal.id, title: 'Task 2' });

      goalRepo.delete(goal.id);

      const tasks = taskRepo.list({ goalId: goal.id });
      expect(tasks.items).toHaveLength(0);
    });

    it('deletes task logs when task is deleted', () => {
      const task = taskRepo.create({ title: 'Task' });
      taskLogRepo.append(task.id, 'stdout', 'Hello');
      taskLogRepo.append(task.id, 'stdout', 'World');

      taskRepo.delete(task.id);

      const logs = taskLogRepo.listByTask(task.id);
      expect(logs).toHaveLength(0);
    });
  });
});
