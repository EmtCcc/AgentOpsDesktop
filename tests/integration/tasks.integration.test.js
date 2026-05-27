'use strict';

const { describe, it, expect, beforeEach, afterEach, vi } = require('vitest');
const { createHarness } = require('./helpers/test-harness');

describe('Tasks integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tasks:create', () => {
    it('creates a task with required fields', async () => {
      const result = await harness.call('tasks:create', harness.withAuth({
        title: 'Fix the bug',
      }));

      expect(result.id).toMatch(/^task-/);
      expect(result.title).toBe('Fix the bug');
      expect(result.status).toBe('pending');
      expect(result.goalId).toBeNull();
      expect(result.assigneeAgentId).toBeNull();
      expect(result.createdAt).toBeDefined();
    });

    it('creates a task with all optional fields', async () => {
      // Create parent goal first
      const goal = await harness.call('goals:create', harness.withAuth({ title: 'Goal' }));
      const agent = await harness.call('agents:create', harness.withAuth({ name: 'Worker' }));

      const result = await harness.call('tasks:create', harness.withAuth({
        title: 'Linked task',
        description: 'Details',
        goalId: goal.id,
        assigneeAgentId: agent.id,
      }));

      expect(result.description).toBe('Details');
      expect(result.goalId).toBe(goal.id);
      expect(result.assigneeAgentId).toBe(agent.id);
    });

    it('links task to parent goal', async () => {
      const goal = await harness.call('goals:create', harness.withAuth({ title: 'Parent' }));
      await harness.call('tasks:create', harness.withAuth({
        title: 'Child task',
        goalId: goal.id,
      }));

      const updatedGoal = await harness.call('goals:get', harness.withAuth({ id: goal.id }));
      expect(updatedGoal.taskIds.length).toBe(1);
      expect(updatedGoal.taskIds[0]).toMatch(/^task-/);
    });

    it('rejects missing title', async () => {
      await expect(
        harness.call('tasks:create', harness.withAuth({}))
      ).rejects.toThrow(/title.*required/i);
    });

    it('rejects empty title', async () => {
      await expect(
        harness.call('tasks:create', harness.withAuth({ title: '' }))
      ).rejects.toThrow();
    });
  });

  describe('tasks:list', () => {
    it('returns empty list initially', async () => {
      const result = await harness.call('tasks:list', harness.auth());
      expect(result).toEqual([]);
    });

    it('returns created tasks', async () => {
      await harness.call('tasks:create', harness.withAuth({ title: 'T1' }));
      await harness.call('tasks:create', harness.withAuth({ title: 'T2' }));

      const result = await harness.call('tasks:list', harness.auth());
      expect(result.length).toBe(2);
    });

    it('supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await harness.call('tasks:create', harness.withAuth({ title: `Task-${i}` }));
      }

      const page = await harness.call('tasks:list', harness.withAuth({ limit: 2, offset: 0 }));
      expect(page.length).toBe(2);
    });

    it('filters by status', async () => {
      const t1 = await harness.call('tasks:create', harness.withAuth({ title: 'T1' }));
      await harness.call('tasks:create', harness.withAuth({ title: 'T2' }));
      // Update one to 'done'
      await harness.call('tasks:update', harness.withAuth({
        id: t1.id,
        updates: { status: 'done' },
      }));

      const pending = await harness.call('tasks:list', harness.withAuth({ status: 'pending' }));
      expect(pending.length).toBe(1);
      expect(pending[0].title).toBe('T2');

      const done = await harness.call('tasks:list', harness.withAuth({ status: 'done' }));
      expect(done.length).toBe(1);
      expect(done[0].title).toBe('T1');
    });

    it('filters by goalId', async () => {
      const goal = await harness.call('goals:create', harness.withAuth({ title: 'Goal' }));
      await harness.call('tasks:create', harness.withAuth({ title: 'Linked', goalId: goal.id }));
      await harness.call('tasks:create', harness.withAuth({ title: 'Unlinked' }));

      const linked = await harness.call('tasks:list', harness.withAuth({ goalId: goal.id }));
      expect(linked.length).toBe(1);
      expect(linked[0].title).toBe('Linked');
    });
  });

  describe('tasks:get', () => {
    it('returns a specific task', async () => {
      const created = await harness.call('tasks:create', harness.withAuth({ title: 'Find me' }));
      const result = await harness.call('tasks:get', harness.withAuth({ id: created.id }));

      expect(result.id).toBe(created.id);
      expect(result.title).toBe('Find me');
    });

    it('throws NOT_FOUND for missing task', async () => {
      await expect(
        harness.call('tasks:get', harness.withAuth({ id: 'task-999' }))
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('tasks:update', () => {
    it('updates allowed fields', async () => {
      const created = await harness.call('tasks:create', harness.withAuth({ title: 'Original' }));
      const updated = await harness.call('tasks:update', harness.withAuth({
        id: created.id,
        updates: { title: 'Updated', status: 'running' },
      }));

      expect(updated.title).toBe('Updated');
      expect(updated.status).toBe('running');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
    });

    it('rejects invalid status', async () => {
      const created = await harness.call('tasks:create', harness.withAuth({ title: 'T' }));
      await expect(
        harness.call('tasks:update', harness.withAuth({
          id: created.id,
          updates: { status: 'invalid' },
        }))
      ).rejects.toThrow();
    });

    it('rejects invalid fields', async () => {
      const created = await harness.call('tasks:create', harness.withAuth({ title: 'T' }));
      await expect(
        harness.call('tasks:update', harness.withAuth({
          id: created.id,
          updates: { hacked: true },
        }))
      ).rejects.toThrow(/invalid fields/i);
    });

    it('throws NOT_FOUND for missing task', async () => {
      await expect(
        harness.call('tasks:update', harness.withAuth({ id: 'task-999', updates: { title: 'x' } }))
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('tasks:delete', () => {
    it('deletes a task', async () => {
      const created = await harness.call('tasks:create', harness.withAuth({ title: 'Doomed' }));
      const result = await harness.call('tasks:delete', harness.withAuth({ id: created.id }));

      expect(result.deleted).toBe(true);

      const list = await harness.call('tasks:list', harness.auth());
      expect(list.length).toBe(0);
    });

    it('throws NOT_FOUND for missing task', async () => {
      await expect(
        harness.call('tasks:delete', harness.withAuth({ id: 'task-999' }))
      ).rejects.toThrow(/not found/i);
    });
  });
});
