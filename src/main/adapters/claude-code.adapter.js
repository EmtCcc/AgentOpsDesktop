'use strict';

const { spawn } = require('child_process');
const { AgentAdapter } = require('../adapter-registry');
const ClaudeCodeStreamParser = require('../parsers/claude-code-stream.parser');

/**
 * Claude Code 专用适配器。
 *
 * Wraps the `claude` CLI with:
 *   - stream-json output parsing (NDJSON typed events)
 *   - session resumption via --resume
 *   - MCP config injection via --mcp-config
 *   - model selection via --model
 *
 * Config:
 *   execPath     — path to claude binary (default: 'claude')
 *   args         — extra CLI arguments
 *   cwd          — working directory
 *   env          — extra environment variables
 *   timeoutMs    — kill-after timeout (default: 600000 = 10min)
 *   model        — model override (e.g. 'claude-sonnet-4-6')
 *   mcpConfig    — path to MCP config JSON file
 *   sessionId    — resume an existing session
 *   maxTurns     — max conversation turns (default: 10)
 *   permissionMode — permission mode: 'default', 'plan', 'auto-edit', 'bypass-permissions' (default: 'default')
 */
class ClaudeCodeAdapter extends AgentAdapter {
  static _seq = 0;

  constructor(config = {}) {
    super(config);
    this.name = config.name || 'claude-code';
    this.type = config.type || 'claude-code';
    this.execPath = config.execPath || 'claude';
    this.defaultArgs = config.args || [];
    this.defaultCwd = config.cwd || process.cwd();
    this.defaultEnv = config.env || {};
    this.timeoutMs = config.timeoutMs ?? 600_000;
    this.model = config.model || null;
    this.mcpConfig = config.mcpConfig || null;
    this.sessionId = config.sessionId || null;
    this.maxTurns = config.maxTurns ?? 10;
    this.permissionMode = config.permissionMode || 'default';

    /** @type {Map<string, { proc: import('child_process').ChildProcess, parser: ClaudeCodeStreamParser }>} */
    this.instances = new Map();
  }

  /**
   * Build the CLI argument array for a spawn.
   */
  _buildArgs(params = {}) {
    // Allow full args override (for testing / custom invocations)
    if (params.args) return params.args;

    const args = [...this.defaultArgs];

    // Always use stream-json for structured output
    args.push('--output-format', 'stream-json');

    // Print mode: non-interactive, single prompt, exit after
    args.push('-p');

    // Model selection
    const model = params.model || this.model;
    if (model) args.push('--model', model);

    // Max turns
    const maxTurns = params.maxTurns ?? this.maxTurns;
    if (maxTurns !== null) args.push('--max-turns', String(maxTurns));

    // Session resumption
    const sessionId = params.sessionId || this.sessionId;
    if (sessionId) args.push('--resume', sessionId);

    // MCP config injection
    const mcpConfig = params.mcpConfig || this.mcpConfig;
    if (mcpConfig) args.push('--mcp-config', mcpConfig);

    // Permission mode
    const permMode = params.permissionMode || this.permissionMode;
    if (permMode && permMode !== 'default') {
      args.push('--permission-mode', permMode);
    }

    // The prompt/task description goes last
    if (params.task?.description) {
      args.push(params.task.description);
    } else if (params.description) {
      args.push(params.description);
    }

    return args;
  }

  async spawn(params = {}) {
    const instanceId = params.instanceId || `claude-code-${Date.now()}-${++ClaudeCodeAdapter._seq}`;
    const args = this._buildArgs(params);
    const cwd = params.cwd || this.defaultCwd;
    const env = { ...process.env, ...this.defaultEnv, ...(params.env || {}) };

    const proc = spawn(this.execPath, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const parser = new ClaudeCodeStreamParser();

    // Pipe stdout through the parser
    proc.stdout.on('data', (chunk) => {
      parser.parse(chunk.toString());
    });

    this.instances.set(instanceId, { proc, parser });
    this.status = 'running';

    proc.on('close', (code) => {
      parser.flush();
      this.instances.delete(instanceId);
      if (this.instances.size === 0) this.status = 'idle';
      this.emit('exit', {
        instanceId,
        code,
        sessionInfo: parser.getSessionInfo(),
      });
    });

    proc.on('error', (err) => {
      this.emit('error', { instanceId, error: err.message });
    });

    // Auto-kill after timeout
    if (this.timeoutMs > 0) {
      const timer = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch { /* already dead */ }
      }, this.timeoutMs);
      timer.unref();
      proc.on('close', () => clearTimeout(timer));
    }

    return { instanceId, pid: proc.pid };
  }

  async kill(instanceId) {
    const entry = this.instances.get(instanceId);
    if (!entry) throw new Error(`Instance not found: ${instanceId}`);
    entry.proc.kill('SIGTERM');
    const timer = setTimeout(() => {
      try { if (!entry.proc.killed) entry.proc.kill('SIGKILL'); } catch { /* ignore */ }
    }, 5000);
    timer.unref();
    entry.proc.on('close', () => clearTimeout(timer));
  }

  async healthCheck() {
    return new Promise((resolve) => {
      const proc = spawn(this.execPath, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      proc.stdout.on('data', (d) => { out += d; });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true, version: out.trim() });
        } else {
          resolve({ ok: false, error: `claude CLI exited with code ${code}` });
        }
      });
      proc.on('error', () => {
        resolve({ ok: false, error: `Executable not found: ${this.execPath}` });
      });
    });
  }

  async execute(task) {
    const args = this._buildArgs({ task });

    return new Promise((resolve, reject) => {
      const proc = spawn(this.execPath, args, {
        cwd: this.defaultCwd,
        env: { ...process.env, ...this.defaultEnv },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const parser = new ClaudeCodeStreamParser();
      let _stderr = '';

      proc.stdout.on('data', (d) => { parser.parse(d.toString()); });
      proc.stderr.on('data', (d) => { _stderr += d; });

      proc.on('close', (code) => {
        parser.flush();
        const info = parser.getSessionInfo();
        resolve({
          output: info.fullText || info.sessionId || '',
          exitCode: code ?? 1,
          sessionId: info.sessionId,
          model: info.model,
          costUsd: info.costUsd,
        });
      });
      proc.on('error', (err) => reject(err));
    });
  }

  async sendInput(instanceId, data) {
    const entry = this.instances.get(instanceId);
    if (!entry) throw new Error(`Instance not found: ${instanceId}`);
    if (!entry.proc.stdin || entry.proc.stdin.destroyed) {
      throw new Error(`stdin not available for instance: ${instanceId}`);
    }
    return new Promise((resolve, reject) => {
      entry.proc.stdin.write(data, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  readStream(instanceId, stream = 'stdout') {
    const entry = this.instances.get(instanceId);
    if (!entry) throw new Error(`Instance not found: ${instanceId}`);
    const s = entry.proc[stream];
    if (!s) throw new Error(`${stream} not available for instance: ${instanceId}`);
    return s;
  }

  async resumeSession(instanceId) {
    const entry = this.instances.get(instanceId);
    if (!entry) return { alive: false };
    if (entry.proc.killed || entry.proc.exitCode !== null) return { alive: false };
    return { alive: true, pid: entry.proc.pid, sessionId: entry.parser.sessionId };
  }

  getOutputParser() {
    return new ClaudeCodeStreamParser();
  }

  /**
   * Resume an existing Claude Code session by ID.
   * Spawns a new process with --resume and the given session ID.
   * @param {string} sessionId - The session ID to resume
   * @param {object} [params] - Additional spawn params
   * @returns {Promise<{ instanceId: string, pid: number }>}
   */
  async resume(sessionId, params = {}) {
    return this.spawn({ ...params, sessionId });
  }
}

module.exports = ClaudeCodeAdapter;
