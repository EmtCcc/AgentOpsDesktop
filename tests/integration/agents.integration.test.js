'use strict';

const { describe, it, expect, beforeEach, afterEach, vi } = require('vitest');
const { createHarness } = require('./helpers/test-harness');

describe('Agents integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Config CRUD ──

  describe('agents:create', () => {
    it('creates an agent with required fields', async () => {
      const result = await harness.call('agents:create', harness.withAuth({
        name: 'test-agent',
      }));

      expect(result.id).toMatch(/^agent-/);
      expect(result.name).toBe('test-agent');
      expect(result.type).toBe('custom');
      expect(result.status).toBe('idle');
      expect(result.createdAt).toBeDefined();
    });

    it('creates an agent with all optional fields', async () => {
      const result = await harness.call('agents:create', harness.withAuth({
        name: 'claude-agent',
        type: 'claude',
        command: 'claude --chat',
        execPath: '/usr/local/bin/claude',
        cwd: '/tmp',
      }));

      expect(result.type).toBe('claude');
      expect(result.command).toBe('claude --chat');
      expect(result.execPath).toBe('/usr/local/bin/claude');
      expect(result.cwd).toBe('/tmp');
    });

    it('rejects missing name', async () => {
      await expect(
        harness.call('agents:create', harness.withAuth({}))
      ).rejects.toThrow(/name.*required/i);
    });

    it('rejects empty name', async () => {
      await expect(
        harness.call('agents:create', harness.withAuth({ name: '' }))
      ).rejects.toThrow();
    });

    it('rejects invalid agent type', async () => {
      await expect(
        harness.call('agents:create', harness.withAuth({ name: 'x', type: 'invalid' }))
      ).rejects.toThrow();
    });
  });

  describe('agents:list', () => {
    it('returns empty list initially', async () => {
      const result = await harness.call('agents:list', harness.auth());
      expect(result).toEqual([]);
    });

    it('returns created agents', async () => {
      await harness.call('agents:create', harness.withAuth({ name: 'a1' }));
      await harness.call('agents:create', harness.withAuth({ name: 'a2' }));

      const result = await harness.call('agents:list', harness.auth());
      expect(result.length).toBe(2);
      expect(result.map((a) => a.name).sort()).toEqual(['a1', 'a2']);
    });

    it('supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await harness.call('agents:create', harness.withAuth({ name: `agent-${i}` }));
      }

      const page1 = await harness.call('agents:list', harness.withAuth({ limit: 2, offset: 0 }));
      expect(page1.length).toBe(2);

      const page2 = await harness.call('agents:list', harness.withAuth({ limit: 2, offset: 2 }));
      expect(page2.length).toBe(2);

      const page3 = await harness.call('agents:list', harness.withAuth({ limit: 2, offset: 4 }));
      expect(page3.length).toBe(1);
    });
  });

  describe('agents:get', () => {
    it('returns a specific agent', async () => {
      const created = await harness.call('agents:create', harness.withAuth({ name: 'find-me' }));
      const result = await harness.call('agents:get', harness.withAuth({ id: created.id }));

      expect(result.id).toBe(created.id);
      expect(result.name).toBe('find-me');
    });

    it('throws NOT_FOUND for missing agent', async () => {
      await expect(
        harness.call('agents:get', harness.withAuth({ id: 'agent-999' }))
      ).rejects.toThrow(/not found/i);
    });

    it('rejects missing id', async () => {
      await expect(
        harness.call('agents:get', harness.withAuth({}))
      ).rejects.toThrow(/id.*required/i);
    });
  });

  describe('agents:update', () => {
    it('updates allowed fields', async () => {
      const created = await harness.call('agents:create', harness.withAuth({ name: 'original' }));
      const updated = await harness.call('agents:update', harness.withAuth({
        id: created.id,
        updates: { name: 'renamed', type: 'claude' },
      }));

      expect(updated.name).toBe('renamed');
      expect(updated.type).toBe('claude');
      expect(updated.id).toBe(created.id);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
    });

    it('rejects invalid fields in updates', async () => {
      const created = await harness.call('agents:create', harness.withAuth({ name: 'x' }));
      await expect(
        harness.call('agents:update', harness.withAuth({
          id: created.id,
          updates: { name: 'ok', hacked: true },
        }))
      ).rejects.toThrow(/invalid fields/i);
    });

    it('rejects empty updates', async () => {
      const created = await harness.call('agents:create', harness.withAuth({ name: 'x' }));
      await expect(
        harness.call('agents:update', harness.withAuth({
          id: created.id,
          updates: {},
        }))
      ).rejects.toThrow(/must not be empty/i);
    });

    it('throws NOT_FOUND for missing agent', async () => {
      await expect(
        harness.call('agents:update', harness.withAuth({ id: 'agent-999', updates: { name: 'x' } }))
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('agents:delete', () => {
    it('deletes an agent', async () => {
      const created = await harness.call('agents:create', harness.withAuth({ name: 'doomed' }));
      const result = await harness.call('agents:delete', harness.withAuth({ id: created.id }));

      expect(result.deleted).toBe(true);
      expect(result.id).toBe(created.id);

      // Should be gone
      const list = await harness.call('agents:list', harness.auth());
      expect(list.length).toBe(0);
    });

    it('throws NOT_FOUND for missing agent', async () => {
      await expect(
        harness.call('agents:delete', harness.withAuth({ id: 'agent-999' }))
      ).rejects.toThrow(/not found/i);
    });
  });

  // ── Validation pipeline ──

  describe('validation pipeline', () => {
    it('rejects wrong type for offset', async () => {
      await expect(
        harness.call('agents:list', harness.withAuth({ offset: 'not-a-number' }))
      ).rejects.toThrow();
    });

    it('rejects invalid sortBy value', async () => {
      await expect(
        harness.call('agents:list', harness.withAuth({ sortBy: 'hacked' }))
      ).rejects.toThrow();
    });
  });
});
