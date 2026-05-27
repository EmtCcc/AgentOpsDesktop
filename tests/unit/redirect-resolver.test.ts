import { describe, it, expect } from 'vitest';
import { resolve, buildStaticMap, getGonePaths } from '../../src/renderer/redirect-resolver';

describe('resolve', () => {
  describe('301 redirects — static', () => {
    it('redirects /home to /', () => {
      expect(resolve('/home')).toEqual({ type: 'redirect', target: '/' });
    });

    it('redirects /overview to /', () => {
      expect(resolve('/overview')).toEqual({ type: 'redirect', target: '/' });
    });

    it('redirects /dashboard to /', () => {
      expect(resolve('/dashboard')).toEqual({ type: 'redirect', target: '/' });
    });

    it('redirects /agent to /agents', () => {
      expect(resolve('/agent')).toEqual({ type: 'redirect', target: '/agents' });
    });

    it('redirects /workers to /agents', () => {
      expect(resolve('/workers')).toEqual({ type: 'redirect', target: '/agents' });
    });

    it('redirects /issues to /tasks', () => {
      expect(resolve('/issues')).toEqual({ type: 'redirect', target: '/tasks' });
    });

    it('redirects /config to /settings', () => {
      expect(resolve('/config')).toEqual({ type: 'redirect', target: '/settings' });
    });

    it('redirects /pipelines to /workflows', () => {
      expect(resolve('/pipelines')).toEqual({ type: 'redirect', target: '/workflows' });
    });

    it('redirects /terminal to /logs', () => {
      expect(resolve('/terminal')).toEqual({ type: 'redirect', target: '/logs' });
    });
  });

  describe('301 redirects — parameterized', () => {
    it('redirects /agent/:id to /agents/:id', () => {
      expect(resolve('/agent/abc-123')).toEqual({
        type: 'redirect',
        target: '/agents/abc-123',
        params: { agentId: 'abc-123' },
      });
    });

    it('redirects /workers/:id to /agents/:id', () => {
      expect(resolve('/workers/xyz')).toEqual({
        type: 'redirect',
        target: '/agents/xyz',
        params: { agentId: 'xyz' },
      });
    });

    it('redirects /issues/:id to /tasks/:id', () => {
      expect(resolve('/issues/42')).toEqual({
        type: 'redirect',
        target: '/tasks/42',
        params: { taskId: '42' },
      });
    });

    it('redirects /workflow/:id to /workflows/:id', () => {
      expect(resolve('/workflow/pipeline-1')).toEqual({
        type: 'redirect',
        target: '/workflows/pipeline-1',
        params: { workflowId: 'pipeline-1' },
      });
    });

    it('redirects /pipelines/:id to /workflows/:id', () => {
      expect(resolve('/pipelines/deploy-prod')).toEqual({
        type: 'redirect',
        target: '/workflows/deploy-prod',
        params: { workflowId: 'deploy-prod' },
      });
    });
  });

  describe('410 Gone', () => {
    it('returns gone for /beta', () => {
      expect(resolve('/beta')).toEqual({ type: 'gone' });
    });

    it('returns gone for /admin', () => {
      expect(resolve('/admin')).toEqual({ type: 'gone' });
    });

    it('returns gone for /debug', () => {
      expect(resolve('/debug')).toEqual({ type: 'gone' });
    });

    it('returns gone for /marketplace', () => {
      expect(resolve('/marketplace')).toEqual({ type: 'gone' });
    });
  });

  describe('no match', () => {
    it('returns none for unknown paths', () => {
      expect(resolve('/unknown-path')).toEqual({ type: 'none' });
    });

    it('returns none for the canonical /agents path', () => {
      expect(resolve('/agents')).toEqual({ type: 'none' });
    });
  });
});

describe('buildStaticMap', () => {
  it('contains only non-parameterized entries', () => {
    const map = buildStaticMap();
    for (const key of Object.keys(map)) {
      expect(key).not.toContain(':');
    }
  });

  it('maps /home to /', () => {
    expect(buildStaticMap()['/home']).toBe('/');
  });

  it('maps /issues to /tasks', () => {
    expect(buildStaticMap()['/issues']).toBe('/tasks');
  });
});

describe('getGonePaths', () => {
  it('returns an array of strings', () => {
    const paths = getGonePaths();
    expect(Array.isArray(paths)).toBe(true);
    paths.forEach((p) => expect(typeof p).toBe('string'));
  });

  it('includes known gone paths', () => {
    expect(getGonePaths()).toContain('/beta');
    expect(getGonePaths()).toContain('/admin');
  });
});
