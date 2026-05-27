import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/main/api/app.js';

describe('API request validation', () => {
  let app;
  const authHeader = { Authorization: 'Bearer test-token' };
  const jsonHeaders = { ...authHeader, 'Content-Type': 'application/json' };

  beforeAll(() => {
    const mockRepos = {
      agents: {
        list: () => ({ items: [] }),
        getById: (id) => (id === 'abc' ? { id: 'abc', name: 'test' } : null),
        create: (d) => ({ id: 'new', ...d }),
        update: (id, d) => (id === 'abc' ? { id: 'abc', ...d } : null),
        delete: (id) => id === 'abc',
      },
      goals: {
        list: () => ({ items: [] }),
        getById: (id) => (id === 'g1' ? { id: 'g1', title: 'test' } : null),
        create: (d) => ({ id: 'gnew', ...d }),
        update: (id, d) => (id === 'g1' ? { id: 'g1', ...d } : null),
        delete: (id) => id === 'g1',
      },
      tasks: {
        list: () => ({ items: [] }),
        getById: (id) => (id === 't1' ? { id: 't1', title: 'test' } : null),
        create: (d) => ({ id: 'tnew', ...d }),
        update: (id, d) => (id === 't1' ? { id: 't1', ...d } : null),
        delete: (id) => id === 't1',
      },
      taskLogs: {
        list: () => [],
        append: (d) => ({ id: 'log1', ...d }),
      },
      settings: {
        getAll: () => ({}),
        update: (d) => d,
      },
    };
    const mockTokenManager = {
      createSession: ({ role }) => ({ token: 'test-token', role, expiresAt: Date.now() + 3600000 }),
      verifyToken: (t) => (t === 'test-token' ? { role: 'admin' } : null),
      getSessionInfo: () => ({ role: 'admin', isValid: true }),
      destroySession: () => {},
    };
    app = createApp({ repos: mockRepos, tokenManager: mockTokenManager });
  });

  describe('POST /api/agents — body validation', () => {
    it('rejects missing required name', async () => {
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.some(d => d.field === 'name')).toBe(true);
    });

    it('rejects name exceeding maxLength', async () => {
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name: 'x'.repeat(201) }),
      });
      expect(res.status).toBe(422);
    });

    it('rejects invalid enum value for type', async () => {
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name: 'ok', type: 'bogus' }),
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid body', async () => {
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name: 'agent-1', type: 'autonomous' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.name).toBe('agent-1');
    });

    it('rejects invalid JSON body', async () => {
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.details.some(d => d.field === 'body')).toBe(true);
    });
  });

  describe('PATCH /api/agents/:id — body validation', () => {
    it('rejects invalid status enum', async () => {
      const res = await app.request('/api/agents/abc', {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ status: 'invalid' }),
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid partial update', async () => {
      const res = await app.request('/api/agents/abc', {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ name: 'renamed' }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/agents — query validation', () => {
    it('rejects invalid status enum in query', async () => {
      const res = await app.request('/api/agents?status=bogus', {
        headers: authHeader,
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects limit exceeding max', async () => {
      const res = await app.request('/api/agents?limit=999', {
        headers: authHeader,
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid query params', async () => {
      const res = await app.request('/api/agents?status=running&limit=10&sortBy=name&sortOrder=asc', {
        headers: authHeader,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/goals — body validation', () => {
    it('rejects missing title', async () => {
      const res = await app.request('/api/goals', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid goal', async () => {
      const res = await app.request('/api/goals', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ title: 'Ship feature' }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/goals — query validation', () => {
    it('rejects invalid status', async () => {
      const res = await app.request('/api/goals?status=invalid', {
        headers: authHeader,
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid status', async () => {
      const res = await app.request('/api/goals?status=active', {
        headers: authHeader,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/tasks — body validation', () => {
    it('rejects missing title', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid task', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ title: 'Do thing', goalId: 'g1' }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/tasks — query validation', () => {
    it('rejects invalid status', async () => {
      const res = await app.request('/api/tasks?status=nonsense', {
        headers: authHeader,
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid status', async () => {
      const res = await app.request('/api/tasks?status=pending', {
        headers: authHeader,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/logs — body validation', () => {
    it('rejects missing message', async () => {
      const res = await app.request('/api/logs', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(422);
    });

    it('rejects invalid level enum', async () => {
      const res = await app.request('/api/logs', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ message: 'test', level: 'critical' }),
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid log entry', async () => {
      const res = await app.request('/api/logs', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ message: 'hello', level: 'info' }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/logs — query validation', () => {
    it('rejects limit exceeding max', async () => {
      const res = await app.request('/api/logs?limit=9999', {
        headers: authHeader,
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid query', async () => {
      const res = await app.request('/api/logs?limit=50&agentId=a1', {
        headers: authHeader,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/settings — body validation', () => {
    it('rejects missing settings object', async () => {
      const res = await app.request('/api/settings', {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(422);
    });

    it('accepts valid settings update', async () => {
      const res = await app.request('/api/settings', {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ settings: { theme: 'dark' } }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('error response shape', () => {
    it('returns structured 422 with details array', async () => {
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name: '', type: 'bad' }),
      });
      const body = await res.json();
      expect(res.status).toBe(422);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.status).toBe(422);
      expect(Array.isArray(body.error.details)).toBe(true);
      body.error.details.forEach(d => {
        expect(d).toHaveProperty('field');
        expect(d).toHaveProperty('message');
      });
    });
  });
});
