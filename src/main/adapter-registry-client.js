'use strict';

/* global fetch */

const logger = require('./logger');

/**
 * Client for the community adapter registry.
 * Fetches adapter metadata and tarballs from a remote registry endpoint.
 */
class RemoteRegistryClient {
  /**
   * @param {object} opts
   * @param {string} opts.registryUrl — base URL of the registry (e.g. https://registry.agentops.dev)
   * @param {number} opts.timeoutMs — request timeout in ms
   */
  constructor(opts = {}) {
    this.registryUrl = (opts.registryUrl || 'https://registry.agentops.dev').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs || 15000;
  }

  /**
   * Search for adapters in the remote registry.
   * @param {string} query
   * @param {object} opts — { limit, offset, keywords }
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async search(query, opts = {}) {
    const params = new URLSearchParams({ q: query });
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.offset) params.set('offset', String(opts.offset));
    if (opts.keywords) params.set('keywords', opts.keywords.join(','));

    return this._get(`/v1/adapters/search?${params}`);
  }

  /**
   * Get full metadata for a specific adapter.
   * @param {string} name — adapter package name
   * @returns {Promise<object>}
   */
  async get(name) {
    return this._get(`/v1/adapters/${encodeURIComponent(name)}`);
  }

  /**
   * Get all versions for an adapter.
   * @param {string} name
   * @returns {Promise<{ versions: object[] }>}
   */
  async getVersions(name) {
    return this._get(`/v1/adapters/${encodeURIComponent(name)}/versions`);
  }

  /**
   * Download an adapter tarball. Returns a Buffer.
   * @param {string} name
   * @param {string} version
   * @returns {Promise<Buffer>}
   */
  async download(name, version) {
    const url = `${this.registryUrl}/v1/adapters/${encodeURIComponent(name)}/download/${encodeURIComponent(version)}`;
    const res = await this._fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Download failed (${res.status}): ${body}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Get featured/popular adapters.
   * @param {object} opts — { limit }
   * @returns {Promise<{ items: object[] }>}
   */
  async featured(opts = {}) {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return this._get(`/v1/adapters/featured${qs ? `?${qs}` : ''}`);
  }

  /** @private */
  async _get(path) {
    const url = `${this.registryUrl}${path}`;
    const res = await this._fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Registry request failed (${res.status}): ${body}`);
    }
    return res.json();
  }

  /** @private */
  async _fetch(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      logger.debug('registry.fetch', { url });
      return await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'AgentOps/1.0' },
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Registry request timed out after ${this.timeoutMs}ms: ${url}`);
      }
      throw new Error(`Registry request failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { RemoteRegistryClient };
