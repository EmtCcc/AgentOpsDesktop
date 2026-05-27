# Security Review — AgentOps Desktop

**Date**: 2026-05-28
**Reviewer**: Security Engineer
**Scope**: Full codebase — OWASP Top 10, dependency CVEs, secrets exposure, configuration
**Repo state**: Full implementation (Electron main + renderer, IPC, SQLite, agent runtime)
**Previous review**: Scaffolding-phase review (F-001 through F-006) — see git history

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | — |
| High | 2 | Open |
| Medium | 5 | Open |
| Low | 4 | Open |

The Electron security baseline (contextIsolation, nodeIntegration, contextBridge, spawn with shell:false, parameterized SQL) is solid. The findings below are in the IPC handler layer and supporting modules.

---

## Findings

### H-1: Arbitrary environment variable injection via `agents:spawn`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **OWASP** | A03:2021 — Injection |
| **Location** | `src/main/ipc/controllers/agent.controller.js:152-164` |

The `agents:spawn` handler accepts an `env` object from the renderer that is merged directly into `process.env` for the child process. An attacker with a session token could inject `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, `NODE_OPTIONS`, or manipulate `PATH` to achieve arbitrary code execution.

```js
env: { ...process.env, ...(env || {}) },  // line 160
```

**Fix**: Allowlist safe env keys. Strip or reject dangerous keys (`LD_PRELOAD`, `DYLD_*`, `NODE_OPTIONS`, `NODE_PATH`, `PATH`, `PYTHONPATH`, etc.).

---

### H-2: Arbitrary signal injection via `agents:kill`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **OWASP** | A03:2021 — Injection |
| **Location** | `src/main/ipc/controllers/agent.controller.js:236-257` |

The `kill` handler passes a user-supplied `signal` string directly to `process.kill()`:

```js
const sig = signal || 'SIGTERM';
session.process.kill(sig);  // line 244
```

An attacker could bypass graceful shutdown (`SIGKILL` immediately) or send unexpected signals.

**Fix**: Validate `signal` against an allowlist: `['SIGTERM', 'SIGKILL', 'SIGINT']`.

---

### M-1: Token stored as base64 (not encrypted) when safeStorage unavailable

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **OWASP** | A02:2021 — Cryptographic Failures |
| **Location** | `src/main/ipc/middleware/token-manager.js:127-131` |

When `safeStorage.isEncryptionAvailable()` returns false, the session token is persisted as base64-encoded JSON. Base64 is encoding, not encryption — any process with file read access can decode it.

**Fix**: When safeStorage is unavailable, do not persist the session (in-memory only). Or derive an encryption key from a user-provided credential.

---

### M-2: No rate limiting on `auth:login`

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **OWASP** | A07:2021 — Identification and Authentication Failures |
| **Location** | `src/main/ipc/index.js:66-69` |

`auth:login` is public and creates a new session on every call with no throttling. While Electron IPC is local-only, a compromised renderer could rapidly create sessions.

**Fix**: Add rate limiting (e.g., 5 attempts/minute) or require proof-of-possession of a pre-shared credential.

---

### M-3: Predictable gate IDs using `Math.random()`

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **OWASP** | A04:2021 — Insecure Design |
| **Location** | `src/main/ipc/controllers/governance.controller.js:41` |

Gate IDs are generated with `Math.random()` which is predictable:

```js
const gateId = `gate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```

**Fix**: Use `crypto.randomUUID()` consistent with the rest of the codebase.

---

### M-4: Prototype pollution risk in Store update methods

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **OWASP** | A03:2021 — Injection |
| **Location** | `src/main/store.js:97, 131` |

`Store.updateGoal()` and `Store.updateTask()` use `Object.assign(target, updates)` with user-supplied data. If `updates` contains `__proto__` or `constructor`, prototype pollution is possible. The IPC-level schema validation has allowlists, but the Store itself does not.

**Fix**: Add key allowlist filtering in Store update methods, or freeze prototypes.

---

### M-5: Unsanitized renderer-supplied log entries

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **OWASP** | A03:2021 — Injection |
| **Location** | `src/main/ipc/controllers/log.controller.js:34-46` |

`logs:append` accepts arbitrary entries from the renderer and stores them without sanitization. While `escapeHtml()` is used for display, raw payloads persist and could be consumed by other tools (export, log aggregation).

**Fix**: Validate log entry fields. Consider making `logs:append` internal-only (not renderer-accessible).

---

### L-1: No Content-Security-Policy configured

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **OWASP** | A05:2021 — Security Misconfiguration |
| **Location** | `src/main/index.js:28-43` |

The `BrowserWindow` has no CSP. Weakens XSS defense if any injection point exists in the renderer.

**Fix**: Add CSP via `session.defaultSession.webRequest.onHeadersReceived` or `<meta>` tag: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';`.

---

### L-2: Fallback paths use `process.cwd()`

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Location** | `src/main/logger.js:14`, `src/main/ipc/middleware/token-manager.js:27` |

When `app.getPath('userData')` is unavailable, both logger and token manager fall back to `process.cwd()`, which could be attacker-controlled.

**Fix**: Use `os.tmpdir()` or `os.homedir()` as fallback.

---

### L-3: Error messages leak internal file paths

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Location** | `agent.controller.js`, `agent-runtime.js`, `store.js` |

Error messages include full system paths returned to the renderer, aiding reconnaissance.

**Fix**: Redact file paths from renderer-facing errors. Log full details server-side only.

---

### L-4: No lockfile — dependency audit blocked

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Location** | Project root |

No `package-lock.json` exists, preventing `npm audit`. Dependencies cannot be checked for known CVEs.

**Fix**: Generate and commit `package-lock.json`. Add `npm audit` to CI.

---

## Previous Review Status (F-001 through F-006)

| ID | Finding | Status |
|----|---------|--------|
| F-001 | CI actions not SHA-pinned | Still open — `.github/workflows/ci.yml` still uses `@v4` tags |
| F-002 | No dependency manifest | Partially addressed — `package.json` has deps, but no lockfile |
| F-003 | Electron security posture | **Resolved** — `contextIsolation: true`, `nodeIntegration: false`, contextBridge used |
| F-004 | Subprocess execution risk | **Partially resolved** — `shell: false` set, `_validateExecPath` checks existence, but H-1/H-2 remain |
| F-005 | Local data storage encryption | **Partially resolved** — `safeStorage` used for token, but M-1 fallback is weak |
| F-006 | No CSP | Still open — see L-1 |

---

## Positive Observations

- **Electron hardening**: `contextIsolation: true`, `nodeIntegration: false`, proper `contextBridge` usage
- **Token security**: `crypto.timingSafeEqual()` prevents timing attacks; 48-byte random tokens
- **IPC auth pipeline**: Clean middleware pattern — auth → validate → handler. Most mutation routes require auth
- **Input validation**: Schema-based with type checks, length limits, enums, and field allowlists
- **SQLite**: Parameterized queries via `better-sqlite3` prepared statements — no SQL injection
- **XSS prevention**: `escapeHtml()` used in renderer for dynamic content
- **Process spawning**: `shell: false` prevents shell injection in `spawn()` calls

---

## Dependency Audit

`npm audit` could not run (no `package-lock.json`). Manual review of declared dependencies:

| Package | Version | Notes |
|---------|---------|-------|
| `better-sqlite3` | ^11.9.1 | Native addon; check for CVEs after lockfile generated |
| `electron-updater` | ^6.3.9 | Auto-update mechanism — verify signature validation is configured |
| `uuid` | ^11.1.0 | Low risk — pure JS |
| `electron` | ^42.3.0 (dev) | Large attack surface; keep updated |
| `@electron/notarize` | ^3.0.0 (dev) | Dev-only, not shipped |

---

## Secrets Exposure Scan

| Check | Result |
|-------|--------|
| Hardcoded API keys | None found |
| `.env` files committed | None (`.gitignore` correctly excludes) |
| Private keys / certs | None found |
| Tokens in config | None found |
| Apple credentials | `scripts/notarize.js` reads from env vars (correct pattern) |

---

## Follow-Up Issues

| ID | Finding | Severity | Description |
|----|---------|----------|-------------|
| CMPAAA-49 | H-1 | High | Allowlist env vars in `agents:spawn` |
| CMPAAA-50 | H-2 | High | Allowlist signals in `agents:kill` |
| CMPAAA-51 | M-1 | Medium | Fix base64 token fallback |
| CMPAAA-52 | M-2 | Medium | Add rate limiting on `auth:login` |
| CMPAAA-53 | M-3 | Medium | Use `crypto.randomUUID()` for gate IDs |
| CMPAAA-54 | M-4 | Medium | Harden Store update methods against prototype pollution |
| CMPAAA-55 | M-5 | Medium | Sanitize or restrict `logs:append` |
