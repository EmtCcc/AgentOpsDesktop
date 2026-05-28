'use strict';

const { spawn } = require('child_process');
const { AgentAdapter } = require('../adapter-registry');

/**
 * Generic CLI adapter — reference implementation.
 * Spawns any CLI executable as an agent process.
 *
 * Config:
 *   execPath  — path or command name (required)
 *   args      — default arguments array
 *   cwd       — working directory
 *   env       — extra environment variables
 *   timeoutMs — optional kill-after timeout (default: 300000 = 5min)
 */
class GenericCliAdapter extends AgentAdapter {
  constructor(config = {}) {
    super(config);
    this.name = config.name || 'generic-cli';
    this.execPath = config.execPath;
    this.defaultArgs = config.args || [];
    this.defaultCwd = config.cwd || process.cwd();
    this.defaultEnv = config.env || {};
    this.timeoutMs = config.timeoutMs || 300_000;
    /** @type {Map<string, import('child_process').ChildProcess>} */
    this.instances = new Map();
  }

  async spawn(params = {}) {
    if (!this.execPath) throw new Error('execPath is required');

    const instanceId = params.instanceId || `${this.type}-${Date.now()}`;
    const args = params.args || this.defaultArgs;
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
    const proc = this.instances.get(instanceId);
    if (!proc) throw new Error(`Instance not found: ${instanceId}`);
    proc.kill('SIGTERM');
    // Force kill after 5s
    const timer = setTimeout(() => {
      try { if (!proc.killed) proc.kill('SIGKILL'); } catch { /* ignore */ }
    }, 5000);
    timer.unref();
    proc.on('close', () => clearTimeout(timer));
  }

  async healthCheck() {
    if (!this.execPath) return { ok: false, error: 'execPath not configured' };
    return new Promise((resolve) => {
      const proc = spawn('which', [this.execPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let _out = '';
      proc.stdout.on('data', (d) => { _out += d; });
      proc.on('close', (code) => {
        if (code === 0) resolve({ ok: true });
        else resolve({ ok: false, error: `Executable not found: ${this.execPath}` });
      });
      proc.on('error', () => resolve({ ok: false, error: `Cannot check: ${this.execPath}` }));
    });
  }

  async execute(task) {
    const args = [...this.defaultArgs];
    if (task.description) args.push(task.description);

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
      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

module.exports = GenericCliAdapter;
