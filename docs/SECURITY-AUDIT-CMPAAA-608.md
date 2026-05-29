# Security Audit Report — CMPAAA-608 (Phase 1 Features)

**Date**: 2026-05-30
**Auditor**: Security Engineer Agent
**Scope**: Phase 1 competitive scanning implementation — CLI adapters, adapter registry, message bus, task orchestrator, group chat engine, API server

---

## Executive Summary

Total findings: **11** — Critical: 2, High: 3, Medium: 4, Low: 2

The most severe issues are **arbitrary code execution via `require()` on user-controlled paths** and **command injection via `shell: true` in spawn calls**. Both are exploitable through the authenticated API surface.

---

## Finding Summary

| # | Severity | Component | Finding | Status |
|---|----------|-----------|---------|--------|
| 1 | **Critical** | adapter-registry.js, adapter-registry-service.js | Arbitrary code execution via `require(classPath)` | Open |
| 2 | **Critical** | adapters.js API route | `POST /api/adapters` accepts arbitrary `classPath` -> RCE | Open |
| 3 | **High** | generic-cli.adapter.js, gemini-cli.adapter.js | `shell: true` in spawn — command injection | Open |
| 4 | **High** | adapter-registry-service.js | Path traversal in tarball extraction (`_extractTarball`) | Open |
| 5 | **High** | adapter-registry-service.js | Path traversal in `install(name)` — unsanitized name | Open |
| 6 | **Medium** | app.js | CORS `*` wildcard on all routes | Open |
| 7 | **Medium** | app.js | `/routes` endpoint publicly exposes internal API topology | Open |
| 8 | **Medium** | codex.adapter.js | API key (`OPENAI_API_KEY`) passed via env — visible to child processes | Open |
| 9 | **Medium** | All adapters | `task.description` passed unsanitized to CLI args | Open |
| 10 | **Low** | socket-server.js | Authentication callback is optional — local privilege escalation | Open |
| 11 | **Low** | Dependencies | `npm audit` clean — 0 known vulnerabilities | Pass |

---

## Detailed Findings

### F1: Arbitrary Code Execution via `require(classPath)` — Critical

**Files**: `src/main/adapter-registry.js:235`, `src/main/adapter-registry-service.js:451`

The adapter registry's `loadFromConfigs()` method calls `require(cfg.classPath)` where `classPath` comes from user-provided config. The `AdapterRegistryService._loadAdapter()` also calls `require(entryPath)` with paths derived from remote registry metadata.

**Impact**: An attacker who can control adapter config (via API or DB) can execute arbitrary JavaScript in the Electron main process with full system access.

**Reproduction**:
```js
// Via POST /api/adapters with body:
{ "type": "evil", "classPath": "/tmp/evil.js", "config": {} }
// Then POST /api/adapters/:id/load
```

**Recommendation**: Whitelist allowed `classPath` values to a trusted directory. Never `require()` paths outside `src/main/adapters/` or the vetted adapters directory. Add integrity checks (hash verification) for remote adapter packages.

---

### F2: API RCE via Adapter Config — Critical

**File**: `src/main/api/routes/adapters.js:54-61, 85-102`

The `POST /api/adapters` endpoint accepts `classPath` in the request body with no validation. The `POST /api/adapters/:id/load` endpoint then calls `require(config.classPath)`. Combined, this is unauthenticated RCE (after bypassing Bearer token auth).

**Impact**: Full system compromise via the authenticated API.

**Recommendation**:
1. Remove `classPath` from the create/update API schemas — it should only be set internally by the registry service.
2. Validate that any loaded classPath resolves within the allowed adapters directory.
3. Add an allowlist of permitted adapter types.

---

### F3: Command Injection via `shell: true` — High

**Files**:
- `src/main/adapters/generic-cli.adapter.js:47` — `spawn(this.execPath, args, { shell: true })`
- `src/main/adapters/generic-cli.adapter.js:109` — `execute()` also uses `shell: true`
- `src/main/adapters/gemini-cli.adapter.js:54` — same pattern
- `src/main/adapters/gemini-cli.adapter.js:113` — same in `execute()`

When `shell: true` is set, arguments are concatenated into a shell command string. If `execPath` or any arg contains shell metacharacters (`;`, `|`, `$()`, backticks), arbitrary commands execute.

**Impact**: An attacker who controls adapter config (`execPath`, `args`) or task descriptions can inject shell commands.

**Reproduction**:
```js
// Config: { execPath: "echo; rm -rf /" }
// With shell: true, this executes: echo; rm -rf /
```

**Recommendation**: Remove `shell: true` from all spawn calls. Use array-based argument passing (which Node.js `spawn` supports natively without shell). The Claude Code adapter (`claude-code.adapter.js:103`) already correctly omits `shell: true`.

---

### F4: Command Injection in Tarball Extraction — High

**File**: `src/main/adapter-registry-service.js:488`

```js
execSync(`tar -xzf "${tmpFile}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' });
```

`tmpFile` uses `randomUUID()` so it's safe, but `destDir` is derived from the adapter `name` parameter which is user-controlled. A name like `foo"; rm -rf / #` would break out of the quotes.

**Impact**: Command injection during adapter install.

**Recommendation**: Use `execFileSync` (array args, no shell) or the `tar` npm package instead of string interpolation in a shell command.

---

### F5: Path Traversal in Adapter Install — High

**File**: `src/main/adapter-registry-service.js:103`

```js
const installDir = path.join(this.adaptersDir, name);
```

The `name` parameter from the API (`POST /api/adapter-registry/install`) is not sanitized. A name like `../../etc` would install outside the adapters directory.

The `installFromFile()` method also accepts an arbitrary `filePath` with no containment check.

**Impact**: Arbitrary file write / overwrite outside the adapters directory.

**Recommendation**: Validate that `name` contains only alphanumeric characters, hyphens, and dots (no path separators). Verify that the resolved `installDir` starts with `this.adaptersDir` after path resolution.

---

### F6: CORS Wildcard — Medium

**File**: `src/main/api/app.js:40`

```js
app.use('*', cors());
```

Default CORS allows all origins. In an Electron app serving on localhost, any website the user visits can make requests to `http://localhost:3967/api/*`.

**Impact**: A malicious website can interact with the AgentOps API using the user's auth token (if accessible via cookies or if the token is predictable).

**Recommendation**: Restrict CORS to `origin: ['file://', 'http://localhost:3967']` or disable it entirely since this is a local-only API.

---

### F7: `/routes` Endpoint Leaks API Topology — Medium

**File**: `src/main/api/app.js:57-63`

The `/routes` endpoint is public (no auth middleware) and returns a complete list of all registered API routes and HTTP methods.

**Impact**: Aids reconnaissance for further attacks.

**Recommendation**: Remove or protect this endpoint behind auth. It should not exist in production builds.

---

### F8: API Key Exposure via Environment — Medium

**File**: `src/main/adapters/codex.adapter.js:40`

```js
if (this.apiKey) env.OPENAI_API_KEY = this.apiKey;
```

The API key is injected into the child process environment. On Unix, `/proc/<pid>/environ` is readable by the same user. Other spawned processes inherit the full environment.

**Impact**: API key leakage to other processes or through process listing.

**Recommendation**: Use a config file or stdin-based key injection instead of environment variables. At minimum, ensure the key is only set in the child process env, not inherited broadly.

---

### F9: Unsanitized Task Description in CLI Args — Medium

**Files**: All adapter `execute()` and `spawn()` methods pass `task.description` directly as a CLI argument.

For example, `claude-code.adapter.js:89`:
```js
if (params.task?.description) args.push(params.task.description);
```

While `ClaudeCodeAdapter` does NOT use `shell: true` (safe), `GenericCliAdapter` and `GeminiCliAdapter` DO use `shell: true` (unsafe — covered in F3).

**Impact**: Combined with F3, this is command injection. Without F3, the risk is lower but unexpected args could still cause issues.

**Recommendation**: Sanitize task descriptions to remove null bytes and control characters. Enforce max length.

---

### F10: Optional Socket Authentication — Low

**File**: `src/main/message-bus/socket-server.js:47, 232`

The `_authenticate` callback is optional. If not provided, any local process that can connect to the Unix socket can authenticate by providing any `agentId`/`squadId`.

Socket permissions are set to `0o660` (owner + group), which is reasonable, but the group permission means any user in the same group can connect.

**Impact**: Local privilege escalation for group members.

**Recommendation**: Always require authentication. Generate and validate per-agent tokens. Consider `0o600` permissions.

---

### F11: Dependency Audit — Pass

`npm audit` reports 0 known vulnerabilities in current dependencies.

**Runtime deps**: `@hono/node-server`, `better-sqlite3`, `electron-updater`, `gray-matter`, `hono`, `react`, `react-dom`, `uuid` — all clean.
**Dev deps**: `electron`, `electron-builder`, `esbuild`, `vitest`, `@playwright/test`, `eslint`, `prettier` — all clean.

---

## Security Scores by Module

| Module | Score | Notes |
|--------|-------|-------|
| CLI Adapters | 4/10 | `shell: true` command injection, unsanitized args |
| Adapter Registry | 2/10 | RCE via `require()`, path traversal, tarball injection |
| Message Bus | 7/10 | Good namespace isolation, optional auth is weak point |
| Task Orchestrator | 7/10 | Good state machine validation, budget enforcement |
| Group Chat Engine | 6/10 | No input sanitization on chat content, but limited blast radius |
| API Server | 5/10 | Auth present but CORS wildcard, /routes leak, RCE via adapters |
| Parsers | 8/10 | Safe string parsing, no eval/exec |
| Dependencies | 9/10 | Clean audit, minimal surface |

---

## Recommended Fix Priority

1. **Immediate** (Critical): F1 + F2 — whitelist classPath, remove from API schema
2. **Immediate** (Critical): F3 — remove `shell: true` from generic-cli and gemini adapters
3. **High**: F4 — switch to `execFileSync` in tarball extraction
4. **High**: F5 — sanitize adapter name, path containment check
5. **Medium**: F6 — restrict CORS origins
6. **Medium**: F7 — remove `/routes` endpoint
7. **Low**: F8-F10 — hardening improvements

---

## Child Issues Required

Per acceptance criteria, Critical/High findings require sub-issues:

- [ ] CMPAAA-609: Fix RCE via classPath in adapter registry (F1+F2)
- [ ] CMPAAA-610: Remove shell: true from CLI adapters (F3)
- [ ] CMPAAA-611: Fix tarball extraction command injection (F4)
- [ ] CMPAAA-612: Path traversal in adapter install (F5)
