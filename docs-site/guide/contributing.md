# Contributing

## Prerequisites

- Node.js >= 20
- Git

## Setup

```bash
git clone https://github.com/EmtCcc/AgentOpsDesktop.git
cd AgentOpsDesktop
npm install
npm start
```

## Development Workflow

This project uses a **direct-to-main** workflow.

1. Pull latest from main
2. Make changes
3. Run linting and tests locally
4. Commit with a conventional commit message
5. Push to main
6. Verify CI passes

For larger changes (new features, architectural changes), open a PR and request review.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>
```

| Type | Use For |
|------|---------|
| `feat` | New features |
| `fix` | Bug fixes |
| `docs` | Documentation changes |
| `chore` | Maintenance tasks |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `perf` | Performance improvements |

Rules:
- Lowercase after colon
- No period at end
- Under 72 characters
- Reference issue ID in body when applicable

Examples:
- `feat: add agent spawn IPC channel`
- `fix: handle PTY close on Windows`
- `docs: update architecture diagram`

## Branch Naming

```
<prefix>-<N>/<short-description>
```

Where `<prefix>` is the company issue prefix (lowercase) and `<N>` is the issue number.

Example: `cmpaa-13/add-readme`

## PR Process

1. Create a branch from main
2. Make changes and commit
3. Open a PR using the template in `.github/pull_request_template.md`
4. Apply one primary label: `feature`, `bug`, `docs`, `chore`, `infra`
5. Request review from Code Reviewer and Product Owner
6. Merge when both approve and CI passes

## Code Style

- JavaScript (ESLint for linting — run `npm run lint`)
- Strict mode (`'use strict'`)
- No unused variables or imports

## Testing

```bash
npm test              # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright — all browsers)
npm run test:e2e:chromium  # E2E tests (Chromium only)
npm run test:report   # Open Playwright HTML report
```

Write tests for:
- Agent runtime logic (spawn, kill, health check)
- IPC message handling
- Store CRUD operations
- Monitor metrics and alerts

## Project Conventions

- **One source of truth** per topic — don't duplicate information across files
- **Keep docs close to code** — reference specific files and paths
- **Update docs when you notice drift** — don't let them go stale
- **Accuracy over completeness** — wrong docs are worse than no docs

## Questions?

Open an issue with the `question` label or comment on an existing issue.
