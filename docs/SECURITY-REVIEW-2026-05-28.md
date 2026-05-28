# Security Review — AgentOps Desktop
**Date:** 2026-05-28
**Reviewer:** Security Engineer
**Scope:** Full codebase — OWASP Top 10, dependency CVEs, secrets exposure, configuration

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High     | 5 |
| Medium   | 5 |
| Low      | 2 |

---

## Critical

### C1: Auth Login Has No Credential Verification
**OWASP:** A07:2021 — Identification and Authentication Failures
**Files:** `src/main/api/routes/auth.js:16-21`, `src/main/ipc/index.js:104-112`

`POST /auth/login` accepts any `role` from the request body (including `admin`) and creates a session without any password, API key, or other credential check. Anyone who can reach the HTTP API (default port 3967) can obtain a full admin session.

**Impact:** Complete authentication bypass. Any local process or (if bound to 0.0.0.0) any network peer gets admin access.

**Remediation:** Require a shared secret, OS user verification, or at minimum restrict login to IPC-only (not exposed over HTTP). For the HTTP API, implement proper credential-based auth.

---

## High

### H1: HTTP API Routes Lack Input Validation
**OWASP:** A03:2021 — Injection
**Files:** `src/main/api/routes/agents.js`, `goals.js`, `tasks.js`, `settings.js`

IPC routes have schema validation via `validate.js`, but the Hono HTTP API routes pass `await c.req.json()` directly to repositories with zero validation. This enables:
- Mass assignment (write arbitrary fields)
- Type confusion attacks
- Oversized payloads

**Remediation:** Apply the same schema validation layer used by IPC routes to all HTTP API routes.

### H2: CORS Is Wide Open
**OWASP:** A05:2021 — Security Misconfiguration
**File:** `src/main/api/app.js:31`

`app.use('*', cors())` with no configuration allows **any origin** to make authenticated requests to the API. Combined with C1, any website opened in the user's browser can create admin sessions and control agents.

**Remediation:** Restrict CORS to `localhost` origins only, or disable for production:
```js
app.use('*', cors({ origin: ['http://localhost:3967', 'http://127.0.0.1:3967'] }));
```

### H3: `/routes` Endpoint Exposes Internal Routing Map
**OWASP:** A05:2021 — Security Misconfiguration
**File:** `src/main/api/app.js:44-49`

The `/routes` endpoint (no auth required) returns the full list of registered routes and methods. This is an information disclosure that aids attacker reconnaissance.

**Remediation:** Remove or gate behind admin auth.

### H4: `agents:spawn` Allows Arbitrary Process Execution
**OWASP:** A03:2021 — Injection
**File:** `src/main/ipc/controllers/agent.controller.js:183-207`, `src/main/agent-runtime.js:355-394`

The spawn endpoint accepts arbitrary `execPath`, `args`, `cwd`, and `env` from the user and spawns a child process with `shell: false`. While `shell: false` prevents shell injection, this is still arbitrary code execution by design. If the HTTP API is network-reachable, any authenticated user can execute arbitrary binaries.

**Remediation:**
- Add an allowlist of permitted executables
- Restrict spawn to IPC-only (not exposed via HTTP API)
- Log all spawn attempts with full args

### H5: Token Manager Falls Back to Base64 (Not Encryption)
**OWASP:** A02:2021 — Cryptographic Failures
**File:** `src/main/ipc/middleware/token-manager.js:148-153`

When `safeStorage.isEncryptionAvailable()` returns false, session tokens are persisted as base64 — trivially reversible. An attacker with file read access can extract the token.

**Remediation:** Use a proper encryption fallback (e.g., AES-256 with a key derived from machine-specific entropy) or refuse to persist sessions when encryption is unavailable.

---

## Medium

### M1: No Rate Limiting on Auth Endpoints
**OWASP:** A07:2021 — Identification and Authentication Failures
**Files:** `src/main/api/routes/auth.js`, `src/main/ipc/index.js`

Login, rotate, and status endpoints have no rate limiting. An attacker can brute-force tokens (48-byte base64url is strong, but combined with C1 this is moot).

**Remediation:** Add rate limiting middleware to auth routes (e.g., 5 attempts/minute).

### M2: Workspace Path Traversal — Symlink Bypass Risk
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/main/workspace-manager.js:51-61`

`resolveSafe()` uses `path.resolve()` + string prefix check. This works for `../` traversal but does NOT protect against symlink attacks — a symlink inside the workspace can point outside it, and `path.resolve()` won't follow the symlink. `fs.realpathSync()` should be used.

**Remediation:**
```js
const resolved = fs.realpathSync(path.resolve(rootPath, relPath));
```

### M3: Settings API Accepts Arbitrary Key-Value Writes
**OWASP:** A05:2021 — Security Misconfiguration
**File:** `src/main/api/routes/settings.js:19-24`

`PATCH /settings` passes the body directly to `repo.update()` without validating keys or values. An attacker could overwrite critical settings.

**Remediation:** Validate allowed setting keys and value types.

### M4: Single-Session Architecture — Token Theft = Full Compromise
**OWASP:** A07:2021 — Identification and Authentication Failures
**File:** `src/main/ipc/middleware/token-manager.js`

The system holds exactly one session. Stealing that token grants the attacker the same role (often `admin`) until expiry (24h). There's no way to invalidate a specific token without destroying the legitimate user's session.

**Remediation:** Support multiple concurrent sessions with per-session revocation.

### M5: Hono API Repository Access — No Authorization Checks
**OWASP:** A01:2021 — Broken Access Control
**Files:** All `src/main/api/routes/*.js`

The HTTP API routes check authentication (valid token) but perform **no authorization** — any authenticated user can access all endpoints regardless of role. The IPC layer correctly uses `permission` checks, but the HTTP API does not.

**Remediation:** Apply RBAC permission checks to HTTP API routes, matching the IPC route permissions.

---

## Low

### L1: Missing Content-Security-Policy Headers
**File:** `src/main/index.js` (BrowserWindow config)

No CSP is configured for the renderer. While `contextIsolation: true` and `nodeIntegration: false` are correctly set, a CSP would add defense-in-depth against XSS.

**Remediation:** Add a restrictive CSP via `session.defaultSession.webRequest.onHeadersReceived`.

### L2: Log Files May Contain Sensitive Data
**File:** `src/main/logger.js`

Logs are written as JSONL with arbitrary `extra` objects. Callers may inadvertently log tokens, paths, or error details that include sensitive data. The 30-day retention is reasonable but logs are stored unencrypted.

**Remediation:** Implement log sanitization to strip tokens/secrets before writing.

---

## Dependency CVEs

| Package | Severity | Issue | Status |
|---------|----------|-------|--------|
| esbuild <=0.24.2 | Moderate | Dev server request forgery (GHSA-67mh-4wv8-2f99) | Dev dependency only — low risk in production |
| glob 10.2.0-10.4.5 | High | Command injection via CLI (GHSA-5j98-mcp5-4vw2) | Transitive dep (config-file-ts) — `npm audit fix` |
| tar <=7.5.10 | High | Multiple path traversal CVEs | Transitive dep (electron-builder) — upgrade to v26.8.1+ |

**Recommendation:** Run `npm audit fix` for glob. Upgrade `electron-builder` to v26.8.1+ for tar.

---

## Secrets Exposure

- No hardcoded secrets found in source code
- `.env` files correctly gitignored
- Apple notarization credentials read from env vars (`scripts/notarize.js`)
- Session tokens use `crypto.randomBytes(48)` — adequate entropy

---

## Positive Findings

- `contextIsolation: true` and `nodeIntegration: false` — correct Electron security
- `shell: false` on `spawn()` — prevents shell injection
- Timing-safe token comparison via `crypto.timingSafeEqual`
- WAL mode + foreign keys enabled on SQLite
- Input validation schemas defined for IPC routes
- Workspace path sandboxing implemented (needs symlink fix)
- Token stored in `safeStorage` when available (OS keychain)

---

## Remediation Priority

1. **C1** — Fix auth login (blocks everything else)
2. **H2** — Restrict CORS (amplifies C1)
3. **H5** — Remove `/routes` or gate behind auth
4. **H1** — Add validation to HTTP API routes
5. **M5** — Add authorization to HTTP API routes
6. **H4** — Restrict spawn to IPC-only or add allowlist
7. **M2** — Fix symlink traversal in workspace manager
8. **H3** — Improve token persistence fallback
9. **M1** — Add rate limiting
10. **M3/M4/L1/L2** — Lower priority hardening
