# Threat Model — AgentOps Desktop

**Date**: 2026-05-28
**Methodology**: STRIDE
**Scope**: Implemented codebase (v0.1 Foundation phase)
**Owner**: Security Engineer
**Last reviewed**: 2026-05-28

---

## 1. System Overview

### Components

| Component | Trust Level | Status | Description |
|-----------|-------------|--------|-------------|
| **Renderer (HTML/JS)** | Low | Implemented | Static HTML + vanilla JS, CSP enforced via meta tag |
| **Main Process (Electron)** | High | Implemented | Node.js, IPC bridge, process management, monitoring |
| **Agent Runtime** | High | Implemented | Spawns CLI agents via `child_process.spawn` (no PTY yet) |
| **CLI Agents** | Critical | Placeholder | External binaries — Claude Code, Codex, Gemini CLI |
| **Paperclip Client** | Medium | Not implemented | REST client to external governance API |
| **SQLite** | Medium | Not implemented | Currently in-memory Map stores |
| **IPC Router** | Medium | Implemented | `IpcRouter` class with schema validation middleware |
| **Monitoring** | Medium | Implemented | Health checks, metrics, alert thresholds |

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│  User's Machine (OS-level trust boundary)               │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Electron App                                    │   │
│  │                                                  │   │
│  │  ┌────────────┐   IPC    ┌──────────────────┐   │   │
│  │  │  Renderer   │ ◄─────► │  Main Process     │   │   │
│  │  │  (CSP+ctx  │         │  (privileged)     │   │   │
│  │  │  isolation)│         │  ┌──────────────┐ │   │   │
│  │  └────────────┘         │  │ IpcRouter    │ │   │   │
│  │                         │  │ + validation │ │   │   │
│  │                         │  └──────────────┘ │   │   │
│  │                         └────────┬─────────┘   │   │
│  │                                   │             │   │
│  │                          ┌────────┼────────┐    │   │
│  │                          ▼        ▼        ▼    │   │
│  │                     ┌────────┐ ┌──────┐ ┌────┐ │   │
│  │                     │ Agent  │ │Paper-│ │ DB │ │   │
│  │                     │Runtime │ │clip  │ │(mem)│ │   │
│  │                     └───┬────┘ └──┬───┘ └────┘ │   │
│  └─────────────────────────┼─────────┼────────────┘   │
│                            ▼         ▼                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  │  OS Process Boundary                          │    │
│  │                                               │    │
│  │  ┌──────────┐                    ┌─────────┐  │    │
│  │  │ CLI      │                    │Paperclip│  │    │
│  │  │ Agents   │                    │ Server  │  │    │
│  │  │(untrust) │                    │(extern) │  │    │
│  │  └──────────┘                    └─────────┘  │    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
└─────────────────────────────────────────────────────────┘
```

**Boundary 1 — Renderer ↔ Main Process (IPC)**
- `contextIsolation: true`, `nodeIntegration: false` (verified in `src/main/index.js:39-40`)
- `contextBridge` in `preload.js` exposes minimal API surface
- CSP via meta tag: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`

**Boundary 2 — Main Process ↔ CLI Agents (OS process)**
- `child_process.spawn` with `shell: false` (verified in `agent.controller.js:163`)
- Exec path validated for existence and execute permission
- No sandboxing, chroot, namespace isolation, or resource limits

**Boundary 3 — Main Process ↔ Paperclip Server (Network)**
- Not yet implemented. Token storage mechanism TBD.

**Boundary 4 — Main Process ↔ In-Memory Store**
- Currently using `Map` objects. SQLite planned but not yet implemented.

### Data Flows

| Flow | Path | Sensitivity | Status |
|------|------|-------------|--------|
| User commands | Renderer → IPC → Main → Agent Runtime → CLI Agent | Medium | Implemented |
| Agent output (stdout/stderr) | CLI Agent → Agent Runtime → IPC → Renderer | High | Implemented |
| Agent config | Renderer → IPC → Main → in-memory Map | Medium | Implemented |
| Task/governance data | Main → Paperclip Client → Network | Medium | Not implemented |
| Paperclip API token | Storage → Main Process → Network | Critical | Not implemented |
| Audit events | Main → logger → JSONL file | Medium | Implemented |

---

## 2. Attack Surfaces

### 2.1 IPC Channels (Renderer → Main)

Verified channels via `preload.js`:

| Channel Group | Channels | Validation |
|---------------|----------|------------|
| `auth:*` | login, logout, status, rotate | Not implemented (placeholder) |
| `agents:*` | list, get, create, update, delete, health-check, spawn, status, kill | Schema validated |
| `goals:*` | list, get, create, update, delete | Schema validated |
| `tasks:*` | list, get, create, update, delete | Schema validated |
| `logs:*` | list, append, onNew | Schema validated |
| `stats:*` | summary | No schema |
| `monitor:*` | health | No schema |

**Verified mitigations**:
- `contextIsolation: true` prevents renderer from accessing Node.js APIs
- `contextBridge` exposes only defined methods — no raw `ipcRenderer` leakage
- `IpcRouter` validates payloads against declared schemas before handler invocation
- Validation includes type checking, enum constraints, string length limits, custom validators

**Remaining risks**:
- `strict` mode not enabled by default — extra fields in IPC payloads are silently ignored
- No rate limiting on IPC calls — a compromised renderer could flood handlers

### 2.2 Agent Output Ingestion

- Raw stdout/stderr stored in session logs array (`agent.controller.js:184-191`)
- No sanitization or parsing of terminal control sequences
- Potential vectors: ANSI escape injection, terminal title set attacks, hyperlink injection

### 2.3 Process Spawning

Verified in `agent.controller.js:152-217`:

| Check | Status |
|-------|--------|
| `shell: false` | Verified — prevents shell injection |
| Exec path validation | Verified — checks file exists + executable bit |
| `which` fallback | Verified — resolves bare commands to full paths |
| CWD restriction | **Not implemented** — accepts any path |
| Arg sanitization | **Not implemented** — raw array passthrough |
| Env var restriction | **Not implemented** — merges arbitrary env vars |
| Resource limits | **Not implemented** — no CPU/memory/time caps |
| Sandbox/chroot | **Not implemented** |

### 2.4 Electron Configuration

Verified in `src/main/index.js`:

| Setting | Value | Status |
|---------|-------|--------|
| `contextIsolation` | `true` | Secure |
| `nodeIntegration` | `false` | Secure |
| `preload` | Set via `path.join` | Secure |
| `webSecurity` | Default (`true`) | Secure |
| CSP | Meta tag in HTML | Present but `unsafe-inline` for styles |

### 2.5 CSP Analysis

Current policy in `index.html:6`:
```
default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; script-src 'self';
```

| Directive | Value | Assessment |
|-----------|-------|------------|
| `default-src` | `'self'` | Good |
| `script-src` | `'self'` | Good — blocks inline scripts |
| `style-src` | `'self' 'unsafe-inline'` | Acceptable for Electron (no remote styles) |
| `img-src` | `'self' data:` | Good |
| `font-src` | `'self'` | Good |
| `connect-src` | Not set (falls back to `default-src`) | Good — blocks external fetch |
| `object-src` | Not set (falls back to `default-src`) | Good |
| `base-uri` | Not set | Should add `'none'` |
| `frame-ancestors` | Not set | Should add `'none'` |

### 2.6 Authentication

- Auth middleware infrastructure exists in `IpcRouter` (`setAuthMiddleware()`)
- No auth middleware is actually configured — all routes run without authentication
- `auth:*` channels are placeholder stubs

### 2.7 Local Data Storage

- Currently in-memory `Map` objects — data lost on restart
- SQLite planned for `~/.agentops-desktop/data.db`
- No encryption at rest documented
- No credential storage mechanism implemented

---

## 3. STRIDE Threat Analysis

### S — Spoofing

| ID | Threat | Target | Likelihood | Impact | Risk | Mitigated? |
|----|--------|--------|------------|--------|------|------------|
| S-1 | Spoofed agent executable path | Agent Runtime | Medium | Critical | **High** | Partial — exec path validated for existence, not signature |
| S-2 | Spoofed Paperclip API token | Paperclip Client | Low | High | **Medium** | N/A — not implemented |
| S-3 | Forged IPC messages bypassing renderer CSP | Main Process | Low | Critical | **Medium** | Yes — `contextIsolation: true` prevents this |

**S-1**: Exec path validation (`agent.controller.js:52-70`) checks file exists and has execute permission. Does not verify binary integrity (no hash/signature check). A symlink or replaced binary would pass validation.

**S-3**: **Mitigated**. `contextIsolation: true` + `contextBridge` means the renderer cannot forge IPC messages outside the exposed API surface.

### T — Tampering

| ID | Threat | Target | Likelihood | Impact | Risk | Mitigated? |
|----|--------|--------|------------|--------|------|------------|
| T-1 | Agent modifies files outside its working directory | Filesystem | High | Critical | **Critical** | No |
| T-2 | Tampered agent output injected into UI | Renderer | Medium | Medium | **Medium** | No |
| T-3 | In-memory data tampering via IPC | Main Process | Low | Medium | **Low** | Partial — schema validation |
| T-4 | Workflow definition tampering | Workflow Engine | Low | High | **Medium** | N/A — not implemented |

**T-1**: CLI agents spawned with unrestricted filesystem access. `cwd` is configurable but not enforced — agent can `cd` anywhere. This remains the single highest-severity threat.

**T-2**: Agent stdout stored raw in session logs. No terminal escape sequence sanitization.

### R — Repudiation

| ID | Threat | Target | Likelihood | Impact | Risk | Mitigated? |
|----|--------|--------|------------|--------|------|------------|
| R-1 | Agent actions not attributable to specific task/agent | Audit trail | Medium | Medium | **Medium** | Partial |
| R-2 | No local audit log for agent filesystem changes | Filesystem | High | Medium | **High** | No |

**R-1**: Sessions tracked with UUID, spawn args, and timestamps. JSONL logger records events. But no structured correlation between agent actions and filesystem changes.

**R-2**: Agent controller logs stdout/stderr to session array. Logger writes JSONL. But no mechanism records what files the agent actually changed.

### I — Information Disclosure

| ID | Threat | Target | Likelihood | Impact | Risk | Mitigated? |
|----|--------|--------|------------|--------|------|------------|
| I-1 | Agent output contains secrets (API keys, tokens) | UI / Logs | High | Critical | **Critical** | No |
| I-2 | Paperclip API token leaked via logs | Network / Logs | Medium | Critical | **High** | N/A — not implemented |
| I-3 | Sensitive data in unencrypted storage | Local DB | Medium | Medium | **Medium** | N/A — in-memory only |
| I-4 | Agent reads sensitive files from user's filesystem | Filesystem | High | Critical | **Critical** | No |

**I-1**: Raw stdout/stderr streaming. Logger writes full content to JSONL files. No secret redaction.

**I-4**: Agents have unrestricted filesystem access via `spawn`. Can read `~/.ssh/`, `~/.aws/`, credential stores, etc.

### D — Denial of Service

| ID | Threat | Target | Likelihood | Impact | Risk | Mitigated? |
|----|--------|--------|------------|--------|------|------------|
| D-1 | Agent consumes excessive CPU/memory/disk | Host system | Medium | Medium | **Medium** | No |
| D-2 | Agent infinite loop blocks task queue | Workflow Engine | Medium | Medium | **Medium** | N/A — no task queue yet |
| D-3 | Excessive agent output floods renderer | UI | Medium | Low | **Low** | No |

**D-1**: No per-agent resource limits. No timeout on spawned processes (30-min timeout mentioned in architecture but not implemented).

### E — Elevation of Privilege

| ID | Threat | Target | Likelihood | Impact | Risk | Mitigated? |
|----|--------|--------|------------|--------|------|------------|
| E-1 | Renderer achieves Node.js access via IPC bypass | Main Process | Low | Critical | **Medium** | Yes — `contextIsolation` + `contextBridge` |
| E-2 | Agent exploits spawn to execute arbitrary OS commands | Host OS | High | Critical | **Critical** | Partial — `shell: false` blocks shell injection |
| E-3 | electron-updater installs unsigned/malicious update | Entire app | Low | Critical | **High** | Not verified |

**E-2**: `shell: false` prevents shell metacharacter injection. But `args` array is user-controlled and unsanitized — argument injection is possible. No sandboxing means agent runs with full user privileges.

**E-3**: `electron-updater` is a dependency. Code signing configuration exists in `package.json` (`afterSign: scripts/notarize.js`, `hardenedRuntime: true`). Signature verification by updater not explicitly verified.

---

## 4. Risk Summary

| Risk Level | Count | Threat IDs |
|------------|-------|------------|
| **Critical** | 3 | T-1, I-1, I-4, E-2 |
| **High** | 3 | S-1, R-2, E-3 |
| **Medium** | 7 | S-2, S-3, T-2, T-4, R-1, I-3, D-1, D-2 |
| **Low** | 2 | T-3, D-3 |

**Trend from initial model**: S-3 downgraded from High to Medium (mitigated by `contextIsolation`). E-1 downgraded from High to Medium (mitigated by `contextBridge`).

---

## 5. Verified Security Controls

| Control | Status | Evidence |
|---------|--------|----------|
| `contextIsolation: true` | Verified | `src/main/index.js:39` |
| `nodeIntegration: false` | Verified | `src/main/index.js:40` |
| `contextBridge` preload | Verified | `src/main/preload.js:3` |
| CSP (meta tag) | Verified | `src/renderer/index.html:6` |
| IPC schema validation | Verified | `src/main/ipc/middleware/validate.js` |
| `shell: false` on spawn | Verified | `src/main/ipc/controllers/agent.controller.js:163` |
| Exec path validation | Verified | `src/main/ipc/controllers/agent.controller.js:52-70` |
| Structured JSONL logging | Verified | `src/main/logger.js` |
| Health monitoring | Verified | `src/main/monitor.js` |
| Code signing config | Present | `package.json` build config |

---

## 6. Recommended Mitigations

### Critical — Must Address Before MVP

| ID | Mitigation | Threats | Status |
|----|------------|---------|--------|
| M-1 | **Agent sandboxing**: Run CLI agents in containers, chroot, or OS-level sandbox. At minimum, restrict filesystem access to designated working directory. | T-1, I-4, E-2 | Not started |
| M-2 | **Output sanitization**: Strip or escape terminal control sequences before rendering. Implement allow-list for ANSI codes. | T-2, I-1 | Not started |
| M-3 | **Secret redaction**: Scan agent output for patterns matching API keys, tokens, and credentials before displaying or persisting. | I-1, I-2 | Not started |
| M-4 | **Process timeout**: Implement spawn timeout (30 min default, configurable per agent). | D-1 | Not started |

### High — Should Address Before GA

| ID | Mitigation | Threats | Status |
|----|------------|---------|--------|
| M-5 | **Agent executable validation**: Verify binary hash/signature, not just existence. | S-1 | Not started |
| M-6 | **Token management**: Store Paperclip API token in OS keychain, not .env or SQLite. | I-2 | N/A — not implemented |
| M-7 | **Auto-update signing**: Verify electron-updater rejects unsigned updates. | E-3 | Config present, verification needed |
| M-8 | **Local audit log**: Record agent spawn events and file changes in tamper-evident log. | R-1, R-2 | Partial — JSONL logger exists |
| M-9 | **CWD enforcement**: Restrict agent working directory and reject path traversal. | T-1 | Not started |
| M-10 | **Arg sanitization**: Validate agent args array — reject shell metacharacters, null bytes. | E-2 | Not started |

### Medium — Plan for Post-MVP

| ID | Mitigation | Threats | Status |
|----|------------|---------|--------|
| M-11 | **Per-agent resource limits**: CPU, memory, disk I/O limits per agent process. | D-1, D-2 | Not started |
| M-12 | **SQLite encryption**: Use SQLCipher for encryption at rest. | I-3 | N/A — not implemented |
| M-13 | **CSP hardening**: Add `base-uri 'none'` and `frame-ancestors 'none'`. | S-3 | Not started |
| M-14 | **IPC rate limiting**: Throttle IPC calls per channel to prevent flooding. | D-3 | Not started |
| M-15 | **Strict IPC validation**: Enable `strict` mode to reject unknown fields. | T-3 | Not started |

---

## 7. Open Questions

1. **Agent sandboxing strategy**: What sandboxing mechanism will be used? This is the most critical architectural decision. (Same as initial model — still undecided.)
2. **Token storage**: Where will Paperclip API token be stored? (Not yet implemented.)
3. **PTY vs spawn**: Architecture mentions `node-pty` but current implementation uses `child_process.spawn`. Will PTY be added? PTY increases attack surface (terminal escape sequences, TTY hijacking).
4. **Auth model**: Auth middleware exists but is not configured. Will there be per-route auth? Local-only auth? None?
5. **Update verification**: Does `electron-updater` verify code signatures before installing? Need to verify `scripts/notarize.js` and updater config.

---

## 8. Delta from Initial Threat Model (2026-05-28)

| Area | Initial (Pre-Code) | Current (v0.1) | Change |
|------|-------------------|-----------------|--------|
| Electron security | Undocumented | Verified secure config | Improved |
| IPC validation | None | Schema-based validation | Improved |
| Process spawning | PTY planned | `spawn` with `shell: false` | Improved (no PTY yet) |
| Exec path validation | None | Exists + executable check | Improved |
| CSP | None | Present (meta tag) | Improved |
| Auth | None | Infrastructure exists, not configured | Partial |
| Agent sandboxing | Not started | Not started | No change |
| Output sanitization | Not started | Not started | No change |
| Secret redaction | Not started | Not started | No change |

**Overall assessment**: The implementation has addressed the low-hanging Electron security fruit (contextIsolation, contextBridge, CSP, shell:false). The critical unsolved problems remain agent sandboxing, output sanitization, and secret redaction.

---

_This threat model should be updated when: architecture changes, new IPC channels are added, agent sandboxing is implemented, or PTY/node-pty is introduced._
