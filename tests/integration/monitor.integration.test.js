import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHarness } from './helpers/test-harness.js';

describe('Monitor integration', () => {
  let harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('monitor:health', () => {
    it('returns health status without auth', async () => {
      const result = await harness.call('monitor:health');

      expect(result.status).toBe('ok');
      expect(result.ts).toBeDefined();
      expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(result.memory).toBeDefined();
      expect(result.memory.rss).toBeGreaterThan(0);
      expect(result.memory.heapUsed).toBeGreaterThan(0);
      expect(result.system).toBeDefined();
      expect(result.system.cpus).toBeGreaterThan(0);
      expect(result.ipc).toBeDefined();
      expect(result.ipc.calls).toBeGreaterThanOrEqual(0);
    });

    it('returns IPC stats object', async () => {
      const health = await harness.call('monitor:health');
      expect(health.ipc).toBeDefined();
      expect(typeof health.ipc.calls).toBe('number');
    });
  });
});
