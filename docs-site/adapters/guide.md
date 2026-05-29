# Adapter Guide

Adapters are the bridge between AgentOps Desktop and CLI agents. Each adapter knows how to spawn, communicate with, and manage a specific type of agent process.

## Architecture

```
┌──────────────────┐     ┌───────────────────┐     ┌──────────────┐
│  AdapterRegistry │────►│   AgentAdapter    │────►│  CLI Agent   │
│                  │     │   (base class)    │     │  (process)   │
│  registerClass() │     │                   │     │              │
│  load()          │     │  spawn()          │     │  stdin/stdout│
│  unload()        │     │  kill()           │     │  stderr      │
│  healthCheck()   │     │  healthCheck()    │     │              │
│  listLoaded()    │     │  execute()        │     └──────────────┘
└──────────────────┘     └───────────────────┘
```

The registry manages adapter lifecycles. Each adapter class extends `AgentAdapter` and implements four core methods.

## Quick Start: Building a Custom Adapter

### 1. Extend the Base Class

```js
'use strict';

const { spawn } = require('child_process');
const { AgentAdapter } = require('../adapter-registry');

class MyAgentAdapter extends AgentAdapter {
  constructor(config = {}) {
    super(config);
    this.name = config.name || 'my-agent';
    this.execPath = config.execPath;
    this.instances = new Map();
  }

  async spawn(params = {}) {
    // Implement agent process spawning
  }

  async kill(instanceId) {
    // Implement agent process termination
  }

  async healthCheck() {
    // Implement reachability check
  }

  async execute(task) {
    // Implement task execution
  }
}

module.exports = MyAgentAdapter;
```

### 2. Implement `spawn()`

The `spawn()` method starts the agent process and returns an instance handle.

```js
async spawn(params = {}) {
  if (!this.execPath) throw new Error('execPath is required');

  const instanceId = params.instanceId || `${this.type}-${Date.now()}`;
  const args = params.args || [];
  const cwd = params.cwd || process.cwd();
  const env = { ...process.env, ...(params.env || {}) };

  const proc = spawn(this.execPath, args, {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  this.instances.set(instanceId, proc);
  this.status = 'running';

  // Handle process events
  proc.on('close', (code) => {
    this.instances.delete(instanceId);
    if (this.instances.size === 0) this.status = 'idle';
    this.emit('exit', { instanceId, code });
  });

  proc.on('error', (err) => {
    this.emit('error', { instanceId, error: err.message });
  });

  return { instanceId, pid: proc.pid };
}
```

### 3. Implement `kill()`

Gracefully terminate an agent instance.

```js
async kill(instanceId) {
  const proc = this.instances.get(instanceId);
  if (!proc) throw new Error(`Instance not found: ${instanceId}`);

  proc.kill('SIGTERM');

  // Force kill after 5 seconds if still alive
  const timer = setTimeout(() => {
    try { if (!proc.killed) proc.kill('SIGKILL'); } catch { /* already dead */ }
  }, 5000);
  timer.unref();
  proc.on('close', () => clearTimeout(timer));
}
```

### 4. Implement `healthCheck()`

Verify the agent executable is reachable.

```js
async healthCheck() {
  if (!this.execPath) return { ok: false, error: 'execPath not configured' };

  return new Promise((resolve) => {
    const proc = spawn('which', [this.execPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    proc.stdout.on('data', (d) => { output += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: `Executable not found: ${this.execPath}` });
    });
    proc.on('error', () => resolve({ ok: false, error: `Cannot check: ${this.execPath}` }));
  });
}
```

### 5. Implement `execute()`

Run a task and return the output.

```js
async execute(task) {
  const args = [task.description || task.title];

  return new Promise((resolve, reject) => {
    const proc = spawn(this.execPath, args, {
      cwd: this.defaultCwd,
      env: { ...process.env, ...this.defaultEnv },
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
```

## Registering Your Adapter

### Programmatic Registration

```js
const { AdapterRegistry } = require('./adapter-registry');
const MyAgentAdapter = require('./adapters/my-agent.adapter');

const registry = new AdapterRegistry();
registry.registerClass('my-agent', MyAgentAdapter);

const adapter = registry.load('my-agent', {
  execPath: '/usr/local/bin/my-agent',
  cwd: '/path/to/project',
});
```

### Config-Driven Registration

Adapters can be loaded from JSON configuration:

```js
const results = await registry.loadFromConfigs([
  {
    type: 'my-agent',
    classPath: './adapters/my-agent.adapter.js',
    config: {
      execPath: '/usr/local/bin/my-agent',
      cwd: '/path/to/project',
    },
  },
]);
// results: [{ type: 'my-agent', ok: true }]
```

## Events

Adapters extend `EventEmitter` and emit lifecycle events:

| Event | Payload | Description |
|-------|---------|-------------|
| `exit` | `{ instanceId, code }` | Agent process exited |
| `error` | `{ instanceId, error }` | Agent process error |

The registry also emits events:

| Event | Payload | Description |
|-------|---------|-------------|
| `adapter:loaded` | `{ type, id }` | Adapter instance created |
| `adapter:unloaded` | `{ type }` | Adapter instance destroyed |

## Reference Implementation

See `src/main/adapters/generic-cli.adapter.js` for a complete working example that spawns any CLI executable as an agent process.

Key features of the reference implementation:
- Configurable executable path, args, cwd, and environment variables
- Auto-kill after configurable timeout (default: 5 minutes)
- Multiple concurrent instances per adapter
- Clean SIGTERM → SIGKILL escalation

## Best Practices

1. **Always handle process cleanup** — kill child processes on adapter unload
2. **Emit events** — the UI relies on `exit` and `error` events for status updates
3. **Validate config** — throw early if required config (like `execPath`) is missing
4. **Use timeouts** — prevent zombie processes with configurable kill-after timers
5. **Keep it simple** — the adapter's job is spawn/kill/check, not business logic
