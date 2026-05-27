# Dependency Audit Report

**Date:** 2026-05-28
**Auditor:** DevOps Engineer
**Scope:** Full project dependency tree

## Summary

| Metric | Value |
|--------|-------|
| Declared dependencies | 1 (`electron`) |
| Transitive dependencies (from lock) | 23 |
| Extraneous packages in node_modules | 391 |
| npm audit vulnerabilities | 15 (5 moderate, 10 high) |
| Vulnerabilities in declared deps | 0 |
| Missing deps (used but undeclared) | 2 |

## 1. Declared Dependencies

| Package | Declared | Installed | Latest | Status |
|---------|----------|-----------|--------|--------|
| electron | ^42.3.0 | 42.3.0 | 42.3.0 | Current (latest stable) |

electron 42.3.0 is the latest stable release. Electron 43 is in alpha only. No action needed.

## 2. Missing Dependencies (CRITICAL)

These packages are `require()`'d in source code but not declared in `package.json`:

| Package | Used In | Installed? | Latest | Action |
|---------|---------|------------|--------|--------|
| `better-sqlite3` | `src/main/db/connection.js` | 11.10.0 (in node_modules) | 12.10.0 | Add to dependencies, upgrade to 12.x |
| `uuid` | Source (uuidv4) | NOT installed | 14.0.0 | Add to dependencies |

**Risk:** `better-sqlite3` is a native module with C++ bindings. Major version 12 may have breaking API changes. `uuid` v14 is ESM-only; if CommonJS `require()` is used, stay on v11.x or use dynamic import.

## 3. Extraneous Packages (HIGH)

391 packages exist in `node_modules` without being declared in `package.json` or `package-lock.json`. These are leftovers from prior manual installs or global linkage. Major categories:

| Category | Examples | Count (approx) |
|----------|----------|-----------------|
| Build tooling | electron-builder, @electron/osx-sign, @electron/rebuild, dmg-builder | ~60 |
| Linting | eslint 9.39.4, @eslint/*, espree, acorn | ~30 |
| Testing | vitest, @playwright/test, vite, vite-node | ~80 |
| Bundling | esbuild, rollup, @rollup/* | ~30 |
| Node ecosystem | tar, node-gyp, npmcli/*, gauge, npm-* | ~100 |
| Misc | lodash, got, glob, semver, various @types/* | ~90 |

**Action:** Run `npm prune` to remove extraneous packages. If any of these tools are intentionally needed, declare them in `package.json`.

## 4. Vulnerabilities

### In extraneous packages only (NOT in declared deps)

| Advisory | Severity | Package | Fix |
|----------|----------|---------|-----|
| GHSA-67mh-4wv8-2f99 | Moderate | esbuild <=0.24.2 | Upgrade esbuild |
| GHSA-5j98-mcp5-4vw2 | High | glob 10.2.0-10.4.5 | Upgrade glob |
| GHSA-34x7-hfp2-rc4v + 5 more | High | tar <=7.5.10 | Upgrade tar / electron-builder |

All 15 vulnerabilities are in extraneous packages that should not be in the project. Removing them (via `npm prune`) eliminates all vulnerabilities.

## 5. Upgrade Plan

### Phase 1: Clean up (Immediate)

```bash
# Remove all extraneous packages
npm prune

# Verify clean state
npm ls --all 2>&1 | grep -c "extraneous"
# Expected: 0
```

### Phase 2: Add missing dependencies

```bash
# Add runtime dependencies
npm install better-sqlite3@^11.10.0 uuid@^11.0.0

# Or if CJS require() must be preserved:
npm install better-sqlite3@^11.10.0 uuid@^9.0.0
```

**Note on uuid:** v14 is ESM-only. If using `require('uuid')`, pin to `^9.0.0` (last CJS version) or migrate to dynamic `import()`. v11 ships both CJS and ESM — safest upgrade target.

**Note on better-sqlite3:** v12 is a major bump. Test the DB layer thoroughly before upgrading. Recommended: add at v11 first, then upgrade to v12 in a separate PR with integration tests.

### Phase 3: Add missing tooling as devDependencies (if needed)

If eslint, playwright, or vitest are intentionally used:

```bash
npm install --save-dev eslint@^9.39.0 @playwright/test@^1.60.0 vitest@latest
```

If not needed, ensure `.gitignore` excludes `node_modules/` and no CI references these tools.

### Phase 4: Lock file regeneration

```bash
rm -rf node_modules package-lock.json
npm install
npm audit
```

## 6. Recommendations

1. **Add `.npmrc`** with `package-lock=true` and `save-exact=true` for reproducible builds
2. **Add `.nvmrc`** pinning Node.js version (project uses v24.13.0)
3. **Add `engines` field** to `package.json` to enforce Node.js version
4. **Set up `npm audit` in CI** to catch future vulnerabilities
5. **Consider Dependabot or Renovate** for automated dependency updates
