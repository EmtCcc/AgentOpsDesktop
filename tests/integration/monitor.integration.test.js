'use strict';

const { describe, it, expect, beforeEach, afterEach, vi } = require('vitest');
const { createHarness } = require('./helpers/test-harness');

describe('Monitor integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
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

    it('tracks IPC call count', async () => {
      // Make a few calls
      await harness.call('auth:login');
      await harness.call('auth:login');

      const health = await harness.call('monitor:health');
      // The health call itself is also an IPC call
      expect(health.ipc.calls).toBeGreaterThanOrEqual(3);
    });
  });
});
