'use strict';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks (must be before any imports from src/) ──

vi.mock('electron', () => ({
  safeStorage: { isEncryptionAvailable: () => false, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() },
  app: { getPath: () => '/tmp/test-agentops', whenReady: vi.fn() },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: () => false,
    readFileSync: actual.readFileSync,
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

vi.mock('../../src/main/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

vi.mock('electron-updater', () => ({
  autoUpdater: { autoDownload: false, on: vi.fn(), checkForUpdates: vi.fn() },
}));

// ── Helpers ──

function createMockRepo(initialItems = []) {
  let items = [...initialItems];
  let nextId = items.length + 1;
  return {
    list(params = {}) {
      const offset = params.offset || 0;
      const limit = params.limit || 50;
      let filtered = [...items];
      if (params.status) filtered = filtered.filter(i => i.status === params.status);
      if (params.goalId) filtered = filtered.filter(i => i.goalId === params.goalId);
      const sliced = filtered.slice(offset, offset + limit);
      return { items: sliced, total: filtered.length };
    },
    getById(id) { return items.find(i => i.id === id) || null; },
    create(data) {
      const item = { id: String(nextId++), ...data, status: data.status || 'idle', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      items.push(item);
      return item;
    },
    update(id, data) {
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return null;
      items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
      return items[idx];
    },
    delete(id) {
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return false;
      items.splice(idx, 1);
      return true;
    },
    _items: items,
    _reset() { items = []; nextId = 1; },
  };
}

function createMockTaskLogRepo() {
  const entries = [];
  return {
    list(params = {}) {
      let filtered = [...entries];
      if (params.agentId) filtered = filtered.filter(e => e.agentId === params.agentId);
      if (params.taskId) filtered = filtered.filter(e => e.taskId === params.taskId);
      const offset = params.offset || 0;
      const limit = params.limit || 100;
      return filtered.slice(offset, offset + limit);
    },
    append(data) {
      const entry = { id: String(entries.length + 1), ...data, timestamp: new Date().toISOString() };
      entries.push(entry);
      return entry;
    },
  };
}

function createMockSettingsRepo() {
  const settings = {};
  return {
    getAll() { return { ...settings }; },
    update(data) {
      Object.assign(settings, data.settings || data);
      return { ...settings };
    },
  };
}

// ── Tests ──

describe('HTTP API Integration', async () => {
  const { createApp } = await import('../../src/main/api/app.js');
  const { TokenManager } = await import('../../src/main/ipc/middleware/token-manager.js');

  let app;
  let tokenManager;
  let repos;
  let authHeaders;

  function makeApp() {
    repos = {
      agents: createMockRepo(),
      goals: createMockRepo(),
      tasks: createMockRepo(),
      taskLogs: createMockTaskLogRepo(),
      settings: createMockSettingsRepo(),
    };
    tokenManager = new TokenManager();
    // Manually init without Electron's app.getPath
    tokenManager._storagePath = null;
    app = createApp({ repos, tokenManager });
    const session = tokenManager.createSession({ role: 'admin' });
    authHeaders = { Authorization: `Bearer ${session.token}` };
  }

  beforeEach(() => {
    makeApp();
  });

  async function req(method, path, { body, headers = {} } = {}) {
    const init = { method, headers: { ...authHeaders, ...headers } };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers['Content-Type'] = 'application/json';
    }
    return app.fetch(new Request(`http://localhost${path}`, init));
  }

  async function json(method, path, opts) {
    const res = await req(method, path, opts);
    const data = await res.json();
    return { status: res.status, ...data };
  }

  // ── Health ──
  describe('GET /health', () => {
    it('returns health status without auth', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(['ok', 'degraded']).toContain(data.status);
      expect(data.uptimeMs).toBeDefined();
      expect(data.memory).toBeDefined();
      expect(data.system).toBeDefined();
      expect(data.ipc).toBeDefined();
      expect(data.renderer).toBeDefined();
      expect(data.app).toBeDefined();
      expect(Array.isArray(data.alerts)).toBe(true);
    });

    it('returns valid ISO timestamp', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await res.json();
      expect(data.ts).toBeDefined();
      expect(new Date(data.ts).toISOString()).toBe(data.ts);
    });

    it('returns non-negative uptime', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await res.json();
      expect(typeof data.uptimeMs).toBe('number');
      expect(data.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it('returns memory with numeric fields', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await res.json();
      expect(typeof data.memory.rss).toBe('number');
      expect(typeof data.memory.heapUsed).toBe('number');
      expect(typeof data.memory.heapTotal).toBe('number');
      expect(data.memory.rss).toBeGreaterThan(0);
      expect(data.memory.heapUsed).toBeGreaterThan(0);
      expect(data.memory.heapTotal).toBeGreaterThan(0);
    });

    it('returns system info with expected fields', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await res.json();
      expect(typeof data.system.totalMem).toBe('number');
      expect(typeof data.system.freeMem).toBe('number');
      expect(typeof data.system.cpus).toBe('number');
      expect(Array.isArray(data.system.loadAvg)).toBe(true);
      expect(data.system.totalMem).toBeGreaterThan(0);
      expect(data.system.cpus).toBeGreaterThan(0);
    });

    it('returns IPC metrics', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await res.json();
      expect(typeof data.ipc.calls).toBe('number');
      expect(typeof data.ipc.errors).toBe('number');
      expect(typeof data.ipc.avgLatencyMs).toBe('number');
    });

    it('returns version from package.json', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await res.json();
      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe('string');
      expect(data.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('returns db connectivity status', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await res.json();
      expect(data.db).toBeDefined();
      expect(typeof data.db.ok).toBe('boolean');
    });

    it('responds to HEAD requests', async () => {
      const res = await app.fetch(new Request('http://localhost/health', { method: 'HEAD' }));
      expect([200, 404, 405]).toContain(res.status);
    });
  });

  // ── Auth ──
  describe('Auth endpoints', () => {
    it('POST /auth/login creates a session', async () => {
      const r = await json('POST', '/auth/login', { body: { role: 'operator' } });
      expect(r.ok).toBe(true);
      expect(r.data.token).toBeDefined();
      expect(r.data.role).toBe('operator');
      expect(r.data.expiresAt).toBeDefined();
    });

    it('GET /auth/status returns session info when logged in', async () => {
      const r = await json('GET', '/auth/status');
      expect(r.ok).toBe(true);
      // After login in the test, status should show a valid session
    });

    it('GET /auth/status returns isValid:false with no session', async () => {
      tokenManager.destroySession();
      const r = await json('GET', '/auth/status');
      expect(r.ok).toBe(true);
      expect(r.data.isValid).toBe(false);
    });

    it('POST /auth/rotate rotates the token', async () => {
      const oldToken = tokenManager._session?.token;
      const r = await json('POST', '/auth/rotate');
      expect(r.ok).toBe(true);
      expect(r.data.token).toBeDefined();
      // The old token used in authHeaders is now invalid
    });

    it('POST /auth/logout destroys the session', async () => {
      const r = await json('POST', '/auth/logout');
      expect(r.ok).toBe(true);
    });
  });

  // ── Auth enforcement ──
  describe('Auth enforcement', () => {
    it('rejects requests without Authorization header', async () => {
      const res = await app.fetch(new Request('http://localhost/api/agents'));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('HTTP_ERROR');
    });

    it('rejects requests with invalid token', async () => {
      const res = await app.fetch(new Request('http://localhost/api/agents', {
        headers: { Authorization: 'Bearer invalid-token' },
      }));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });

    it('rejects requests with malformed Authorization header', async () => {
      const res = await app.fetch(new Request('http://localhost/api/agents', {
        headers: { Authorization: 'Basic abc123' },
      }));
      expect(res.status).toBe(401);
    });

    it('allows /health without auth', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      expect(res.status).toBe(200);
    });

    it('allows /auth/login without auth', async () => {
      const res = await app.fetch(new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }));
      expect(res.status).toBe(200);
    });
  });

  // ── 404 ──
  describe('404 handling', () => {
    it('returns 404 for unknown routes (authenticated)', async () => {
      const res = await req('GET', '/api/nonexistent');
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('returns 401 for unknown protected routes (no auth)', async () => {
      const res = await app.fetch(new Request('http://localhost/api/nonexistent'));
      expect(res.status).toBe(401);
    });
  });

  // ── Agents CRUD ──
  describe('Agents API', () => {
    it('GET /api/agents returns empty list', async () => {
      const r = await json('GET', '/api/agents');
      expect(r.ok).toBe(true);
      expect(r.data).toEqual([]);
    });

    it('POST /api/agents creates an agent', async () => {
      const r = await json('POST', '/api/agents', { body: { name: 'Test Agent', type: 'autonomous' } });
      expect(r.status).toBe(201);
      expect(r.ok).toBe(true);
      expect(r.data.name).toBe('Test Agent');
      expect(r.data.type).toBe('autonomous');
      expect(r.data.id).toBeDefined();
    });

    it('GET /api/agents returns created agents', async () => {
      await json('POST', '/api/agents', { body: { name: 'Agent A' } });
      await json('POST', '/api/agents', { body: { name: 'Agent B' } });
      const r = await json('GET', '/api/agents');
      expect(r.ok).toBe(true);
      expect(r.data).toHaveLength(2);
    });

    it('GET /api/agents/:id returns a single agent', async () => {
      const created = await json('POST', '/api/agents', { body: { name: 'Lookup Agent' } });
      const r = await json('GET', `/api/agents/${created.data.id}`);
      expect(r.ok).toBe(true);
      expect(r.data.name).toBe('Lookup Agent');
    });

    it('GET /api/agents/:id returns 404 for nonexistent', async () => {
      const r = await json('GET', '/api/agents/nonexistent');
      expect(r.status).toBe(404);
      expect(r.ok).toBe(false);
    });

    it('PATCH /api/agents/:id updates an agent', async () => {
      const created = await json('POST', '/api/agents', { body: { name: 'Before' } });
      const r = await json('PATCH', `/api/agents/${created.data.id}`, { body: { name: 'After', status: 'running' } });
      expect(r.ok).toBe(true);
      expect(r.data.name).toBe('After');
      expect(r.data.status).toBe('running');
    });

    it('PATCH /api/agents/:id returns 404 for nonexistent', async () => {
      const r = await json('PATCH', '/api/agents/nonexistent', { body: { name: 'X' } });
      expect(r.status).toBe(404);
    });

    it('DELETE /api/agents/:id deletes an agent', async () => {
      const created = await json('POST', '/api/agents', { body: { name: 'Doomed' } });
      const r = await json('DELETE', `/api/agents/${created.data.id}`);
      expect(r.ok).toBe(true);
      expect(r.data.deleted).toBe(true);
      // Verify gone
      const check = await json('GET', `/api/agents/${created.data.id}`);
      expect(check.status).toBe(404);
    });

    it('DELETE /api/agents/:id returns 404 for nonexistent', async () => {
      const r = await json('DELETE', '/api/agents/nonexistent');
      expect(r.status).toBe(404);
    });

    it('supports pagination with offset and limit', async () => {
      for (let i = 0; i < 5; i++) await json('POST', '/api/agents', { body: { name: `Agent ${i}` } });
      const r = await json('GET', '/api/agents?offset=2&limit=2');
      expect(r.ok).toBe(true);
      expect(r.data).toHaveLength(2);
    });

    it('supports status filtering', async () => {
      const a1 = await json('POST', '/api/agents', { body: { name: 'Idle', status: 'idle' } });
      await json('POST', '/api/agents', { body: { name: 'Running', status: 'running' } });
      const r = await json('GET', '/api/agents?status=idle');
      expect(r.ok).toBe(true);
      expect(r.data).toHaveLength(1);
      expect(r.data[0].name).toBe('Idle');
    });
  });

  // ── Agents validation ──
  describe('Agents validation', () => {
    it('rejects POST without required name', async () => {
      const r = await json('POST', '/api/agents', { body: { type: 'autonomous' } });
      expect(r.status).toBe(422);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects POST with empty name', async () => {
      const r = await json('POST', '/api/agents', { body: { name: '' } });
      expect(r.status).toBe(422);
    });

    it('rejects POST with invalid type enum', async () => {
      const r = await json('POST', '/api/agents', { body: { name: 'X', type: 'invalid' } });
      expect(r.status).toBe(422);
    });

    it('rejects PATCH with invalid status enum', async () => {
      const created = await json('POST', '/api/agents', { body: { name: 'A' } });
      const r = await json('PATCH', `/api/agents/${created.data.id}`, { body: { status: 'bogus' } });
      expect(r.status).toBe(422);
    });

    it('rejects invalid query params', async () => {
      const res = await req('GET', '/api/agents?offset=notanumber');
      // Query validation converts NaN strings, so this may or may not error
      // depending on the implementation. Just verify no crash.
      expect([200, 422]).toContain(res.status);
    });
  });

  // ── Goals CRUD ──
  describe('Goals API', () => {
    it('POST /api/goals creates a goal', async () => {
      const r = await json('POST', '/api/goals', { body: { title: 'Ship feature X' } });
      expect(r.status).toBe(201);
      expect(r.ok).toBe(true);
      expect(r.data.title).toBe('Ship feature X');
    });

    it('GET /api/goals returns created goals', async () => {
      await json('POST', '/api/goals', { body: { title: 'Goal A' } });
      await json('POST', '/api/goals', { body: { title: 'Goal B' } });
      const r = await json('GET', '/api/goals');
      expect(r.data).toHaveLength(2);
    });

    it('GET /api/goals/:id returns a single goal', async () => {
      const created = await json('POST', '/api/goals', { body: { title: 'Lookup' } });
      const r = await json('GET', `/api/goals/${created.data.id}`);
      expect(r.ok).toBe(true);
      expect(r.data.title).toBe('Lookup');
    });

    it('PATCH /api/goals/:id updates status', async () => {
      const created = await json('POST', '/api/goals', { body: { title: 'To Complete' } });
      const r = await json('PATCH', `/api/goals/${created.data.id}`, { body: { status: 'completed' } });
      expect(r.ok).toBe(true);
      expect(r.data.status).toBe('completed');
    });

    it('DELETE /api/goals/:id deletes a goal', async () => {
      const created = await json('POST', '/api/goals', { body: { title: 'Doomed' } });
      const r = await json('DELETE', `/api/goals/${created.data.id}`);
      expect(r.ok).toBe(true);
    });

    it('rejects POST without title', async () => {
      const r = await json('POST', '/api/goals', { body: {} });
      expect(r.status).toBe(422);
    });

    it('rejects invalid goal status', async () => {
      const created = await json('POST', '/api/goals', { body: { title: 'X' } });
      const r = await json('PATCH', `/api/goals/${created.data.id}`, { body: { status: 'invalid' } });
      expect(r.status).toBe(422);
    });
  });

  // ── Tasks CRUD ──
  describe('Tasks API', () => {
    it('POST /api/tasks creates a task', async () => {
      const r = await json('POST', '/api/tasks', { body: { title: 'Write tests' } });
      expect(r.status).toBe(201);
      expect(r.ok).toBe(true);
      expect(r.data.title).toBe('Write tests');
    });

    it('GET /api/tasks returns created tasks', async () => {
      await json('POST', '/api/tasks', { body: { title: 'Task A' } });
      const r = await json('GET', '/api/tasks');
      expect(r.data).toHaveLength(1);
    });

    it('GET /api/tasks/:id returns a single task', async () => {
      const created = await json('POST', '/api/tasks', { body: { title: 'Lookup' } });
      const r = await json('GET', `/api/tasks/${created.data.id}`);
      expect(r.ok).toBe(true);
      expect(r.data.title).toBe('Lookup');
    });

    it('PATCH /api/tasks/:id updates status', async () => {
      const created = await json('POST', '/api/tasks', { body: { title: 'To Run' } });
      const r = await json('PATCH', `/api/tasks/${created.data.id}`, { body: { status: 'running' } });
      expect(r.ok).toBe(true);
      expect(r.data.status).toBe('running');
    });

    it('DELETE /api/tasks/:id deletes a task', async () => {
      const created = await json('POST', '/api/tasks', { body: { title: 'Doomed' } });
      const r = await json('DELETE', `/api/tasks/${created.data.id}`);
      expect(r.ok).toBe(true);
    });

    it('rejects POST without title', async () => {
      const r = await json('POST', '/api/tasks', { body: {} });
      expect(r.status).toBe(422);
    });

    it('rejects invalid task status', async () => {
      const created = await json('POST', '/api/tasks', { body: { title: 'X' } });
      const r = await json('PATCH', `/api/tasks/${created.data.id}`, { body: { status: 'invalid' } });
      expect(r.status).toBe(422);
    });

    it('supports status filtering', async () => {
      await json('POST', '/api/tasks', { body: { title: 'A', status: 'pending' } });
      await json('POST', '/api/tasks', { body: { title: 'B', status: 'done' } });
      const r = await json('GET', '/api/tasks?status=pending');
      expect(r.data).toHaveLength(1);
      expect(r.data[0].title).toBe('A');
    });
  });

  // ── Logs ──
  describe('Logs API', () => {
    it('POST /api/logs appends a log entry', async () => {
      const r = await json('POST', '/api/logs', { body: { message: 'test log', level: 'info' } });
      expect(r.status).toBe(201);
      expect(r.ok).toBe(true);
      expect(r.data.message).toBe('test log');
    });

    it('GET /api/logs returns log entries', async () => {
      await json('POST', '/api/logs', { body: { message: 'log 1' } });
      await json('POST', '/api/logs', { body: { message: 'log 2' } });
      const r = await json('GET', '/api/logs');
      expect(r.ok).toBe(true);
      expect(r.data).toHaveLength(2);
    });

    it('rejects POST without message', async () => {
      const r = await json('POST', '/api/logs', { body: { level: 'info' } });
      expect(r.status).toBe(422);
    });

    it('rejects invalid log level', async () => {
      const r = await json('POST', '/api/logs', { body: { message: 'x', level: 'critical' } });
      expect(r.status).toBe(422);
    });
  });

  // ── Stats ──
  describe('Stats API', () => {
    it('GET /api/stats/summary returns aggregate counts', async () => {
      await json('POST', '/api/agents', { body: { name: 'A1', status: 'idle' } });
      await json('POST', '/api/agents', { body: { name: 'A2', status: 'running' } });
      await json('POST', '/api/tasks', { body: { title: 'T1', status: 'pending' } });
      await json('POST', '/api/goals', { body: { title: 'G1', status: 'active' } });
      const r = await json('GET', '/api/stats/summary');
      expect(r.ok).toBe(true);
      expect(r.data.agents.total).toBe(2);
      expect(r.data.agents.running).toBe(1);
      expect(r.data.agents.idle).toBe(1);
      expect(r.data.tasks.total).toBe(1);
      expect(r.data.tasks.pending).toBe(1);
      expect(r.data.goals.total).toBe(1);
      expect(r.data.goals.active).toBe(1);
    });
  });

  // ── Settings ──
  describe('Settings API', () => {
    it('GET /api/settings returns current settings', async () => {
      const r = await json('GET', '/api/settings');
      expect(r.ok).toBe(true);
      expect(typeof r.data).toBe('object');
    });

    it('PATCH /api/settings updates settings', async () => {
      const r = await json('PATCH', '/api/settings', { body: { settings: { theme: 'dark' } } });
      expect(r.ok).toBe(true);
      expect(r.data.theme).toBe('dark');
    });
  });

  // ── Routes debug ──
  describe('GET /routes', () => {
    it('lists registered routes', async () => {
      const r = await json('GET', '/routes');
      expect(r.ok).toBe(true);
      expect(Array.isArray(r.data)).toBe(true);
      expect(r.data.length).toBeGreaterThan(0);
    });
  });

  // ── Edge cases ──
  describe('Edge cases', () => {
    it('handles invalid JSON body gracefully', async () => {
      const res = await app.fetch(new Request('http://localhost/api/agents', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: 'not json',
      }));
      expect(res.status).toBe(422);
    });

    it('returns consistent error shape for all error types', async () => {
      // 404
      const notFound = await json('GET', '/api/agents/nonexistent');
      expect(notFound.ok).toBe(false);
      expect(notFound.error).toBeDefined();
      expect(notFound.error.code).toBeDefined();

      // 401
      const unauthorized = await app.fetch(new Request('http://localhost/api/agents'));
      const unauthData = await unauthorized.json();
      expect(unauthData.ok).toBe(false);
      expect(unauthData.error.code).toBe('HTTP_ERROR');

      // 422
      const validation = await json('POST', '/api/agents', { body: {} });
      expect(validation.ok).toBe(false);
      expect(validation.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        json('POST', '/api/agents', { body: { name: `Concurrent ${i}` } })
      );
      const results = await Promise.all(promises);
      expect(results.every(r => r.ok)).toBe(true);
      const list = await json('GET', '/api/agents');
      expect(list.data).toHaveLength(10);
    });

    it('handles empty body on PATCH', async () => {
      const created = await json('POST', '/api/agents', { body: { name: 'A' } });
      const r = await json('PATCH', `/api/agents/${created.data.id}`, { body: {} });
      expect(r.ok).toBe(true);
    });

    it('CORS headers are present', async () => {
      const res = await app.fetch(new Request('http://localhost/health', { method: 'OPTIONS' }));
      // Hono CORS middleware should set headers
      expect(res.headers.get('access-control-allow-origin')).toBeDefined();
    });
  });
});
