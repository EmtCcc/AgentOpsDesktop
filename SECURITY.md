# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in AgentOps Desktop, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, email the maintainers directly with:

1. A description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

The following are in scope:

- Remote code execution via the Electron app
- Sandbox escapes (renderer accessing Node.js APIs)
- IPC message injection or manipulation
- Authentication/authorization bypasses
- Data exfiltration paths (agent output leaking secrets)
- Path traversal in agent executable or working directory configuration
- Supply chain attacks via dependencies

## Out of Scope

- CLI agents themselves (Claude Code, Codex, etc.) — report to their respective maintainers
- Social engineering
- Physical access attacks

## Security Architecture

AgentOps Desktop implements several security boundaries:

- **Context isolation**: Renderer cannot access Node.js APIs (`contextIsolation: true`)
- **IPC validation**: All messages validated against schemas before handler invocation
- **Process spawning**: `shell: false` prevents shell injection
- **CSP**: Content Security Policy enforced via meta tag
- **RBAC**: Role-based access control (admin/operator/viewer)

See [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) for the full STRIDE analysis.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Previous release | Yes (critical fixes only) |
| Older | No |
