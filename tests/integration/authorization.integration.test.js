import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { handlers, mockIpcMain } = vi.hoisted(() => {
  const _handlers = new Map();
  const _mockIpcMain = {
    handle: vi.fn((channel, handler) => { _handlers.set(channel, handler); }),
    removeHandler: vi.fn(),
  };
  return { handlers: _handlers, mockIpcMain: _mockIpcMain };
});

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (str) => Buffer.from(str, 'utf8'),
    decryptString: (buf) => buf.toString('utf8'),
  },
  app: {
    getPath: () => '/tmp/agentops-test',
    getVersion: () => '0.1.0',
    getName: () => 'agentops-desktop',
    isReady: () => true,
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    webContents: { send: vi.fn() },
  })),
}));

import { createHarness } from './helpers/test-harness.js';

describe('Authorization integration', () => {
  let harness;

  beforeEach(async () => {
    harness = await createHarness({ handlers, mockIpcMain });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Permission enforcement (403) ──

  describe('role-based permission enforcement', () => {
    it('viewer cannot create agents (403)', async () => {
      await expect(
        harness.call('agents:create', harness.withAuth({ name: 'test' }, 'viewer'))
      ).rejects.toThrow(/lacks permission/i);
    });

    it('viewer cannot delete agents (403)', async () => {
      const created = await harness.call('agents:create', harness.withAuth({ name: 'test' }, 'admin'));
      await expect(
        harness.call('agents:delete', harness.withAuth({ id: created.id }, 'viewer'))
      ).rejects.toThrow(/lacks permission/i);
    });

    it('viewer cannot create goals (403)', async () => {
      await expect(
        harness.call('goals:create', harness.withAuth({ title: 'test' }, 'viewer'))
      ).rejects.toThrow(/lacks permission/i);
    });

    it('viewer cannot update tasks (403)', async () => {
      const goal = await harness.call('goals:create', harness.withAuth({ title: 'g' }, 'admin'));
      const task = await harness.call('tasks:create', harness.withAuth({ title: 't', goalId: goal.id }, 'admin'));
      await expect(
        harness.call('tasks:update', harness.withAuth({ id: task.id, updates: { status: 'running' } }, 'viewer'))
      ).rejects.toThrow(/lacks permission/i);
    });

    it('viewer can list agents (read-only)', async () => {
      await harness.call('agents:create', harness.withAuth({ name: 'a1' }, 'admin'));
      const result = await harness.call('agents:list', harness.auth('viewer'));
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });

    it('viewer can list goals (read-only)', async () => {
      await harness.call('goals:create', harness.withAuth({ title: 'g1' }, 'admin'));
      const result = await harness.call('goals:list', harness.auth('viewer'));
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });

    it('operator can create agents', async () => {
      const result = await harness.call('agents:create', harness.withAuth({ name: 'op-agent' }, 'operator'));
      expect(result.id).toMatch(/^agent-/);
      expect(result.name).toBe('op-agent');
    });

    it('operator can create goals', async () => {
      const result = await harness.call('goals:create', harness.withAuth({ title: 'op-goal' }, 'operator'));
      expect(result.id).toMatch(/^goal-/);
    });

    it('admin can do everything', async () => {
      const agent = await harness.call('agents:create', harness.withAuth({ name: 'admin-agent' }, 'admin'));
      expect(agent.id).toMatch(/^agent-/);

      const goal = await harness.call('goals:create', harness.withAuth({ title: 'admin-goal' }, 'admin'));
      expect(goal.id).toMatch(/^goal-/);

      const task = await harness.call('tasks:create', harness.withAuth({ title: 'admin-task', goalId: goal.id }, 'admin'));
      expect(task.id).toMatch(/^task-/);
    });
  });

  // ── Ownership enforcement ──

  describe('ownership enforcement', () => {
    it('operator cannot access admin-owned agent', async () => {
      const adminAgent = await harness.call('agents:create', harness.withAuth({ name: 'admin-only' }, 'admin'));

      const result = await harness.call('agents:get', harness.withAuth({ id: adminAgent.id }, 'operator'));
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.status).toBe(403);
    });

    it('operator cannot update admin-owned goal', async () => {
      const adminGoal = await harness.call('goals:create', harness.withAuth({ title: 'admin-goal' }, 'admin'));

      const result = await harness.call('goals:update', harness.withAuth({ id: adminGoal.id, updates: { title: 'hacked' } }, 'operator'));
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.status).toBe(403);
    });

    it('operator cannot delete admin-owned task', async () => {
      const goal = await harness.call('goals:create', harness.withAuth({ title: 'g' }, 'admin'));
      const adminTask = await harness.call('tasks:create', harness.withAuth({ title: 'admin-task', goalId: goal.id }, 'admin'));

      const result = await harness.call('tasks:delete', harness.withAuth({ id: adminTask.id }, 'operator'));
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.status).toBe(403);
    });

    it('operator can access their own agent', async () => {
      const myAgent = await harness.call('agents:create', harness.withAuth({ name: 'my-agent' }, 'operator'));
      const result = await harness.call('agents:get', harness.withAuth({ id: myAgent.id }, 'operator'));
      expect(result.id).toBe(myAgent.id);
    });

    it('operator can update their own goal', async () => {
      const myGoal = await harness.call('goals:create', harness.withAuth({ title: 'my-goal' }, 'operator'));
      const updated = await harness.call('goals:update', harness.withAuth({ id: myGoal.id, updates: { title: 'updated' } }, 'operator'));
      expect(updated.title).toBe('updated');
    });

    it('operator can delete their own task', async () => {
      const goal = await harness.call('goals:create', harness.withAuth({ title: 'g' }, 'operator'));
      const myTask = await harness.call('tasks:create', harness.withAuth({ title: 'my-task', goalId: goal.id }, 'operator'));
      const result = await harness.call('tasks:delete', harness.withAuth({ id: myTask.id }, 'operator'));
      expect(result.deleted).toBe(true);
    });

    it('admin can access any resource regardless of owner', async () => {
      const opAgent = await harness.call('agents:create', harness.withAuth({ name: 'op-agent' }, 'operator'));
      const result = await harness.call('agents:get', harness.withAuth({ id: opAgent.id }, 'admin'));
      expect(result.id).toBe(opAgent.id);
    });

    it('viewer can see all resources (read-only)', async () => {
      await harness.call('agents:create', harness.withAuth({ name: 'admin-a' }, 'admin'));
      await harness.call('agents:create', harness.withAuth({ name: 'op-a' }, 'operator'));
      const result = await harness.call('agents:list', harness.auth('viewer'));
      expect(result.items.length).toBeGreaterThanOrEqual(2);
    });

    it('operator list only shows their own resources', async () => {
      await harness.call('agents:create', harness.withAuth({ name: 'admin-a' }, 'admin'));
      await harness.call('agents:create', harness.withAuth({ name: 'op-a' }, 'operator'));
      await harness.call('agents:create', harness.withAuth({ name: 'op-b' }, 'operator'));

      const result = await harness.call('agents:list', harness.auth('operator'));
      expect(result.items.length).toBe(2);
      expect(result.items.every((a) => a.name.startsWith('op-'))).toBe(true);
    });

    it('admin list shows all resources', async () => {
      await harness.call('agents:create', harness.withAuth({ name: 'admin-a' }, 'admin'));
      await harness.call('agents:create', harness.withAuth({ name: 'op-a' }, 'operator'));

      const result = await harness.call('agents:list', harness.auth('admin'));
      expect(result.items.length).toBe(2);
    });
  });

  // ── Unauthenticated access ──

  describe('unauthenticated access', () => {
    it('rejects unauthenticated access to protected routes', async () => {
      await expect(harness.call('agents:list')).rejects.toThrow(/missing token/i);
    });

    it('rejects invalid token', async () => {
      await expect(
        harness.call('agents:list', { _auth: { token: 'invalid' } })
      ).rejects.toThrow(/invalid or expired/i);
    });
  });
});
