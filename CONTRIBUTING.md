# Contributing

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git

## Setup

```bash
git clone https://github.com/your-org/AgentOpsDesktop.git
cd AgentOpsDesktop
pnpm install
pnpm dev
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

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`

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
3. Open a PR with this template:

```markdown
## What changed
<Brief description>

## Why
<Motivation and context>

## How to test
<Steps to verify>

## Related
Closes [CMPAA-N]
```

4. Apply one primary label: `feature`, `bug`, `docs`, `chore`, `infra`
5. Request review from Code Reviewer and Product Owner
6. Merge when both approve and CI passes

## Code Style

- TypeScript with strict mode
- ESLint for linting (run `pnpm lint`)
- Prettier for formatting (run `pnpm format`)
- No unused variables or imports

## Testing

```bash
pnpm test          # Run all tests
pnpm test:watch    # Watch mode
pnpm test:coverage # With coverage report
```

Write tests for:
- Agent adapter logic
- IPC message handling
- Workflow engine state transitions
- Paperclip API client

## Project Conventions

- **One source of truth** per topic — don't duplicate information across files
- **Keep docs close to code** — reference specific files and paths
- **Update docs when you notice drift** — don't let them go stale
- **Accuracy over completeness** — wrong docs are worse than no docs

## Questions?

Open an issue with the `question` label or comment on an existing issue.
