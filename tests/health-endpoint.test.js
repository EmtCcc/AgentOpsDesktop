import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/main/api/app.js';

describe('GET /health — HTTP endpoint', () => {
  let app;

  beforeAll(() => {
    const mockRepos = {
      agents: {
        db: {
          prepare: () => ({ get: () => ({}) }),
        },
      },
    };
    const mockTokenManager = {
      createSession: () => ({ token: 't', role: 'admin', expiresAt: Date.now() + 3600000 }),
      validate: () => true,
      verifyToken: () => ({ role: 'admin' }),
      getSessionInfo: () => ({ role: 'admin', isValid: true }),
      destroySession: () => {},
    };
    app = createApp({ repos: mockRepos, tokenManager: mockTokenManager });
  });

  it('returns 200 with health payload', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('ts');
    expect(body).toHaveProperty('uptimeMs');
    expect(body).toHaveProperty('memory');
    expect(body).toHaveProperty('system');
    expect(body).toHaveProperty('ipc');
    expect(body).toHaveProperty('renderer');
    expect(body).toHaveProperty('app');
    expect(body).toHaveProperty('db');
    expect(body).toHaveProperty('alerts');
  });

  it('does not require authentication', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('returns db ok when database is reachable', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.db.ok).toBe(true);
  });

  it('returns valid version string', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(typeof body.version).toBe('string');
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns valid ISO timestamp', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(new Date(body.ts).toISOString()).toBe(body.ts);
  });

  it('returns non-negative uptime', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns memory usage object', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.memory).toHaveProperty('rss');
    expect(body.memory).toHaveProperty('heapUsed');
    expect(body.memory).toHaveProperty('heapTotal');
    expect(body.memory).toHaveProperty('external');
  });

  it('returns alerts as an array', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('returns status classification consistent with alerts', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    const validStatuses = ['ok', 'degraded', 'unhealthy'];
    expect(validStatuses).toContain(body.status);

    if (body.status === 'ok') {
      expect(body.alerts).toHaveLength(0);
    }
    if (body.status === 'unhealthy') {
      expect(body.alerts.some((a) => a.severity === 'error')).toBe(true);
    }
  });

  it('returns 503 when db is unreachable', async () => {
    const brokenRepos = {
      agents: {
        db: {
          prepare: () => {
            throw new Error('SQLITE_ERROR: no such table');
          },
        },
      },
    };
    const mockTokenManager = {
      createSession: () => ({ token: 't', role: 'admin', expiresAt: Date.now() + 3600000 }),
      validate: () => true,
      verifyToken: () => ({ role: 'admin' }),
      getSessionInfo: () => ({ role: 'admin', isValid: true }),
      destroySession: () => {},
    };
    const brokenApp = createApp({ repos: brokenRepos, tokenManager: mockTokenManager });

    const res = await brokenApp.request('/health');
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.db.ok).toBe(false);
    expect(body.db.error).toContain('SQLITE_ERROR');
    expect(body.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'db_unreachable', severity: 'error' }),
      ])
    );
  });

  it('returns uptime stats with percentage and breakdown', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.uptime).toBeDefined();
    expect(typeof body.uptime.uptimePercent).toBe('number');
    expect(body.uptime.uptimePercent).toBeGreaterThanOrEqual(0);
    expect(body.uptime.uptimePercent).toBeLessThanOrEqual(100);
    expect(body.uptime).toHaveProperty('totalUptimeMs');
    expect(body.uptime).toHaveProperty('totalDowntimeMs');
    expect(body.uptime).toHaveProperty('breakdown');
    expect(body.uptime.breakdown).toHaveProperty('okMs');
    expect(body.uptime.breakdown).toHaveProperty('degradedMs');
    expect(body.uptime.breakdown).toHaveProperty('unhealthyMs');
    expect(body.uptime).toHaveProperty('lastStatusChange');
    expect(body.uptime).toHaveProperty('lastStatusChangeAt');
    expect(Array.isArray(body.uptime.transitions)).toBe(true);
  });

  it('returns Content-Type application/json', async () => {
    const res = await app.request('/health');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
