# Release Process

This document describes how to build, version, and publish AgentOps Desktop releases.

## Overview

AgentOps Desktop is an Electron app distributed as macOS DMG files. Releases are published to GitHub Releases and served via `electron-updater` for auto-updates.

## Prerequisites

- Node.js >= 20
- npm >= 10
- macOS (for local builds; CI uses `macos-latest`)
- GitHub CLI (`gh`) authenticated with publish access
- GITHUB_TOKEN with `repo` scope (for electron-builder publish)
- Apple Developer account + code signing certificate (see [CODE-SIGNING.md](CODE-SIGNING.md))

## Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** — breaking changes to user-facing behavior or data format
- **MINOR** — new features, backwards-compatible
- **PATCH** — bug fixes, backwards-compatible

The version lives in `package.json` → `version`. Bump it before building the release.

```bash
# Patch: 0.1.0 → 0.1.1
npm version patch --no-git-tag-version

# Minor: 0.1.0 → 0.2.0
npm version minor --no-git-tag-version

# Major: 0.1.0 → 1.0.0
npm version major --no-git-tag-version
```

## Release Checklist

### 1. Prepare

- [ ] All CI checks pass on `main`
- [ ] No open blockers for the release milestone
- [ ] Changelog entry drafted (see below)

### 2. Version Bump

```bash
# Ensure clean working tree
git status

# Bump version
npm version patch --no-git-tag-version   # adjust as needed

# Commit
git add package.json package-lock.json
git commit -m "chore(release): vX.Y.Z"
```

### 3. Build

```bash
# Install dependencies
npm ci

# Build macOS DMG (arm64 + x64)
npm run build
```

Output goes to `release/`:
- `AgentOps-X.Y.Z-arm64.dmg` — Apple Silicon
- `AgentOps-X.Y.Z.dmg` — Intel
- `latest-mac.yml` — auto-update manifest

### 4. Tag and Push

```bash
git tag vX.Y.Z
git push origin main --tags
```

### 5. Publish to GitHub Releases

```bash
# Create release with artifacts
gh release create vX.Y.Z \
  release/AgentOps-*.dmg \
  release/latest-mac.yml \
  --title "vX.Y.Z" \
  --notes "## What's Changed
- <changelog entries here>"
```

### 6. Verify

- [ ] GitHub Release page shows both DMG artifacts
- [ ] Download and install the DMG on a clean machine
- [ ] Auto-update check picks up the new version (if previous version installed)

## Auto-Update Flow

The app uses `electron-updater` with GitHub Releases as the provider (configured in `package.json` → `build.publish`).

1. App checks `latest-mac.yml` on startup
2. If a newer version exists, it downloads the update silently
3. User is prompted to restart when download completes

No additional server or CDN is needed — GitHub Releases handles hosting.

## CI/CD Pipeline

### CI (`.github/workflows/ci.yml`)

Runs on every push and PR to `main`:

| Job | What it does |
|-----|-------------|
| `lint` | `npm run lint` |
| `test` | `npm run test` |
| `e2e` | Playwright tests (uploads report artifact) |
| `build-mac` | Builds DMG on macOS runner (unsigned, for verification) |

### Release (`.github/workflows/release.yml`)

Triggered automatically when a `v*` tag is pushed (excluding beta tags):

1. Import Apple Developer certificate from GitHub Secrets
2. Build signed DMGs (arm64 + x64)
3. Notarize with Apple
4. Publish to GitHub Releases with artifacts

### Beta Release (`.github/workflows/beta.yml`)

Triggered when a `v*-beta*` tag is pushed. Same build pipeline as stable, but marks the GitHub Release as **pre-release**. Use this to test builds with a subset of users before going stable.

### Rollback (`.github/workflows/rollback.yml`)

Manually triggered via GitHub Actions UI. Re-builds and re-publishes a previous stable version, causing `electron-updater` clients to auto-update back to that version. See [Rollback Strategy](#rollback-strategy) below.

**Required GitHub Secrets** (see [CODE-SIGNING.md](CODE-SIGNING.md) for setup):

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate export password |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

### Deployment Pipeline

```
         PR / push to main
               │
               ▼
┌──────────────────────────────────┐
│  CI: lint → test → e2e → build  │
└──────────────────────────────────┘
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
     │                    │
     ▼                    ▼
  Beta users           All users
  test & verify        auto-update
     │                    │
     └─── confirmed ──────┘
               │
          If issue found:
               │
               ▼
┌──────────────────────────┐
│  rollback.yml            │
│  (manual trigger)        │
│  Re-publishes previous   │
│  stable version          │
└──────────────────────────┘
```

### Release Flow

**Stable release:**
```bash
git tag v0.2.0 && git push origin v0.2.0
# → release.yml builds, signs, notarizes, publishes
# → electron-updater delivers to all users on next launch
```

**Beta release:**
```bash
git tag v0.2.0-beta.1 && git push origin v0.2.0-beta.1
# → beta.yml builds, signs, notarizes, publishes as pre-release
# → Beta testers with opted-in update configs receive the update
```

## Troubleshooting

### Build fails with missing icon

Ensure `assets/icon.icns` exists. Generate from a 1024x1024 PNG:

```bash
# Using iconutil (macOS)
mkdir icon.iconset
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
# ... (add all required sizes)
iconutil -c icns icon.iconset -o assets/icon.icns
```

### Auto-update not detecting new release

- Verify `latest-mac.yml` exists in the GitHub Release assets
- Check that the version in `latest-mac.yml` is higher than the installed version
- Ensure the app is signed (unsigned builds may not trigger updates on macOS)

### DMG rejected by macOS Gatekeeper

Until code signing is configured, users may need to:
1. Right-click the app → Open
2. Or: System Settings → Privacy & Security → Open Anyway

## Rollback Strategy

If a stable release has a critical issue, use the rollback workflow to revert all users to the previous version.

### When to Roll Back

- App crashes on launch for a significant portion of users
- Data loss or corruption bug discovered post-release
- Auto-update delivers a broken build
- Security vulnerability introduced in the release

### How to Roll Back

1. Go to **Actions** → **Rollback Release** → **Run workflow**
2. Enter the **target version** (e.g. `v0.1.0`) — the last known-good tag
3. Enter the **reason** for the rollback
4. Click **Run workflow**

The workflow will:
- Check out the target version's code
- Rebuild signed + notarized DMGs from that version
- Replace the DMGs and `latest-mac.yml` on the existing GitHub Release
- Update the release notes with the rollback reason and timestamp

Users' `electron-updater` clients will detect the re-published `latest-mac.yml` on their next launch and auto-update back to that version.

### Manual Rollback (Emergency)

If the workflow is unavailable, roll back manually:

```bash
# 1. Check out the last good version
git checkout v0.1.0

# 2. Install and build (no publish)
npm ci
npx electron-builder --mac --publish never

# 3. Replace assets on the existing release
gh release delete-asset v0.1.0 "latest-mac.yml" --yes 2>/dev/null || true
gh release upload v0.1.0 release/AgentOps-*.dmg release/latest-mac.yml --clobber
gh release edit v0.1.0 --latest

# 4. Clean up
git checkout main
```

### Post-Rollback Checklist

- [ ] Root cause identified and documented
- [ ] Fix implemented and tested on a beta release first
- [ ] New stable release includes the fix
- [ ] Incident post-mortem written (if data loss or extended outage)

## Future Improvements

- [x] Add `release` workflow to CI (triggered by `v*` tags)
- [x] Apple Developer code signing + notarization
- [ ] Windows and Linux build targets
- [ ] Automated changelog generation from conventional commits
- [x] Release candidate (RC) channel for pre-release testing
