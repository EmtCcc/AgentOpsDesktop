# Security Review — AgentOpsDesktop

**Date**: 2026-05-28
**Reviewer**: Security Engineer
**Scope**: Full codebase audit (initial)
**Repo state**: Day 0 — documentation and scaffolding only, no application code

---

## Summary

The repository contains **no application code** — only documentation, a `package.json` manifest, CI workflow, and empty source directories. There are no runtime dependencies to audit. The primary security value of this review is establishing a baseline and identifying risks that must be addressed as implementation begins.

**Overall risk**: Low (current state) → **High** (projected, once implementation begins)

---

## Findings

### F-001: CI Workflow — GitHub Actions Not Pinned by SHA

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Supply Chain (A08:2021 — Software and Data Integrity Failures) |
| **Location** | `.github/workflows/ci.yml:12, 13, 20, 21` |

**Description**: The CI workflow references `actions/checkout@v4` and `actions/setup-node@v4` by mutable tag. A compromised or hijacked tag could inject malicious code into the build pipeline.

**Evidence**:
```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
```

**Recommendation**: Pin actions to full SHA digests. Example:
```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
```

Verify SHAs against the official GitHub repository before pinning.

---

### F-002: No Dependency Manifest — Cannot Audit CVEs

| Field | Value |
|-------|-------|
| **Severity** | Informational |
| **Category** | Vulnerable and Outdated Components (A06:2021) |
| **Location** | `package.json` |

**Description**: The `package.json` declares no `dependencies` or `devDependencies` fields. Once dependencies are added, they must be audited for known CVEs before each release.

**Recommendation**: 
- Add `npm audit` or `snyk test` to the CI pipeline as soon as dependencies are introduced.
- Use a lockfile (`package-lock.json`) and commit it to the repo.
- Enable Dependabot or Renovate for automated vulnerability alerts.

---

### F-003: Electron Security Posture — Not Yet Configured

| Field | Value |
|-------|-------|
| **Severity** | High (projected) |
| **Category** | Architecture — Attack Surface |
| **Location** | `src/main/`, `src/renderer/` (empty) |

**Description**: Per `docs/VISION.md` and `docs/MVP-SCOPE.md`, the application will use Electron with:
- **Main process**: Agent lifecycle management, subprocess spawning (CLI agents)
- **Renderer process**: UI with real-time log streaming
- **Local SQLite**: Data persistence

Electron applications are high-risk if misconfigured. Common vulnerabilities:
1. **Remote Code Execution via `nodeIntegration: true`** — renderer can execute arbitrary Node.js code
2. **Prototype pollution** in IPC message handlers
3. **Unvalidated subprocess arguments** — command injection via agent configuration
4. **Path traversal** in file operations (agent output preview)
5. **XSS in renderer** — if agent output is rendered as HTML without sanitization

**Recommendation (must implement before any Electron code)**:
- Set `nodeIntegration: false` and `contextIsolation: true` in `BrowserWindow` options
- Use `contextBridge` and `preload.js` for secure IPC
- Validate and sanitize all IPC inputs in the main process
- Never pass user-controlled data to `child_process.exec()` — use `execFile()` or `spawn()` with argument arrays
- Implement Content Security Policy (CSP) headers
- Use `webSecurity: true` (default) — never disable it

Create an architecture decision record (ADR) documenting these choices before scaffolding.

---

### F-004: Subprocess Execution Risk — CLI Agent Spawning

| Field | Value |
|-------|-------|
| **Severity** | High (projected) |
| **Category** | Injection (A03:2021 — Injection) |
| **Location** | `src/main/` (not yet implemented) |

**Description**: Per `docs/MVP-SCOPE.md`, the app will "configure local CLI Agent executable paths and working directories" and spawn them as subprocesses. This creates direct command injection vectors:
- User-configured executable path → arbitrary binary execution
- Agent arguments constructed from user input → argument injection
- Working directory path → path traversal

**Recommendation (must implement with agent runtime)**:
- Validate executable paths against an allowlist or confirm they resolve to known binaries
- Use `child_process.spawn()` with explicit argument arrays, never string concatenation
- Sanitize working directory paths — reject paths with `..`, null bytes, or symlink escapes
- Implement a sandbox or permission boundary for agent subprocesses
- Log all subprocess executions with full argument lists for auditability

---

### F-005: Local Data Storage — No Encryption Planned

| Field | Value |
|-------|-------|
| **Severity** | Medium (projected) |
| **Category** | Sensitive Data Exposure (A01:2021 — Broken Access Control) |
| **Location** | SQLite database (not yet created) |

**Description**: The app stores agent history, task data, and potentially API keys locally in SQLite. On a shared or compromised machine, this data is readable in plaintext.

**Recommendation**:
- Encrypt API keys and credentials at rest using OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Do not store credentials in SQLite or config files
- If sensitive data must be in SQLite, use SQLCipher for encrypted storage
- Document what data is stored locally in the privacy policy

---

### F-006: No Content Security Policy (CSP)

| Field | Value |
|-------|-------|
| **Severity** | Medium (projected) |
| **Category** | Security Misconfiguration (A05:2021) |
| **Location** | Electron app (not yet configured) |

**Description**: No CSP is configured for the Electron renderer process. Without CSP, XSS vulnerabilities can execute inline scripts, load external resources, or exfiltrate data.

**Recommendation**: Implement a strict CSP:
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self';
font-src 'self';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
```

Apply via `session.defaultSession.webRequest.onHeadersReceived` in the main process.

---

## Dependency Audit

| Status | Details |
|--------|---------|
| **Total dependencies** | 0 (no dependencies declared) |
| **Known CVEs** | N/A |
| **Outdated packages** | N/A |

**Action required**: Re-run `npm audit` after `npm install` adds dependencies. Add to CI pipeline.

---

## Secrets Exposure Scan

| Check | Result |
|-------|--------|
| Hardcoded API keys | None found |
| `.env` files committed | None (`.gitignore` excludes `.env`, `.env.local`, `.env.*.local`) |
| Private keys / certs | None found |
| Tokens in config | None found |
| Lock files committed | None (`.gitignore` excludes `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) |

**Note**: The `.gitignore` correctly excludes lock files, but this is **not recommended** — lock files should be committed for reproducible builds. Remove those entries from `.gitignore` when dependencies are added.

---

## OWASP Top 10 Coverage (2021)

| ID | Category | Status | Notes |
|----|----------|--------|-------|
| A01 | Broken Access Control | N/A | No code yet; projected risk with local data storage |
| A02 | Cryptographic Failures | N/A | No code yet; projected risk with credential storage |
| A03 | Injection | N/A | No code yet; **high projected risk** with subprocess execution |
| A04 | Insecure Design | Review | Architecture documents reviewed — no security section in design docs |
| A05 | Security Misconfiguration | **Finding** | CI actions not SHA-pinned (F-001) |
| A06 | Vulnerable Components | **Finding** | No deps yet; need audit pipeline (F-002) |
| A07 | Identification and Auth Failures | N/A | MVP scope explicitly excludes multi-user auth |
| A08 | Software and Data Integrity | **Finding** | CI supply chain risk (F-001) |
| A09 | Security Logging and Monitoring | N/A | No code yet; plan audit logging for agent execution |
| A10 | Server-Side Request Forgery | N/A | No server component in MVP |

---

## Threat Model Summary

### Attack Surfaces (Projected)

| Surface | Entry Point | Risk |
|---------|-------------|------|
| **CLI Agent Configuration** | User-supplied executable path | Arbitrary code execution |
| **IPC Channel** | Renderer ↔ Main process | RCE if `nodeIntegration` enabled |
| **Agent Output** | stdout/stderr from subprocess | XSS if rendered unsanitized |
| **SQLite Database** | Local file on disk | Data exposure if unencrypted |
| **GitHub Actions** | CI pipeline | Supply chain compromise |

### Trust Boundaries

1. **Main process ↔ Renderer**: Must use `contextBridge` with strict input validation
2. **Main process ↔ Agent subprocess**: Must use argument arrays, no shell interpolation
3. **Local storage ↔ OS**: Credentials must use OS keychain, not flat files

---

## Follow-Up Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| CMPAA-38 | Medium | Pin GitHub Actions to SHA digests in CI workflow |
| CMPAA-39 | High | Define Electron security configuration (CSP, nodeIntegration, contextIsolation) as ADR before implementation |
| CMPAA-40 | High | Implement secure subprocess execution patterns for CLI agent runtime |

---

## Conclusion

The repository is in a safe initial state with no exploitable vulnerabilities. However, the planned architecture (Electron + subprocess execution + local storage) presents **significant projected risk** if security is not baked in from the start. The three follow-up issues above should be addressed before or during the first implementation sprint.

**Next review**: After project scaffolding and first feature implementation.
