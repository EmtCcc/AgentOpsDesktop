import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/main/api/app.js';

describe('API Scaffold', () => {
  let app;

  beforeAll(() => {
    const mockRepos = {
      agents: { list: () => ({ items: [] }), getById: () => null, create: (d) => d, update: () => null, delete: () => false },
      goals: { list: () => ({ items: [] }), getById: () => null, create: (d) => d, update: () => null, delete: () => false },
      tasks: { list: () => ({ items: [] }), getById: () => null, create: (d) => d, update: () => null, delete: () => false },
      taskLogs: { list: () => [], append: (d) => d },
      settings: { getAll: () => ({}), update: (d) => d },
    };
    const mockTokenManager = {
      createSession: ({ role }) => ({ token: 'test-token', role, expiresAt: Date.now() + 3600000 }),
      validate: (t) => t === 'test-token',
      verifyToken: (t) => (t === 'test-token' ? { role: 'admin' } : null),
      getSessionInfo: () => ({ role: 'admin', isValid: true }),
      destroySession: () => {},
      rotateSession: () => ({ token: 'new-token', role: 'admin', expiresAt: Date.now() + 3600000 }),
    };
    app = createApp({ repos: mockRepos, tokenManager: mockTokenManager });
  });

  it('GET /health returns status ok with full health payload', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();

    // Core status — 'degraded' is valid when system-level warnings fire (memory, CPU)
    expect(['ok', 'degraded']).toContain(body.status);

    // Timestamp is valid ISO 8601
    expect(body.ts).toBeDefined();
    expect(new Date(body.ts).toISOString()).toBe(body.ts);

    // Uptime is a non-negative number
    expect(typeof body.uptimeMs).toBe('number');
    expect(body.uptimeMs).toBeGreaterThanOrEqual(0);

    // Memory fields
    expect(body.memory).toBeDefined();
    expect(typeof body.memory.rss).toBe('number');
    expect(body.memory.rss).toBeGreaterThan(0);
    expect(typeof body.memory.heapUsed).toBe('number');
    expect(body.memory.heapUsed).toBeGreaterThan(0);
    expect(typeof body.memory.heapTotal).toBe('number');
    expect(body.memory.heapTotal).toBeGreaterThan(0);

    // System fields
    expect(body.system).toBeDefined();
    expect(typeof body.system.totalMem).toBe('number');
    expect(body.system.totalMem).toBeGreaterThan(0);
    expect(typeof body.system.freeMem).toBe('number');
    expect(body.system.freeMem).toBeGreaterThanOrEqual(0);
    expect(typeof body.system.cpus).toBe('number');
    expect(body.system.cpus).toBeGreaterThan(0);
    expect(body.system.loadAvg).toHaveLength(3);

    // Alerts array
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('POST /auth/login returns a token', async () => {
    const res = await app.request('/auth/login', { method: 'POST', body: JSON.stringify({ role: 'admin' }), headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.token).toBe('test-token');
    expect(body.data.role).toBe('admin');
  });

  it('GET /auth/status returns session info', async () => {
    const res = await app.request('/auth/status');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('GET /routes returns route list', async () => {
    const res = await app.request('/routes');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/agents without auth returns 401', async () => {
    const res = await app.request('/api/agents');
    expect(res.status).toBe(401);
  });

  it('GET /api/agents with valid token returns data', async () => {
    const res = await app.request('/api/agents', { headers: { Authorization: 'Bearer test-token' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/goals with valid token returns data', async () => {
    const res = await app.request('/api/goals', { headers: { Authorization: 'Bearer test-token' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('GET /api/tasks with valid token returns data', async () => {
    const res = await app.request('/api/tasks', { headers: { Authorization: 'Bearer test-token' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('GET /api/stats/summary with valid token returns stats', async () => {
    const res = await app.request('/api/stats/summary', { headers: { Authorization: 'Bearer test-token' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.agents).toBeDefined();
    expect(body.data.tasks).toBeDefined();
    expect(body.data.goals).toBeDefined();
  });

  it('GET /api/settings with valid token returns settings', async () => {
    const res = await app.request('/api/settings', { headers: { Authorization: 'Bearer test-token' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await app.request('/nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
