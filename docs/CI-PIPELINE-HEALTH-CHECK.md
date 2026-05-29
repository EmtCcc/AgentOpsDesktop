# CI Pipeline Health Check

**Issue:** CMPAAA-489
**Date:** 2026-05-29
**Status:** ⚠️ DEGRADED — lint gate failing

---

## Pipeline Overview

| Workflow | File | Triggers | Status |
|----------|------|----------|--------|
| CI | `ci.yml` | push/PR to main | ⚠️ lint failing |
| SAST | `sast.yml` | push/PR + weekly cron | ✅ configured correctly |
| Deploy | `deploy.yml` | after CI + SAST | ✅ gated on both |
| Benchmarks | `benchmarks.yml` | push/PR to main | ✅ `continue-on-error: true` |
| Beta Release | `beta.yml` | `v*-beta*` tags | ✅ macOS only |
| Release | `release.yml` | `v*` tags | ✅ 3-platform matrix |
| Deploy Docs | `docs.yml` | push to `docs-site/**` | ✅ GitHub Pages |
| Rollback | `rollback.yml` | manual dispatch | ✅ macOS rebuild |

**Total: 8 workflows, all structurally sound.**

---

## Gate 1: Lint ❌ FAILING

**155 problems (154 errors, 1 warning)** — would block CI on every push.

| Rule | Count | Severity |
|------|-------|----------|
| `no-unused-vars` | 108 | error |
| `no-undef` | 13 | error |
| `no-use-before-define` | 10 | error |
| `eqeqeq` | 7 | error |
| `no-promise-executor-return` | 3 | error |

**Affected files (24):**

Main process:
- `src/main/adapter-registry-client.js`
- `src/main/adapter-registry-service.js`
- `src/main/adapters/claude-code.adapter.js`
- `src/main/adapters/gemini-cli.adapter.js`
- `src/main/api/routes/cost.js`
- `src/main/group-chat-engine.js`
- `src/main/ipc/controllers/adapter-registry.controller.js`
- `src/main/ipc/controllers/telemetry.controller.js`
- `src/main/message-bus/socket-server.js`
- `src/main/notification-service.js`
- `src/main/scheduler.js`
- `src/main/task-orchestrator.js`
- `src/main/token-parser.js`

Renderer:
- `src/renderer/app.js`
- `src/renderer/pages/ActivityTimelinePage.jsx`
- `src/renderer/pages/AgentsPage.jsx`
- `src/renderer/pages/CostDashboardPage.jsx`
- `src/renderer/pages/GroupChatPage.jsx`
- `src/renderer/pages/LogsPage.jsx`
- `src/renderer/pages/SettingsPage.jsx`
- `src/renderer/pages/SquadsPage.jsx`
- `src/renderer/pages/TasksPage.jsx`
- `src/renderer/pages/WorkflowsPage.jsx`

**Root cause:** Bulk feature commits introduced unused imports/variables and loose equality checks. The `no-unused-vars` errors (108) are mostly unused icon imports in renderer pages — likely dead code from UI work-in-progress.

**Impact:** CI lint job will fail on every push to main and every PR. The `build` job depends on `lint`, so no builds pass through CI.

---

## Gate 2: Unit Tests ✅ PASSING

```
Test Files  51 passed (51)
     Tests  1148 passed (1148)
  Duration  2.27s
```

All 51 test files pass. Zero failures, zero flaky tests detected.

---

## Gate 3: E2E Tests ✅ AVAILABLE

- **783 tests in 12 files** (Playwright)
- Covers: snapshot tests, integration, cross-browser, mobile, performance
- Not run locally (requires Electron), but test infrastructure is healthy

---

## Gate 4: Security (SAST) ✅ CONFIGURED

- **CodeQL:** JavaScript analysis with `security-extended` queries
- **Semgrep:** Multi-config scan (JS, TS, Node, OWASP Top 10, security-audit)
- **Dependency audit:** `npm audit --audit-level=high` (note: npm mirror doesn't support audit endpoint — may produce empty results in CI)
- **ESLint security rules:** Separate security-focused lint pass

---

## Gate 5: Build ⚠️ BLOCKED BY LINT

- 3-platform matrix: macOS (.dmg), Windows (.exe), Linux (.AppImage)
- Depends on `lint`, `test`, `e2e` — all must pass
- `build` job has `needs: [lint, test, e2e]` — lint failure blocks all builds
- Smoke test runs on macOS builds only

---

## Regressions

| Regression | Severity | Details |
|------------|----------|---------|
| Lint gate broken | **HIGH** | 155 errors block all CI builds |
| npm audit endpoint | **LOW** | Mirror doesn't support audit — SAST dependency-audit job may produce empty results |

---

## Recommendations

1. **Immediate:** Fix the 108 `no-unused-vars` errors — these are the bulk of failures. Remove unused imports or prefix with `_` if intentionally unused.
2. **Next:** Fix the 13 `no-undef` errors — likely missing imports or global declarations.
3. **Then:** Fix `no-use-before-define` (10), `eqeqeq` (7), `no-promise-executor-return` (3).
4. **Consider:** Adding a pre-commit hook (`lint-staged`) to prevent new lint errors from entering the repo.
5. **Consider:** Switching npm audit to use the official registry instead of the mirror for CI security scans.

---

## Files Reviewed

- `.github/workflows/ci.yml`
- `.github/workflows/sast.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/benchmarks.yml`
- `.github/workflows/beta.yml`
- `.github/workflows/release.yml`
- `.github/workflows/docs.yml`
- `.github/workflows/rollback.yml`
- `package.json`
- `docs/CI-CD.md`
- `docs/HEALTH-CHECK-VERIFICATION.md`
