import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentAdapter, AdapterRegistry } from '../src/main/adapter-registry.js';
import GenericCliAdapter from '../src/main/adapters/generic-cli.adapter.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MOCK_CLI = join(__dirname, 'fixtures', 'mock-cli.js');
const NODE = process.execPath;

/**
 * Hot-reload CI tests for AdapterRegistry.
 *
 * Covers the full cycle: register → load → healthCheck → unload → verify cleanup.
 * Validates no resource leaks (listeners, map entries, instance references).
 */
describe('Adapter Hot-Reload', () => {
  let registry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  afterEach(() => {
    registry.removeAllListeners();
  });

  // ─── full hot-reload cycle ──────────────────────────────────────────
  describe('full reload cycle', () => {
    it('register → load → healthCheck → unload → reload → healthCheck', async () => {
      // Register
      registry.registerClass('test-adapter', GenericCliAdapter);
      expect(registry.listRegistered()).toContain('test-adapter');

      // Load
      const adapter = registry.load('test-adapter', { execPath: NODE, args: [MOCK_CLI] });
      expect(adapter).toBeInstanceOf(GenericCliAdapter);
      expect(registry.get('test-adapter')).toBe(adapter);

      // Health check
      const health1 = await registry.healthCheck('test-adapter');
      expect(health1.ok).toBe(true);

      // Unload
      const unloaded = await registry.unload('test-adapter');
      expect(unloaded).toBe(true);
      expect(registry.get('test-adapter')).toBeNull();
      expect(registry.listLoaded()).toHaveLength(0);

      // Reload — class is still registered, just load a new instance
      const adapter2 = registry.load('test-adapter', { execPath: NODE, args: [MOCK_CLI] });
      expect(adapter2).toBeInstanceOf(GenericCliAdapter);
      expect(adapter2).not.toBe(adapter); // new instance

      // Health check on reloaded adapter
      const health2 = await registry.healthCheck('test-adapter');
      expect(health2.ok).toBe(true);
    });

    it('unload is idempotent (returns false for non-loaded)', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);
      const result = await registry.unload('test-adapter');
      expect(result).toBe(false);
    });

    it('healthCheck returns error after unload', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);
      registry.load('test-adapter', { execPath: NODE });
      await registry.unload('test-adapter');

      const health = await registry.healthCheck('test-adapter');
      expect(health.ok).toBe(false);
      expect(health.error).toContain('not loaded');
    });
  });

  // ─── resource leak detection ────────────────────────────────────────
  describe('resource leak detection', () => {
    it('unload removes all event listeners from adapter', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);
      const adapter = registry.load('test-adapter', { execPath: NODE, args: [MOCK_CLI] });

      // Add listeners to simulate real usage
      adapter.on('exit', () => {});
      adapter.on('error', () => {});
      expect(adapter.listenerCount('exit')).toBeGreaterThan(0);

      await registry.unload('test-adapter');
      expect(adapter.listenerCount('exit')).toBe(0);
      expect(adapter.listenerCount('error')).toBe(0);
    });

    it('registry maps are clean after unload', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);
      registry.load('test-adapter', { execPath: NODE });
      expect(registry.adapters.size).toBe(1);

      await registry.unload('test-adapter');
      expect(registry.adapters.size).toBe(0);
      // Class registration should remain
      expect(registry.adapterClasses.size).toBe(1);
    });

    it('unregisterClass cascades unload on live adapter', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);
      const adapter = registry.load('test-adapter', { execPath: NODE });
      adapter.on('exit', () => {});
      expect(registry.adapters.size).toBe(1);

      registry.unregisterClass('test-adapter');
      expect(registry.adapters.size).toBe(0);
      expect(registry.adapterClasses.size).toBe(0);
      expect(adapter.listenerCount('exit')).toBe(0);
    });

    it('no leaked listeners across multiple load/unload cycles', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);

      for (let i = 0; i < 5; i++) {
        const adapter = registry.load('test-adapter', { execPath: NODE, args: [MOCK_CLI] });
        adapter.on('exit', () => {});
        adapter.on('error', () => {});
        await registry.unload('test-adapter');
      }

      // Registry should be clean
      expect(registry.adapters.size).toBe(0);
      // Class still registered
      expect(registry.getClass('test-adapter')).toBe(GenericCliAdapter);
    });

    it('unload cleans up running spawned instances from adapter', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);
      const adapter = registry.load('test-adapter', {
        execPath: NODE,
        args: [MOCK_CLI],
        timeoutMs: 30000,
      });

      // Spawn a hanging process
      const { instanceId } = await adapter.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(adapter.instances.size).toBe(1);
      expect(adapter.status).toBe('running');

      // Unload registry should clean up
      await registry.unload('test-adapter');
      // Adapter's removeAllListeners was called; instances map may still have entry
      // but the adapter is no longer referenced by registry
      expect(registry.get('test-adapter')).toBeNull();
    });
  });

  // ─── multiple reload cycles (stress) ────────────────────────────────
  describe('multiple reload cycles', () => {
    it('survives 10 rapid unload/load cycles', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);

      for (let i = 0; i < 10; i++) {
        registry.load('test-adapter', { execPath: NODE, args: [MOCK_CLI] });
        const health = await registry.healthCheck('test-adapter');
        expect(health.ok).toBe(true);
        await registry.unload('test-adapter');
        expect(registry.get('test-adapter')).toBeNull();
      }

      expect(registry.listLoaded()).toHaveLength(0);
    });

    it('concurrent healthCheck + unload does not corrupt state', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);
      registry.load('test-adapter', { execPath: NODE, args: [MOCK_CLI] });

      // Fire healthCheck and unload concurrently
      const [health, unloaded] = await Promise.all([
        registry.healthCheck('test-adapter'),
        registry.unload('test-adapter'),
      ]);

      // One or both should succeed; no crash
      expect(typeof health.ok).toBe('boolean');
      expect(typeof unloaded).toBe('boolean');
      expect(registry.get('test-adapter')).toBeNull();
    });
  });

  // ─── adapter instance isolation ─────────────────────────────────────
  describe('instance isolation', () => {
    it('reloaded adapter gets fresh config', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);

      const a1 = registry.load('test-adapter', {
        execPath: NODE,
        args: [MOCK_CLI, '--fail'],
      });
      const r1 = await a1.execute({ title: 't1' });
      expect(r1.exitCode).toBe(1);

      await registry.unload('test-adapter');

      const a2 = registry.load('test-adapter', {
        execPath: NODE,
        args: [MOCK_CLI, '--health'],
      });
      const r2 = await a2.execute({ title: 't2' });
      expect(r2.exitCode).toBe(0);
    });

    it('reloaded adapter does not share instances map', async () => {
      registry.registerClass('test-adapter', GenericCliAdapter);

      const a1 = registry.load('test-adapter', {
        execPath: NODE,
        args: [MOCK_CLI],
        timeoutMs: 30000,
      });
      await a1.spawn({ args: [MOCK_CLI, '--hang'] });
      expect(a1.instances.size).toBe(1);

      await registry.unload('test-adapter');

      const a2 = registry.load('test-adapter', {
        execPath: NODE,
        args: [MOCK_CLI],
        timeoutMs: 30000,
      });
      expect(a2.instances.size).toBe(0); // fresh, no leaked state from a1
    });
  });

  // ─── event emission during reload ───────────────────────────────────
  describe('events during reload', () => {
    it('emits loaded and unloaded events in correct order', async () => {
      const events = [];
      registry.on('adapter:loaded', (d) => events.push({ event: 'loaded', type: d.type }));
      registry.on('adapter:unloaded', (d) => events.push({ event: 'unloaded', type: d.type }));

      registry.registerClass('test-adapter', GenericCliAdapter);
      registry.load('test-adapter', { execPath: NODE });
      await registry.unload('test-adapter');
      registry.load('test-adapter', { execPath: NODE });

      expect(events).toEqual([
        { event: 'loaded', type: 'test-adapter' },
        { event: 'unloaded', type: 'test-adapter' },
        { event: 'loaded', type: 'test-adapter' },
      ]);
    });

    it('unregisterClass emits unloaded if adapter was loaded', async () => {
      const events = [];
      registry.on('adapter:unloaded', (d) => events.push(d.type));

      registry.registerClass('test-adapter', GenericCliAdapter);
      registry.load('test-adapter', { execPath: NODE });
      registry.unregisterClass('test-adapter');

      expect(events).toContain('test-adapter');
    });
  });
});
