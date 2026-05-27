# Threat Model — AgentOps Desktop

**Date**: 2026-05-28
**Methodology**: STRIDE
**Scope**: Intended architecture (pre-code / Day 0)
**Owner**: Security Engineer

---

## 1. System Overview

### Components

| Component | Trust Level | Description |
|-----------|-------------|-------------|
| **Renderer (React UI)** | Low | Untrusted — user-facing, runs in Chromium sandbox |
| **Main Process (Electron)** | High | Privileged — full Node.js access, IPC bridge, process management |
| **Agent Runtime** | High | Spawns CLI agents as child processes via PTY |
| **CLI Agents** | Critical | External binaries (Claude Code, Codex, Gemini CLI) with full shell access |
| **Paperclip Client** | Medium | REST client to external governance API |
| **SQLite (local)** | Medium | Local persistence for tasks, goals, agent config |
| **Workflow Engine** | Medium | State machine for task sequencing |
| **xterm.js** | Low | Terminal emulator in renderer for log display |

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
│  │  │  (sandbox)  │         │  (privileged)     │   │   │
│  │  └────────────┘         └────────┬─────────┘   │   │
│  │                                   │             │   │
│  │                          ┌────────┼────────┐    │   │
│  │                          ▼        ▼        ▼    │   │
│  │                     ┌────────┐ ┌──────┐ ┌────┐ │   │
│  │                     │ Agent  │ │Paper-│ │ DB │ │   │
│  │                     │Runtime │ │clip  │ │    │ │   │
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
- Renderer is sandboxed (should be); Main process is fully privileged.
- All user actions cross this boundary via IPC channels.

**Boundary 2 — Main Process ↔ CLI Agents (OS process)**
- Agents are external binaries spawned as child processes.
- Agents have full shell capabilities via PTY — no sandboxing documented.

**Boundary 3 — Main Process ↔ Paperclip Server (Network)**
- REST API over network. Token-based auth.
- External service — not under our control.

**Boundary 4 — Main Process ↔ SQLite (Filesystem)**
- Local file-based database. No encryption at rest documented.

### Data Flows

| Flow | Path | Sensitivity |
|------|------|-------------|
| User commands | Renderer → IPC → Main → Agent Runtime → CLI Agent | Medium |
| Agent output (stdout/stderr) | CLI Agent → Agent Runtime → IPC → Renderer | High — may contain code, secrets, PII |
| Task/governance data | Main → Paperclip Client → Network → Paperclip Server | Medium |
| Paperclip API token | .env → Main Process → Network | Critical |
| Agent config (paths, workdirs) | Renderer → IPC → Main → SQLite | Medium |
| Workflow definitions | Renderer → IPC → Main → Workflow Engine | Medium |
| Audit events | Main → Paperclip Client → Paperclip Server | Medium |

---

## 2. Attack Surfaces

### 2.1 IPC Channels (Renderer → Main)

| Channel | Attack Vector |
|---------|---------------|
| `agent:spawn` | Command injection via agent executable path or working directory |
| `task:update` | Malformed task data causing state corruption |
| `governance:approve` | Spoofed approval to bypass governance gates |

### 2.2 Agent Output Ingestion

- Raw stdout/stderr from CLI agents streamed directly to xterm.js
- No sanitization or parsing documented ("support raw output, no structured解析")
- Potential vectors: ANSI escape injection, terminal control sequences, embedded scripts in output

### 2.3 PTY Process Spawning

- Agent executables specified by user — path traversal / symlink attacks possible
- PTY grants full TTY capabilities to child processes
- No sandboxing, chroot, namespace isolation, or seccomp documented
- Working directory is user-configurable — agents can access any path

### 2.4 Paperclip API Communication

- Token-based auth — token storage mechanism undocumented
- REST API over network — TLS/certificate pinning not documented
- No rate limiting mentioned

### 2.5 Electron Attack Surface

- No mention of `contextIsolation`, `nodeIntegration`, `webSecurity` settings
- No preload script pattern documented
- No Content Security Policy (CSP) documented
- Auto-update via `electron-updater` — supply chain risk if unsigned

### 2.6 Local Data Storage

- SQLite without documented encryption at rest
- Agent config (executable paths, API tokens) stored locally
- No access control on SQLite file beyond OS permissions

### 2.7 xterm.js Terminal Emulator

- Renders raw agent output including potentially malicious content
- Known attack vector: terminal escape sequence injection (e.g., title set attacks, hyperlink injection)

---

## 3. STRIDE Threat Analysis

### S — Spoofing

| ID | Threat | Target | Likelihood | Impact | Risk |
|----|--------|--------|------------|--------|------|
| S-1 | Spoofed agent executable path | Agent Runtime | Medium | Critical | **High** |
| S-2 | Spoofed Paperclip API token | Paperclip Client | Low | High | **Medium** |
| S-3 | Forged IPC messages bypassing renderer CSP | Main Process | Low | Critical | **High** |

**S-1**: A malicious actor with local access could modify agent configuration to point to a trojanized binary. The app spawns it with PTY access and full shell capabilities.

**S-3**: If `contextIsolation` is disabled (not documented as enabled), a compromised renderer (e.g., via XSS in agent output) could send arbitrary IPC messages to the main process, including `agent:spawn` with malicious commands.

### T — Tampering

| ID | Threat | Target | Likelihood | Impact | Risk |
|----|--------|--------|------------|--------|------|
| T-1 | Agent modifies files outside its working directory | Filesystem | High | Critical | **Critical** |
| T-2 | Tampered agent output injected into UI | Renderer | Medium | Medium | **Medium** |
| T-3 | SQLite data tampering | Local DB | Low | Medium | **Low** |
| T-4 | Workflow definition tampering | Workflow Engine | Low | High | **Medium** |

**T-1**: CLI agents spawned via PTY have unrestricted filesystem access (no sandboxing). An agent — or a prompt injection payload within an agent — could read/write/delete any file the user's OS account can access. This is the single highest-severity threat in the architecture.

**T-2**: Agent stdout could contain crafted terminal escape sequences that, when rendered by xterm.js, alter the displayed content or inject hyperlinks.

### R — Repudiation

| ID | Threat | Target | Likelihood | Impact | Risk |
|----|--------|--------|------------|--------|------|
| R-1 | Agent actions not attributable to specific task/agent | Audit trail | Medium | Medium | **Medium** |
| R-2 | No local audit log for agent filesystem changes | Filesystem | High | Medium | **High** |

**R-1**: With raw stdout/stderr and no structured logging, correlating agent actions back to specific tasks is unreliable.

**R-2**: CLI agents make filesystem changes but no mechanism records what changed. Users cannot determine which agent modified which file without manual git inspection.

### I — Information Disclosure

| ID | Threat | Target | Likelihood | Impact | Risk |
|----|--------|--------|------------|--------|------|
| I-1 | Agent output contains secrets (API keys, tokens) | UI / Logs | High | Critical | **Critical** |
| I-2 | Paperclip API token leaked via logs or agent output | Network / Logs | Medium | Critical | **High** |
| I-3 | SQLite stores sensitive data unencrypted | Local DB | Medium | Medium | **Medium** |
| I-4 | Agent reads sensitive files from user's filesystem | Filesystem | High | Critical | **Critical** |

**I-1**: CLI agents executing code tasks may log environment variables, `.env` contents, or API responses containing tokens. Raw output streaming means these pass directly to the UI and may be persisted.

**I-4**: Since agents have unrestricted filesystem access via PTY, a compromised or prompt-injected agent could read `~/.ssh/`, `~/.aws/`, credential stores, browser cookies, etc.

### D — Denial of Service

| ID | Threat | Target | Likelihood | Impact | Risk |
|----|--------|--------|------------|--------|------|
| D-1 | Agent consumes excessive CPU/memory/disk | Host system | Medium | Medium | **Medium** |
| D-2 | Agent infinite loop blocks task queue | Workflow Engine | Medium | Medium | **Medium** |
| D-3 | Excessive agent output floods renderer | UI | Medium | Low | **Low** |

**D-1/D-2**: While the max parallel agent count is 3, no per-agent resource limits (CPU, memory, disk I/O) are documented. A single runaway agent could starve the host.

### E — Elevation of Privilege

| ID | Threat | Target | Likelihood | Impact | Risk |
|----|--------|--------|------------|--------|------|
| E-1 | Renderer achieves Node.js access via IPC bypass | Main Process | Low | Critical | **High** |
| E-2 | Agent exploits PTY to execute arbitrary OS commands | Host OS | High | Critical | **Critical** |
| E-3 | electron-updater installs unsigned/malicious update | Entire app | Low | Critical | **High** |

**E-2**: PTY spawning without sandboxing means every CLI agent effectively runs with the same privileges as the Electron app. A prompt injection attack (e.g., malicious code in a repository the agent is working on) could instruct the agent to exfiltrate data, install malware, or pivot to other systems.

---

## 4. Risk Summary

| Risk Level | Count | Threat IDs |
|------------|-------|------------|
| **Critical** | 3 | T-1, I-1, I-4, E-2 |
| **High** | 5 | S-1, S-3, R-2, I-2, E-1, E-3 |
| **Medium** | 6 | S-2, T-2, T-4, R-1, I-3, D-1, D-2 |
| **Low** | 2 | T-3, D-3 |

---

## 5. Recommended Mitigations

### Critical — Must Address Before MVP

| ID | Mitigation | Threats |
|----|------------|---------|
| M-1 | **Agent sandboxing**: Run CLI agents in containers, chroot, or OS-level sandbox (e.g., macOS sandbox-exec, Linux namespaces). At minimum, restrict filesystem access to the designated working directory. | T-1, I-4, E-2 |
| M-2 | **Output sanitization**: Strip or escape terminal control sequences before rendering in xterm.js. Implement allow-list for ANSI codes. | T-2, I-1 |
| M-3 | **Secret redaction**: Scan agent output for patterns matching API keys, tokens, and credentials before displaying or persisting. | I-1, I-2 |
| M-4 | **Electron security hardening**: Set `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`. Use preload scripts with `contextBridge`. Implement strict CSP. | S-3, E-1 |

### High — Should Address Before GA

| ID | Mitigation | Threats |
|----|------------|---------|
| M-5 | **Agent executable validation**: Verify agent binary path exists, is a regular file, and optionally verify hash/signature before spawning. | S-1 |
| M-6 | **Token management**: Store Paperclip API token in OS keychain (macOS Keychain, Windows Credential Manager, Linux secret-service) — not in `.env` or SQLite. | I-2 |
| M-7 | **Auto-update signing**: Configure electron-updater with code signing and signature verification. Reject unsigned updates. | E-3 |
| M-8 | **Local audit log**: Record all agent spawn events, file changes, and governance actions in a tamper-evident local log. | R-1, R-2 |
| M-9 | **IPC validation**: Validate and sanitize all IPC messages in the main process. Never trust renderer input. | S-3 |

### Medium — Plan for Post-MVP

| ID | Mitigation | Threats |
|----|------------|---------|
| M-10 | **Per-agent resource limits**: Set CPU, memory, and disk I/O limits per agent process (cgroups, ulimit, or container resource constraints). | D-1, D-2 |
| M-11 | **SQLite encryption**: Use SQLCipher or similar for encryption at rest. | I-3 |
| M-12 | **Network security**: Enforce TLS 1.2+ for Paperclip API. Consider certificate pinning. | S-2 |

---

## 6. Open Questions

1. **Electron security configuration**: Will `contextIsolation` and `nodeIntegration` be configured per Electron best practices? This is currently undocumented.
2. **Agent sandboxing strategy**: What sandboxing mechanism will be used for CLI agents? This is the most critical architectural decision for security.
3. **Token storage**: Where will the Paperclip API token be stored? `.env` file, OS keychain, or hardcoded?
4. **Output handling**: Will agent output be sanitized before rendering, or displayed raw as currently specified?
5. **Update distribution**: Will the app be code-signed? Will electron-updater verify signatures?

---

_This threat model should be reviewed and updated when architecture changes are made or when implementation begins._
