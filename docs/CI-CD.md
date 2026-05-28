# CI/CD Pipeline

AgentOps Desktop uses GitHub Actions for continuous integration and deployment. Four workflows cover the full lifecycle: CI checks, beta releases, stable releases, and emergency rollbacks.

## Pipeline Overview

```
         PR / push to main
               │
               ▼
┌──────────────────────────────────────┐
│  CI: lint → test + e2e + build       │  (ubuntu, fast)
│            └→ build-mac (push only)  │  (macos, full)
└──────────────────────────────────────┘
               │
         merge to main
               │
     ┌─────────┴──────────┐
     ▼                    ▼
  Beta tag             Stable tag
  v0.2.0-beta.1        v0.2.0
     │                    │
     ▼                    ▼
┌──────────────┐  ┌──────────────┐
│ beta.yml     │  │ release.yml  │
│ (pre-release)│  │ (stable)     │
└──────────────┘  └──────────────┘
               │
          If critical issue:
               │
               ▼
┌──────────────────────────┐
│  rollback.yml            │
│  (manual trigger)        │
└──────────────────────────┘
```

## CI Workflow (`.github/workflows/ci.yml`)

Runs on every push to `main` and every pull request targeting `main`.

| Job | Runner | What it does | Runs on |
|-----|--------|-------------|---------|
| `lint` | ubuntu | `pnpm lint` (ESLint) | PR + push |
| `test` | ubuntu | `pnpm test` (Vitest) | PR + push |
| `e2e` | ubuntu | Playwright tests; uploads report artifact | PR + push |
| `build` | ubuntu | `pnpm compile` (esbuild bundle to `dist/`) | PR + push |
| `build-mac` | macos | Electron DMG build + smoke test | push to `main` only |

**Job dependencies:**

```
lint ──┬── test ──────┐
       ├── e2e  ──────├── build-mac (push only)
       └── build ─────┘
```

The `build-mac` job is gated to `push` events only (skipped on PRs) to save macOS runner minutes. PRs get fast feedback from lint, test, e2e, and esbuild build on ubuntu.

### Artifacts

| Artifact | Retention | Contents |
|----------|-----------|---------|
| `playwright-report` | 7 days | Playwright HTML test report |
| `dist` | 3 days | esbuild output (`dist/`) |
| `AgentOps-mac` | 7 days | macOS `.app` bundle |

## Release Workflows

See [Release Process](RELEASE-PROCESS.md) for the full release playbook.

### Beta Release (`.github/workflows/beta.yml`)

**Trigger:** push a tag matching `v*-beta*` (e.g., `v0.2.0-beta.1`).

1. Checkout code at tag
2. Import Apple Developer certificate from secrets
3. Build signed + notarized DMG
4. Publish to GitHub Releases as **pre-release**

### Stable Release (`.github/workflows/release.yml`)

**Trigger:** push a tag matching `v*` but NOT `v*-beta*` (e.g., `v0.2.0`).

1. Checkout code at tag
2. Import Apple Developer certificate from secrets
3. Build signed + notarized DMG
4. Run smoke test
5. Publish to GitHub Releases with artifacts

### Rollback (`.github/workflows/rollback.yml`)

**Trigger:** manual via GitHub Actions UI (`workflow_dispatch`).

Inputs:
- `target_version` — git tag to roll back to (e.g., `v0.1.0`)
- `reason` — reason for rollback (included in release notes)

Rebuilds from the target version, replaces DMG assets on the existing GitHub Release, and marks it as latest so `electron-updater` clients auto-downgrade.

## Required Secrets

| Secret | Purpose | Used by |
|--------|---------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate | beta, release, rollback |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate export password | beta, release, rollback |
| `APPLE_ID` | Apple ID email for notarization | beta, release, rollback |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarization | beta, release, rollback |
| `APPLE_TEAM_ID` | Apple Developer Team ID | beta, release, rollback |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | all workflows |

See [Code Signing](CODE-SIGNING.md) for certificate setup instructions.

## Developer Workflow

### Running CI checks locally

```bash
# Lint
pnpm lint

# Unit tests
pnpm test

# E2E tests (requires Playwright browsers)
npx playwright install --with-deps
pnpm test:e2e

# Build verification (esbuild bundle)
pnpm compile

# Full DMG build (macOS only)
pnpm build
```

### Creating a release

```bash
# 1. Ensure CI passes on main
# 2. Bump version
pnpm version patch --no-git-tag-version

# 3. Commit and tag
git add package.json pnpm-lock.yaml
git commit -m "chore(release): vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
# → release.yml triggers automatically
```

### Creating a beta release

```bash
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
# → beta.yml triggers automatically
```

## Future Improvements

- [ ] Windows and Linux build targets
- [ ] Automated changelog generation from conventional commits
- [ ] Dependency caching audit (reduce `npm install` time)
- [ ] Parallelize Playwright tests across browsers
