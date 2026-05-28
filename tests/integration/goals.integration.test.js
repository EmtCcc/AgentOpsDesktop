import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHarness } from './helpers/test-harness.js';

describe('Goals integration', () => {
  let harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('goals:create', () => {
    it('creates a goal with required fields', async () => {
      const result = await harness.call('goals:create', harness.withAuth({
        title: 'Ship v1.0',
      }));

      expect(result.id).toMatch(/^goal-/);
      expect(result.title).toBe('Ship v1.0');
      expect(result.status).toBe('active');
      expect(result.taskIds).toEqual([]);
      expect(result.createdAt).toBeDefined();
    });

    it('creates a goal with description', async () => {
      const result = await harness.call('goals:create', harness.withAuth({
        title: 'Goal',
        description: 'A detailed description',
      }));

      expect(result.description).toBe('A detailed description');
    });

    it('rejects missing title', async () => {
      await expect(
        harness.call('goals:create', harness.withAuth({}))
      ).rejects.toThrow(/title.*required/i);
    });

    it('rejects empty title', async () => {
      await expect(
        harness.call('goals:create', harness.withAuth({ title: '' }))
      ).rejects.toThrow();
    });
  });

  describe('goals:list', () => {
    it('returns empty list initially', async () => {
      const result = await harness.call('goals:list', harness.auth());
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns created goals', async () => {
      await harness.call('goals:create', harness.withAuth({ title: 'G1' }));
      await harness.call('goals:create', harness.withAuth({ title: 'G2' }));

      const result = await harness.call('goals:list', harness.auth());
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await harness.call('goals:create', harness.withAuth({ title: `Goal-${i}` }));
      }

      const page = await harness.call('goals:list', harness.withAuth({ limit: 2, offset: 0 }));
      expect(page.items.length).toBe(2);
      expect(page.total).toBe(5);
      expect(page.hasMore).toBe(true);
    });
  });

  describe('goals:get', () => {
    it('returns a specific goal', async () => {
      const created = await harness.call('goals:create', harness.withAuth({ title: 'Find me' }));
      const result = await harness.call('goals:get', harness.withAuth({ id: created.id }));

      expect(result.id).toBe(created.id);
      expect(result.title).toBe('Find me');
    });

    it('returns NOT_FOUND for missing goal', async () => {
      const result = await harness.call('goals:get', harness.withAuth({ id: 'goal-999' }));
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toMatch(/not found/i);
    });
  });

  describe('goals:update', () => {
    it('updates title and description', async () => {
      const created = await harness.call('goals:create', harness.withAuth({ title: 'Original' }));
      const updated = await harness.call('goals:update', harness.withAuth({
        id: created.id,
        updates: { title: 'Updated', description: 'New desc' },
      }));

      expect(updated.title).toBe('Updated');
      expect(updated.description).toBe('New desc');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
    });

    it('updates status', async () => {
      const created = await harness.call('goals:create', harness.withAuth({ title: 'G' }));
      const updated = await harness.call('goals:update', harness.withAuth({
        id: created.id,
        updates: { status: 'completed' },
      }));

      expect(updated.status).toBe('completed');
    });

    it('rejects invalid status', async () => {
      const created = await harness.call('goals:create', harness.withAuth({ title: 'G' }));
      await expect(
        harness.call('goals:update', harness.withAuth({
          id: created.id,
          updates: { status: 'invalid' },
        }))
      ).rejects.toThrow();
    });

    it('rejects invalid fields', async () => {
      const created = await harness.call('goals:create', harness.withAuth({ title: 'G' }));
      await expect(
        harness.call('goals:update', harness.withAuth({
          id: created.id,
          updates: { hacked: true },
        }))
      ).rejects.toThrow(/invalid fields/i);
    });

    it('returns NOT_FOUND for missing goal', async () => {
      const result = await harness.call('goals:update', harness.withAuth({ id: 'goal-999', updates: { title: 'x' } }));
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('goals:delete', () => {
    it('deletes a goal', async () => {
      const created = await harness.call('goals:create', harness.withAuth({ title: 'Doomed' }));
      const result = await harness.call('goals:delete', harness.withAuth({ id: created.id }));

      expect(result.deleted).toBe(true);
      expect(result.id).toBe(created.id);

      const list = await harness.call('goals:list', harness.auth());
      expect(list.items.length).toBe(0);
      expect(list.total).toBe(0);
    });

    it('returns NOT_FOUND for missing goal', async () => {
      const result = await harness.call('goals:delete', harness.withAuth({ id: 'goal-999' }));
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });
});
