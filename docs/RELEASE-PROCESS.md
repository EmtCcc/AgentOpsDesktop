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
| `build-mac` | Builds DMG on macOS runner (unsigned, for verification) |

### Release (`.github/workflows/release.yml`)

Triggered automatically when a `v*` tag is pushed:

1. Lint + test (via CI)
2. Import Apple Developer certificate from GitHub Secrets
3. Build signed DMGs (arm64 + x64)
4. Notarize with Apple
5. Publish to GitHub Releases with artifacts

**Required GitHub Secrets** (see [CODE-SIGNING.md](CODE-SIGNING.md) for setup):

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate export password |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

### Release Flow

```
git tag v0.2.0 && git push origin v0.2.0
        │
        ▼
┌─────────────────────────────────┐
│  GitHub Actions: release.yml    │
│                                 │
│  1. Lint + Test                 │
│  2. Import certificate          │
│  3. Build signed DMGs           │
│  4. Notarize with Apple         │
│  5. Publish to GitHub Releases  │
└─────────────────────────────────┘
        │
        ▼
  electron-updater picks up latest-mac.yml
  Users auto-update on next launch
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

## Future Improvements

- [x] Add `release` workflow to CI (triggered by `v*` tags)
- [x] Apple Developer code signing + notarization
- [ ] Windows and Linux build targets
- [ ] Automated changelog generation from conventional commits
- [ ] Release candidate (RC) channel for pre-release testing
