'use strict';

const { spawn } = require('child_process');
const { AgentAdapter } = require('../adapter-registry');
const { LineDelimitedJsonParser } = require('../parsers');

/**
 * Gemini CLI adapter.
 * Wraps Google's `gemini` CLI with model selection, large-context support,
 * and structured output parsing.
 *
 * Config:
 *   execPath  — path to gemini binary (default: 'gemini')
 *   model     — Gemini model ID (e.g. 'gemini-2.5-pro', 'gemini-2.5-flash')
 *   args      — additional default arguments
 *   cwd       — working directory
 *   env       — extra environment variables (GEMINI_API_KEY, etc.)
 *   timeoutMs — auto-kill timeout (default: 600000 = 10min, generous for large context)
 */
class GeminiCliAdapter extends AgentAdapter {
  static _seq = 0;

  constructor(config = {}) {
    super(config);
    this.name = config.name || 'gemini-cli';
    this.execPath = config.execPath || 'gemini';
    this.model = config.model || null;
    this.defaultArgs = config.args || [];
    this.defaultCwd = config.cwd || process.cwd();
    this.defaultEnv = config.env || {};
    this.timeoutMs = config.timeoutMs ?? 600_000;
    /** @type {Map<string, import('child_process').ChildProcess>} */
    this.instances = new Map();
  }

  _buildArgs(overrides = {}) {
    const args = [...this.defaultArgs];
    const model = overrides.model || this.model;
    if (model) args.push('--model', model);
    if (overrides.args) args.push(...overrides.args);
    return args;
  }

  async spawn(params = {}) {
    const instanceId = params.instanceId || `gemini-${Date.now()}-${++GeminiCliAdapter._seq}`;
    const args = this._buildArgs(params);
    const cwd = params.cwd || this.defaultCwd;
    const env = { ...process.env, ...this.defaultEnv, ...(params.env || {}) };

    const proc = spawn(this.execPath, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    this.instances.set(instanceId, proc);
    this.status = 'running';

    proc.on('close', (code) => {
      this.instances.delete(instanceId);
      if (this.instances.size === 0) this.status = 'idle';
      this.emit('exit', { instanceId, code });
    });

    proc.on('error', (err) => {
      this.emit('error', { instanceId, error: err.message });
    });

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
    const proc = this.instances.get(instanceId);
    if (!proc) throw new Error(`Instance not found: ${instanceId}`);
    proc.kill('SIGTERM');
    const timer = setTimeout(() => {
      try { if (!proc.killed) proc.kill('SIGKILL'); } catch { /* ignore */ }
    }, 5000);
    timer.unref();
    proc.on('close', () => clearTimeout(timer));
  }

  async healthCheck() {
    return new Promise((resolve) => {
      const proc = spawn('which', [this.execPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let _stderr = '';
      proc.stderr.on('data', (d) => { _stderr += d; });
      proc.on('close', (code) => {
        if (code === 0) resolve({ ok: true });
        else resolve({ ok: false, error: `Gemini CLI not found: ${this.execPath}` });
      });
      proc.on('error', () => resolve({ ok: false, error: `Cannot check: ${this.execPath}` }));
    });
  }

  async execute(task) {
    const args = this._buildArgs({ args: task.description ? [task.description] : [] });

    return new Promise((resolve, reject) => {
      const proc = spawn(this.execPath, args, {
        cwd: this.defaultCwd,
        env: { ...process.env, ...this.defaultEnv },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });

      proc.on('close', (code) => {
        resolve({ output: stdout || stderr, exitCode: code ?? 1 });
      });
      proc.on('error', (err) => reject(err));
    });
  }

  async sendInput(instanceId, data) {
    const proc = this.instances.get(instanceId);
    if (!proc) throw new Error(`Instance not found: ${instanceId}`);
    if (!proc.stdin || proc.stdin.destroyed) {
      throw new Error(`stdin not available for instance: ${instanceId}`);
    }
    return new Promise((resolve, reject) => {
      proc.stdin.write(data, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  readStream(instanceId, stream = 'stdout') {
    const proc = this.instances.get(instanceId);
    if (!proc) throw new Error(`Instance not found: ${instanceId}`);
    const s = proc[stream];
    if (!s) throw new Error(`${stream} not available for instance: ${instanceId}`);
    return s;
  }

  async resumeSession(instanceId) {
    const proc = this.instances.get(instanceId);
    if (!proc) return { alive: false };
    if (proc.killed || proc.exitCode !== null) return { alive: false };
    return { alive: true, pid: proc.pid };
  }

  getOutputParser() {
    return new LineDelimitedJsonParser();
  }
}

module.exports = GeminiCliAdapter;
