import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Store } from '../src/main/store.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Store', () => {
  let store;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentops-test-'));
    store = new Store(path.join(tmpDir, 'data.json'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('agents', () => {
    it('adds and retrieves an agent', () => {
      const agent = store.addAgent({
        name: 'Claude Code',
        execPath: '/usr/local/bin/claude',
        args: ['--verbose'],
        cwd: '/project',
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('Claude Code');
      expect(agent.execPath).toBe('/usr/local/bin/claude');
      expect(agent.args).toEqual(['--verbose']);

      const retrieved = store.getAgent(agent.id);
      expect(retrieved).toEqual(agent);
    });

    it('lists all agents', () => {
      store.addAgent({ name: 'Agent 1', execPath: '/bin/echo' });
      store.addAgent({ name: 'Agent 2', execPath: '/bin/ls' });

      expect(store.getAgents()).toHaveLength(2);
    });

    it('removes an agent', () => {
      const agent = store.addAgent({ name: 'Test', execPath: '/bin/echo' });
      expect(store.removeAgent(agent.id)).toBe(true);
      expect(store.getAgent(agent.id)).toBeNull();
    });

    it('returns false when removing nonexistent agent', () => {
      expect(store.removeAgent('nonexistent')).toBe(false);
    });
  });

  describe('goals', () => {
    it('creates and retrieves a goal', () => {
      const goal = store.addGoal({
        title: 'Build TODO API',
        description: 'Implement a REST API for TODO items',
      });

      expect(goal.id).toBeDefined();
      expect(goal.title).toBe('Build TODO API');
      expect(goal.status).toBe('active');
    });

    it('updates a goal', () => {
      const goal = store.addGoal({ title: 'Test Goal' });
      const updated = store.updateGoal(goal.id, { status: 'completed' });

      expect(updated.status).toBe('completed');
      expect(store.getGoal(goal.id).status).toBe('completed');
    });

    it('returns null when updating nonexistent goal', () => {
      expect(store.updateGoal('nonexistent', { status: 'done' })).toBeNull();
    });
  });

  describe('tasks', () => {
    it('creates a task linked to a goal', () => {
      const goal = store.addGoal({ title: 'Goal' });
      const task = store.addTask({
        goalId: goal.id,
        title: 'Design schema',
        description: 'Create the database schema',
        agentId: 'agent-1',
      });

      expect(task.goalId).toBe(goal.id);
      expect(task.status).toBe('pending');
      expect(task.agentId).toBe('agent-1');
    });

    it('filters tasks by goalId', () => {
      const goal1 = store.addGoal({ title: 'Goal 1' });
      const goal2 = store.addGoal({ title: 'Goal 2' });

      store.addTask({ goalId: goal1.id, title: 'Task 1' });
      store.addTask({ goalId: goal1.id, title: 'Task 2' });
      store.addTask({ goalId: goal2.id, title: 'Task 3' });

      expect(store.getTasks(goal1.id)).toHaveLength(2);
      expect(store.getTasks(goal2.id)).toHaveLength(1);
      expect(store.getTasks()).toHaveLength(3);
    });

    it('sets startedAt when status changes to running', () => {
      const task = store.addTask({ title: 'Test' });
      expect(task.startedAt).toBeNull();

      const updated = store.updateTask(task.id, { status: 'running' });
      expect(updated.startedAt).toBeDefined();
      expect(updated.startedAt).toBeGreaterThan(0);
    });

    it('sets completedAt when status changes to done', () => {
      const task = store.addTask({ title: 'Test' });
      const updated = store.updateTask(task.id, { status: 'done' });

      expect(updated.completedAt).toBeDefined();
    });

    it('removes a task', () => {
      const task = store.addTask({ title: 'Test' });
      expect(store.removeTask(task.id)).toBe(true);
      expect(store.getTask(task.id)).toBeNull();
    });
  });

  describe('persistence', () => {
    it('persists data to disk and reloads', () => {
      store.addAgent({ name: 'Persistent Agent', execPath: '/bin/echo' });
      store.addGoal({ title: 'Persistent Goal' });

      // Create a new store from the same file
      const store2 = new Store(path.join(tmpDir, 'data.json'));

      expect(store2.getAgents()).toHaveLength(1);
      expect(store2.getAgents()[0].name).toBe('Persistent Agent');
      expect(store2.getGoals()).toHaveLength(1);
      expect(store2.getGoals()[0].title).toBe('Persistent Goal');
    });

    it('handles missing file gracefully', () => {
      const newStore = new Store(path.join(tmpDir, 'nonexistent', 'data.json'));
      expect(newStore.getAgents()).toEqual([]);
      expect(newStore.getGoals()).toEqual([]);
      expect(newStore.getTasks()).toEqual([]);
    });
  });
});
