# Adapter Contribution Guide

> How to build, test, and register a new CLI adapter for AgentOps Desktop.

## Overview

AgentOps Desktop is agent-agnostic — any CLI tool can be integrated as an agent through an **adapter**. Adapters implement a standard interface (`AgentAdapter`) and are managed by the `AdapterRegistry` at runtime.

```
AdapterRegistry
  ├─ registerClass('my-agent', MyAdapter)   ← one-time class registration
  ├─ load('my-agent', { execPath: ... })    ← instantiate with config
  ├─ get('my-agent')                        ← retrieve live instance
  └─ unload('my-agent')                     ← teardown
```

## The AgentAdapter Interface

Every adapter extends `AgentAdapter` (from `src/main/adapter-registry.js`) and implements four methods:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `spawn` | `async spawn(params) → { instanceId, pid }` | Start the agent process |
| `kill` | `async kill(instanceId) → void` | Terminate a running instance |
| `healthCheck` | `async healthCheck() → { ok, error? }` | Verify the adapter is functional |
| `execute` | `async execute(task) → { output, exitCode }` | Run a one-shot task |

### Base Class Properties

Set automatically by the constructor — override in yours if needed:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | random UUID | Unique adapter instance ID |
| `name` | `string` | `'unnamed'` | Human-readable name |
| `type` | `string` | `'custom'` | Registry key (set by registry on load) |
| `status` | `string` | `'idle'` | `'idle'` or `'running'` |
| `config` | `object` | `{}` | Raw config passed to constructor |

### Events

`AgentAdapter` extends `EventEmitter`. Emit these events for the runtime to track:

| Event | Payload | When |
|-------|---------|------|
| `'exit'` | `{ instanceId, code }` | Process exits (expected or killed) |
| `'error'` | `{ instanceId, error }` | Process fails to start or encounters an error |

## Step-by-Step: Creating a New Adapter

### 1. Create the adapter file

Place it in `src/main/adapters/` with the naming convention `<name>.adapter.js`.

### 2. Implement the four methods

Use `GenericCliAdapter` (`src/main/adapters/generic-cli.adapter.js`) as your reference. Key patterns:

- **spawn**: create the child process, store a handle, emit `'exit'`/`'error'`, return `{ instanceId, pid }`
- **kill**: look up the handle, send SIGTERM, force-kill after a grace period
- **healthCheck**: verify the executable exists and can respond (non-throwing, return `{ ok, false, error }` on failure)
- **execute**: run a one-shot command, capture stdout/stderr, return `{ output, exitCode }`

### 3. Register with the registry

```js
const { AdapterRegistry } = require('./adapter-registry');
const MyAdapter = require('./adapters/my-agent.adapter');

const registry = new AdapterRegistry();
registry.registerClass('my-agent', MyAdapter);

// Later, load with config:
const adapter = registry.load('my-agent', {
  execPath: '/usr/local/bin/my-agent',
  args: ['--mode', 'interactive'],
  cwd: '/path/to/workspace',
  env: { MY_API_KEY: '...' },
  timeoutMs: 300_000,
});
```

### 4. Write tests

Use the CLI adapter test harness (see below).

### 5. Add to docs/README.md

Add a row to the adapters table so others can discover your adapter.

## Starter Template

Copy this as `src/main/adapters/<your-name>.adapter.js`:

```js
'use strict';

const { spawn } = require('child_process');
const { AgentAdapter } = require('../adapter-registry');

/**
 * Adapter for <Your CLI Tool>.
 *
 * Config:
 *   execPath  — path or command name (required)
 *   args      — default arguments array
 *   cwd       — working directory
 *   env       — extra environment variables
 *   timeoutMs — kill-after timeout in ms (default: 300000)
 */
class MyAgentAdapter extends AgentAdapter {
  static _seq = 0;

  constructor(config = {}) {
    super(config);
    this.name = config.name || 'my-agent';
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

    const instanceId = params.instanceId || `${this.type}-${Date.now()}-${++MyAgentAdapter._seq}`;
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

module.exports = MyAgentAdapter;
```

Customize the template by:
- Changing the class name and default `name`
- Adjusting `spawn()` for tools that need stdin interaction, PTY, or WebSocket
- Adjusting `execute()` to map `task.description` to the tool's argument format
- Adding tool-specific config fields in the constructor

## Testing Requirements

All adapters **must** pass the CLI adapter test harness. The harness validates all four interface methods plus lifecycle behavior.

### Using the Test Harness

The harness lives in `tests/adapter-cli-harness.test.js`. To test your adapter:

1. **Create a test file** at `tests/adapter-<name>.test.js`

2. **Copy the harness structure**, replacing `createAdapter()`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { default: MyAgentAdapter } = await import('../src/main/adapters/my-agent.adapter.js');

// Use the mock CLI for testing, or point to your tool's actual binary
const MOCK_CLI = join(__dirname, 'fixtures', 'mock-cli.js');
const NODE = process.execPath;

function createAdapter(overrides = {}) {
  return new MyAgentAdapter({
    execPath: NODE,
    args: [MOCK_CLI],
    timeoutMs: 5000,
    ...overrides,
  });
}

describe('MyAgentAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = createAdapter();
  });

  afterEach(async () => {
    for (const [id] of adapter.instances) {
      try { await adapter.kill(id); } catch { /* already dead */ }
    }
  });

  // Test all four methods + lifecycle (see harness for full examples)
});
```

3. **Required test cases** (all must pass):

| Category | Tests |
|----------|-------|
| **spawn** | Returns `instanceId` + `pid`; accepts custom `instanceId`; emits `'exit'` on process end; cleans up instance map; throws without `execPath` |
| **kill** | Terminates running process; throws for unknown `instanceId`; handles double-kill |
| **healthCheck** | Returns `{ ok: true }` for valid executable; returns error for missing `execPath`; returns error for nonexistent executable |
| **execute** | Captures stdout + exit code; returns exit code 1 on failure; works with no description; passes config through to args |
| **lifecycle** | spawn → kill → re-spawn cycle; multiple concurrent instances; status transitions (idle → running → idle) |

4. **Run tests**:

```bash
npx vitest run tests/adapter-<name>.test.js
```

### Using the Mock CLI

The test fixture at `tests/fixtures/mock-cli.js` simulates a CLI agent:

| Flag | Behavior |
|------|----------|
| `--health` | Exit 0, print "ok" |
| `--fail` | Exit 1, print "mock failure" |
| `--hang` | Stay alive until SIGTERM |
| `--timeout N` | Exit after N ms |
| `[args...]` | Exit 0, echo args |
| *(no args)* | Exit 0, print "mock-cli ready" |

Use it to test your adapter without depending on the real CLI tool.

## Adapter Loading from Config

Adapters can be loaded from JSON/YAML config via `loadFromConfigs`:

```js
const results = await registry.loadFromConfigs([
  {
    type: 'my-agent',
    classPath: './adapters/my-agent.adapter.js',  // optional if already registered
    config: {
      execPath: '/usr/local/bin/my-agent',
      args: ['--mode', 'interactive'],
      timeoutMs: 300_000,
    },
  },
]);
```

## Checklist

Before submitting a PR with a new adapter:

- [ ] Extends `AgentAdapter`, implements all 4 methods
- [ ] Emits `'exit'` and `'error'` events
- [ ] Handles graceful shutdown (SIGTERM → SIGKILL fallback)
- [ ] `healthCheck` returns `{ ok: false, error }` on failure (never throws)
- [ ] `execute` returns `{ output, exitCode }` — never rejects on process failure
- [ ] Tests pass: `npx vitest run tests/adapter-<name>.test.js`
- [ ] Adapter file in `src/main/adapters/<name>.adapter.js`
- [ ] Test file in `tests/adapter-<name>.test.js`
- [ ] Added to `docs/README.md` adapters table
- [ ] Config options documented in JSDoc at top of file
