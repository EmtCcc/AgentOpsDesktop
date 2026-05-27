/**
 * Redirect Resolver — AgentOps Desktop
 *
 * Resolves incoming paths against the redirect map.
 * Handles static redirects, parameterized patterns, and 410 Gone pages.
 */

import redirectData from './redirects.json';

interface RedirectResult {
  type: 'redirect' | 'gone' | 'none';
  target?: string;
  params?: Record<string, string>;
}

const redirects: Record<string, string> = redirectData.redirects;
const gone: string[] = redirectData.gone;

/**
 * Match a concrete path against a pattern that may contain `:param` segments.
 * Returns extracted params or null if no match.
 */
function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Apply extracted params to a target pattern (e.g. `/agents/:agentId`).
 */
function applyParams(target: string, params: Record<string, string>): string {
  return target.replace(/:(\w+)/g, (_, key) => params[key] ?? `:${key}`);
}

/**
 * Resolve a path against the redirect map.
 * - Checks gone list first (410).
 * - Checks exact static redirects (301).
 * - Checks parameterized pattern redirects (301 with param substitution).
 */
export function resolve(pathname: string): RedirectResult {
  // 1. Gone pages
  if (gone.includes(pathname)) {
    return { type: 'gone' };
  }

  // 2. Exact match
  if (redirects[pathname]) {
    const target = redirects[pathname];
    // If target contains query-style substitution (e.g. "/logs?agent=:agentId")
    if (target.includes('=:')) {
      const [base, query] = target.split('?');
      const [key, paramRef] = query.split('=');
      const paramName = paramRef.replace(':', '');
      // Extract from source — for now only handle simple /segment/:param → /base?key=:param
      const srcParts = pathname.split('/');
      const lastSeg = srcParts[srcParts.length - 1];
      return { type: 'redirect', target: `${base}?${key}=${lastSeg}` };
    }
    return { type: 'redirect', target };
  }

  // 3. Parameterized pattern match
  for (const [pattern, target] of Object.entries(redirects)) {
    if (!pattern.includes(':')) continue;
    const params = matchPattern(pattern, pathname);
    if (params) {
      return { type: 'redirect', target: applyParams(target, params), params };
    }
  }

  return { type: 'none' };
}

/**
 * Build a flat redirect map (alias → canonical) for simple router integration.
 * Only includes static redirects (no parameterized patterns).
 */
export function buildStaticMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [old, canonical] of Object.entries(redirects)) {
    if (!old.includes(':')) {
      map[old] = canonical;
    }
  }
  return map;
}

/**
 * Return the full list of gone paths for 410 handling.
 */
export function getGonePaths(): string[] {
  return [...gone];
}
