'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Paperclip API Client.
 *
 * Communicates with the Paperclip control plane for issue CRUD and governance.
 * Falls back to on-disk JSON files when the API is unreachable.
 *
 * Config resolution order:
 *  1. Explicit opts.baseUrl / opts.issuesDir
 *  2. Environment variables PAPERCLIP_BASE_URL / PAPERCLIP_ISSUES_DIR
 *  3. Default: http://127.0.0.1:3100 + ~/.paperclip/instances/default/issues
 */
class PaperclipClient {
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl || process.env.PAPERCLIP_BASE_URL || 'http://127.0.0.1:3100').replace(/\/+$/, '');
    this.issuesDir = opts.issuesDir || process.env.PAPERCLIP_ISSUES_DIR
      || path.join(process.env.HOME || '', '.paperclip', 'instances', 'default', 'issues');
    this.token = opts.token || process.env.PAPERCLIP_TOKEN || null;
    this._apiAvailable = null; // lazy-probed
    this._probeTimeout = null;
  }

  // ── HTTP helpers ──

  async _fetch(urlPath, options = {}) {
    const url = `${this.baseUrl}${urlPath}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 5000);

    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Paperclip API ${res.status}: ${body}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Probe API availability (cached for 60s).
   */
  async isApiAvailable() {
    if (this._apiAvailable !== null && Date.now() - (this._probeTimeout || 0) < 60_000) {
      return this._apiAvailable;
    }
    try {
      await this._fetch('/health', { timeout: 2000 });
      this._apiAvailable = true;
    } catch {
      this._apiAvailable = false;
    }
    this._probeTimeout = Date.now();
    return this._apiAvailable;
  }

  // ── Issue operations ──

  /**
   * Fetch issues. Prefers API; falls back to on-disk JSON files.
   * @param {Object} [filter]
   * @param {string} [filter.status] - Filter by status (e.g. 'todo', 'in_progress', 'done')
   * @param {string} [filter.assignee] - Filter by assignee agent id
   * @param {string} [filter.projectId] - Filter by project
   * @returns {Promise<Array<Object>>}
   */
  async listIssues(filter = {}) {
    const apiOk = await this.isApiAvailable();
    if (apiOk) {
      return this._listIssuesViaApi(filter);
    }
    return this._listIssuesFromDisk(filter);
  }

  async _listIssuesViaApi(filter) {
    try {
      // Try project-scoped listing first
      if (filter.projectId) {
        const data = await this._fetch(`/api/projects/${filter.projectId}/issues`);
        return this._filterIssues(Array.isArray(data) ? data : data.items || [], filter);
      }
      // Global issue list (if supported)
      const data = await this._fetch('/api/issues');
      return this._filterIssues(Array.isArray(data) ? data : data.items || [], filter);
    } catch (err) {
      logger.warn('PaperclipClient: API listIssues failed, falling back to disk', { error: err.message });
      return this._listIssuesFromDisk(filter);
    }
  }

  _listIssuesFromDisk(filter) {
    let issues = [];
    try {
      const files = fs.readdirSync(this.issuesDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(this.issuesDir, file), 'utf8');
          issues.push(JSON.parse(raw));
        } catch {
          // skip malformed
        }
      }
    } catch {
      // directory may not exist
    }
    return this._filterIssues(issues, filter);
  }

  _filterIssues(issues, filter) {
    return issues.filter((issue) => {
      if (filter.status && issue.status !== filter.status) return false;
      if (filter.assignee !== undefined) {
        const assignee = issue.assignee || issue.assignedTo || issue.agentId || null;
        if (filter.assignee === null && assignee) return false;
        if (filter.assignee !== null && assignee !== filter.assignee) return false;
      }
      return true;
    });
  }

  /**
   * Get unassigned todo issues — the primary input for auto-assign.
   * @returns {Promise<Array<Object>>}
   */
  async getUnassignedIssues() {
    // Try common status values for "unassigned todo"
    const candidates = await this.listIssues({ assignee: null });
    return candidates.filter((i) => {
      const s = (i.status || '').toLowerCase();
      return s === 'todo' || s === 'open' || s === 'pending' || s === 'in_progress' && !(i.assignee || i.assignedTo);
    });
  }

  /**
   * Assign an issue to an agent.
   * @param {string} issueId
   * @param {string} agentId
   * @param {Object} [meta] - Extra metadata (role, reason)
   * @returns {Promise<Object>} updated issue
   */
  async assignIssue(issueId, agentId, meta = {}) {
    const apiOk = await this.isApiAvailable();
    if (apiOk) {
      try {
        return await this._assignViaApi(issueId, agentId, meta);
      } catch (err) {
        logger.warn('PaperclipClient: API assign failed, falling back to disk', { error: err.message });
      }
    }
    return this._assignOnDisk(issueId, agentId, meta);
  }

  async _assignViaApi(issueId, agentId, meta) {
    // Try PATCH first
    try {
      return await this._fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          assignee: agentId,
          status: 'in_progress',
          ...meta.role && { ownerRole: meta.role },
        }),
      });
    } catch {
      // Fallback: checkout endpoint
      return await this._fetch(`/api/issues/${issueId}/checkout`, {
        method: 'POST',
        body: JSON.stringify({ agentId, ...meta }),
      });
    }
  }

  _assignOnDisk(issueId, agentId, meta) {
    const filePath = path.join(this.issuesDir, `${issueId}.json`);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const issue = JSON.parse(raw);
      issue.assignee = agentId;
      issue.status = 'in_progress';
      issue.assignedAt = new Date().toISOString();
      if (meta.role) issue.ownerRole = meta.role;
      if (meta.reason) issue.assignReason = meta.reason;
      fs.writeFileSync(filePath, JSON.stringify(issue, null, 2) + '\n');
      return issue;
    } catch (err) {
      logger.error('PaperclipClient: disk assign failed', { issueId, error: err.message });
      throw err;
    }
  }

  /**
   * Post a comment on an issue.
   * @param {string} issueId
   * @param {string} body
   * @returns {Promise<Object>}
   */
  async postComment(issueId, body) {
    const apiOk = await this.isApiAvailable();
    if (apiOk) {
      return this._fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    }
    // Disk fallback: append to issue JSON
    const filePath = path.join(this.issuesDir, `${issueId}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const issue = JSON.parse(raw);
    if (!issue.comments) issue.comments = [];
    issue.comments.push({ body, author: 'auto-assign', createdAt: new Date().toISOString() });
    fs.writeFileSync(filePath, JSON.stringify(issue, null, 2) + '\n');
    return { ok: true };
  }
}

module.exports = { PaperclipClient };
