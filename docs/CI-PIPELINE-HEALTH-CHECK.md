# CI Pipeline Health Check

**Issue:** CMPAAA-495 (successor to CMPAAA-489)
**Date:** 2026-05-29
**Status:** ⚠️ DEGRADED — lint gate still failing, coverage critically low

---

## Pipeline Overview

| Workflow | File | Triggers | Status |
|----------|------|----------|--------|
| CI | `ci.yml` | push/PR to main | ❌ lint failing |
| SAST | `sast.yml` | push/PR + weekly cron | ✅ passing |
| Deploy | `deploy.yml` | after CI + SAST | ❌ blocked by CI |
| Benchmarks | `benchmarks.yml` | push/PR to main | ✅ `continue-on-error: true` |
| Beta Release | `beta.yml` | `v*-beta*` tags | ✅ macOS only |
| Release | `release.yml` | `v*` tags | ✅ 3-platform matrix |
| Deploy Docs | `docs.yml` | push to `docs-site/**` | ⚠️ recent failures |
| Rollback | `rollback.yml` | manual dispatch | ✅ macOS rebuild |

**Total: 8 workflows, 2 actively failing on main.**

---

## Gate 1: Lint ❌ FAILING (unchanged from CMPAAA-489)

**155 problems (154 errors, 1 warning)** — blocks CI on every push.

| Rule | Count | Severity |
|------|-------|----------|
| `no-unused-vars` | 108 | error |
| `no-undef` | 13 | error |
| `no-use-before-define` | 10 | error |
| `eqeqeq` | 7 | error |
| `jsx-a11y/click-events-have-key-events` | 6 | error |
| `jsx-a11y/label-has-associated-control` | 5 | error |
| `no-promise-executor-return` | 3 | error |
| `jsx-a11y/no-autofocus` | 1 | error |
| `jsx-a11y/role-supports-aria-props` | 1 | error |
| `jsx-a11y/role-has-required-aria-props` | 1 | error |

**Top offenders by file:**

| File | Errors |
|------|--------|
| `src/renderer/pages/SquadsPage.jsx` | 24 |
| `src/renderer/pages/GroupChatPage.jsx` | 19 |
| `src/renderer/pages/SettingsPage.jsx` | 19 |
| `src/renderer/pages/WorkflowsPage.jsx` | 15 |
| `src/renderer/pages/CostDashboardPage.jsx` | 11 |
| `src/renderer/app.js` | 10 |
| `src/renderer/pages/AgentsPage.jsx` | 10 |
| `src/renderer/pages/TasksPage.jsx` | 10 |

**Root cause:** Bulk feature commits introduced unused imports/variables and loose equality checks. The 108 `no-unused-vars` errors are mostly unused icon imports in renderer pages — dead code from UI work-in-progress. Accessibility rules (jsx-a11y) account for 13 additional errors.

**Impact:** CI lint job fails on every push to main and every PR. The `build` job depends on `lint`, so no builds pass through CI. Deploy workflow is also blocked.

---

## Gate 2: Unit Tests ✅ PASSING

```
Test Files  51 passed (51)
     Tests  1148 passed (1148)
  Duration  2.20s
```

All 51 test files pass. Zero failures, zero flaky tests. Test infrastructure is healthy.

---

## Gate 3: Coverage ⚠️ CRITICALLY LOW

| Metric | Current | CI Target | Gap |
|--------|---------|-----------|-----|
| Statements | 1.89% | 50% | -48.11% |
| Branches | 27.27% | 50% | -22.73% |
| Functions | 19.60% | 50% | -30.40% |
| Lines | 1.89% | 50% | -48.11% |

**Note:** CI thresholds are set to 0% in `ci.yml` (lines 34-37), so coverage does not currently block builds. However, the 50% target shown in the coverage summary report is aspirational. At 1.89% statement coverage, the test suite validates behavior but covers very little actual source code.

---

## Gate 4: E2E Tests ✅ AVAILABLE

- **12 spec files** (Playwright): smoke, cross-browser, navigation, dashboard, agents, task-board, logs, squads, settings, workflows, snapshot, performance
- Not run locally (requires Electron), but test infrastructure is healthy
- Playwright report generated at `playwright-report/index.html`

---

## Gate 5: Security (SAST) ✅ PASSING

Last run: `success` (2026-05-29)

- **CodeQL:** JavaScript analysis with `security-extended` queries
- **Semgrep:** Multi-config scan (JS, TS, Node, OWASP Top 10, security-audit)
- **Dependency audit:** `npm audit --audit-level=high`
- **ESLint security rules:** Separate security-focused lint pass

---

## Gate 6: Build ❌ BLOCKED BY LINT

- 3-platform matrix: macOS (.dmg), Windows (.exe), Linux (.AppImage)
- Depends on `lint`, `test`, `e2e` — all must pass
- `build` job has `needs: [lint, test, e2e]` — lint failure blocks all builds
- Smoke test runs on macOS builds only

---

## Recent GitHub Actions Runs (2026-05-29)

| Workflow | Commit | Status | Duration |
|----------|--------|--------|----------|
| Deploy | main (workflow_run) | ❌ failure | 7s |
| Deploy | main (workflow_run) | ❌ failure | 8s |
| Performance Benchmarks | CMPAAA-473 re-verification | ✅ success | 5m5s |
| Deploy Docs | CMPAAA-473 re-verification | ❌ failure | 14s |
| CI | CMPAAA-473 re-verification | ❌ failure | 29m |
| SAST | CMPAAA-473 re-verification | ✅ success | 1m50s |

**Pattern:** CI fails due to lint gate → Deploy fails because CI gate failed → Deploy Docs has separate failures (likely link checker or build issue).

---

## Regressions

| Regression | Severity | Status | Details |
|------------|----------|--------|---------|
| Lint gate broken | **HIGH** | ⚠️ Unchanged | 155 errors block all CI builds (same count as CMPAAA-489) |
| Coverage at 1.89% | **MEDIUM** | ⚠️ New finding | Statement coverage far below 50% aspirational target |
| Deploy Docs failures | **LOW** | ⚠️ New finding | Recent failures on docs deploy workflow |

---

## Recommendations

### Priority 1: Unblock CI (fix lint)

1. **Bulk-fix `no-unused-vars` (108 errors):** Remove unused imports or prefix with `_` if intentionally unused. This alone resolves 70% of lint errors.
2. **Fix `no-undef` (13 errors):** Add missing imports or declare globals.
3. **Fix `eqeqeq` (7 errors):** Replace `==`/`!=` with `===`/`!==`.
4. **Fix `no-use-before-define` (10 errors):** Reorder declarations or use function hoisting.
5. **Fix `jsx-a11y` (13 errors):** Add keyboard handlers, labels, and ARIA attributes.
6. **Fix `no-promise-executor-return` (3 errors):** Remove return values from promise executors.

### Priority 2: Prevent regression

7. **Add `lint-staged` + husky pre-commit hook** to catch lint errors before they reach CI.
8. **Consider relaxing coverage thresholds** or setting realistic incremental targets.

### Priority 3: Investigate Deploy Docs failures

9. **Check Deploy Docs workflow** for link checker or VitePress build issues.

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
