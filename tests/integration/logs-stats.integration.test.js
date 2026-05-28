import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHarness } from './helpers/test-harness.js';

describe('Logs integration', () => {
  let harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logs:append', () => {
    it('appends a log entry', async () => {
      const result = await harness.call('logs:append', harness.withAuth({
        message: 'Hello world',
      }));

      expect(result.id).toBeDefined();
      expect(result.message).toBe('Hello world');
      expect(result.timestamp).toBeDefined();
    });

    it('appends with all optional fields', async () => {
      const result = await harness.call('logs:append', harness.withAuth({
        message: 'Error occurred',
        agentId: 'agent-1',
        level: 'error',
        stream: 'stderr',
      }));

      expect(result.agentId).toBe('agent-1');
      expect(result.level).toBe('error');
      expect(result.stream).toBe('stderr');
    });

    it('rejects missing message', async () => {
      await expect(
        harness.call('logs:append', harness.withAuth({}))
      ).rejects.toThrow(/message.*required/i);
    });

    it('rejects invalid level', async () => {
      await expect(
        harness.call('logs:append', harness.withAuth({ message: 'x', level: 'critical' }))
      ).rejects.toThrow();
    });

    it('rejects invalid stream', async () => {
      await expect(
        harness.call('logs:append', harness.withAuth({ message: 'x', stream: 'invalid' }))
      ).rejects.toThrow();
    });
  });

  describe('logs:list', () => {
    it('returns empty list initially', async () => {
      const result = await harness.call('logs:list', harness.auth());
      expect(result).toEqual([]);
    });

    it('returns appended logs', async () => {
      await harness.call('logs:append', harness.withAuth({ message: 'Log 1' }));
      await harness.call('logs:append', harness.withAuth({ message: 'Log 2' }));

      const result = await harness.call('logs:list', harness.auth());
      expect(result.length).toBe(2);
      expect(result[0].message).toBe('Log 1');
      expect(result[1].message).toBe('Log 2');
    });

    it('supports limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await harness.call('logs:append', harness.withAuth({ message: `Log-${i}` }));
      }

      const page = await harness.call('logs:list', harness.withAuth({ limit: 2, offset: 1 }));
      expect(page.length).toBe(2);
      expect(page[0].message).toBe('Log-1');
      expect(page[1].message).toBe('Log-2');
    });
  });

  describe('logs:new push to renderer', () => {
    it('sends logs:new to mainWindow webContents', async () => {
      await harness.call('logs:append', harness.withAuth({ message: 'Push me' }));

      expect(harness.mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'logs:new',
        expect.objectContaining({ message: 'Push me' }),
      );
    });
  });
});

describe('Stats integration', () => {
  let harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stats:summary', () => {
    it('returns zero counts on empty state', async () => {
      const result = await harness.call('stats:summary', harness.auth());

      expect(result.agents.total).toBe(0);
      expect(result.agents.running).toBe(0);
      expect(result.agents.idle).toBe(0);
      expect(result.tasks.total).toBe(0);
      expect(result.tasks.pending).toBe(0);
      expect(result.tasks.done).toBe(0);
    });

    it('counts agents and tasks correctly', async () => {
      // Create agents
      await harness.call('agents:create', harness.withAuth({ name: 'a1' }));
      await harness.call('agents:create', harness.withAuth({ name: 'a2' }));

      // Create tasks
      const t1 = await harness.call('tasks:create', harness.withAuth({ title: 't1' }));
      await harness.call('tasks:create', harness.withAuth({ title: 't2' }));
      await harness.call('tasks:create', harness.withAuth({ title: 't3' }));

      // Update one task to done
      await harness.call('tasks:update', harness.withAuth({
        id: t1.id,
        updates: { status: 'done' },
      }));

      const result = await harness.call('stats:summary', harness.auth());

      expect(result.agents.total).toBe(2);
      expect(result.agents.idle).toBe(2);
      expect(result.tasks.total).toBe(3);
      expect(result.tasks.pending).toBe(2);
      expect(result.tasks.done).toBe(1);
    });

    it('rejects unauthenticated requests', async () => {
      await expect(harness.call('stats:summary')).rejects.toThrow();
    });
  });
});
