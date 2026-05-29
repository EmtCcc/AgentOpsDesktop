'use strict';

const { spawn } = require('child_process');
const { AgentAdapter } = require('../adapter-registry');
const { LineDelimitedJsonParser } = require('../parsers');

/**
 * Adapter for OpenAI Codex CLI.
 *
 * Config:
 *   execPath       — codex binary path (default: 'codex')
 *   apiKey         — OpenAI API key (sets OPENAI_API_KEY env)
 *   model          — model override (e.g. 'o3', 'o4-mini')
 *   sandboxMode    — 'suggest' | 'auto-edit' | 'full-auto' (default: 'suggest')
 *   approvalPolicy — explicit approval policy string
 *   cwd            — working directory
 *   env            — extra environment variables
 *   timeoutMs      — kill-after timeout (default: 600000 = 10min)
 */
class CodexAdapter extends AgentAdapter {
  static _seq = 0;

  constructor(config = {}) {
    super(config);
    this.name = config.name || 'codex';
    this.execPath = config.execPath || 'codex';
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.sandboxMode = config.sandboxMode || 'suggest';
    this.approvalPolicy = config.approvalPolicy;
    this.defaultCwd = config.cwd || process.cwd();
    this.defaultEnv = config.env || {};
    this.timeoutMs = config.timeoutMs ?? 600_000;
    /** @type {Map<string, import('child_process').ChildProcess>} */
    this.instances = new Map();
  }

  _buildEnv(paramsEnv = {}) {
    const env = { ...process.env, ...this.defaultEnv, ...paramsEnv };
    if (this.apiKey) env.OPENAI_API_KEY = this.apiKey;
    return env;
  }

  _buildBaseArgs() {
    const args = [];
    if (this.model) args.push('--model', this.model);
    if (this.sandboxMode === 'full-auto') args.push('--full-auto');
    else if (this.sandboxMode === 'auto-edit') args.push('--auto-edit');
    if (this.approvalPolicy) args.push('--approval-policy', this.approvalPolicy);
    args.push('--quiet');
    return args;
  }

  async spawn(params = {}) {
    const instanceId = params.instanceId || `codex-${Date.now()}-${++CodexAdapter._seq}`;
    const args = [...this._buildBaseArgs(), ...(params.args || [])];
    const cwd = params.cwd || this.defaultCwd;
    const env = this._buildEnv(params.env);

    const proc = spawn(this.execPath, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });

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
      const proc = spawn(this.execPath, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this._buildEnv(),
      });
      let out = '';
      proc.stdout.on('data', (d) => { out += d; });
      proc.stderr.on('data', (d) => { out += d; });
      proc.on('close', (code) => {
        if (code === 0) {
          const checks = { cli: true, apiKey: !!this.apiKey || !!process.env.OPENAI_API_KEY };
          resolve({ ok: true, version: out.trim(), checks });
        } else {
          resolve({ ok: false, error: `codex exited ${code}: ${out.trim()}` });
        }
      });
      proc.on('error', () => resolve({ ok: false, error: `Executable not found: ${this.execPath}` }));
    });
  }

  async execute(task) {
    const prompt = task.description || task.prompt || task.title || '';
    const args = [...this._buildBaseArgs(), prompt];

    return new Promise((resolve, reject) => {
      const proc = spawn(this.execPath, args, {
        cwd: this.defaultCwd,
        env: this._buildEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
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

module.exports = CodexAdapter;
