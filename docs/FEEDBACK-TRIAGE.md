# Feedback Triage — AgentOps Desktop

**Date**: 2026-05-28
**Source**: Design-phase evaluations (USER-TESTING.md, SECURITY-REVIEW.md, CODEBASE-AUDIT.md, DESIGN-SYSTEM.md)
**Status**: Initial triage — no running code, no external users yet

---

## Summary

| Category | Critical | Major | Minor | Total |
|----------|----------|-------|-------|-------|
| Critical Bugs | 3 | — | — | 3 |
| UX Issues | — | 6 | 5 | 11 |
| Feature Requests | — | — | — | 0 |
| Security (projected) | — | 2 | 2 | 4 |
| **Total** | **3** | **8** | **7** | **18** |

---

## Critical Bugs

These must be resolved before or during the first implementation sprint. They block usability or accessibility.

### C1 — No error messages or recovery flows for agent failures

- **Source**: USER-TESTING.md (H9)
- **Impact**: Users see a red dot but don't know what happened or how to fix it. Blocks task completion understanding.
- **Action**: Define error messages, recovery flows, and error state content for every failure mode (agent crash, timeout, invalid config, connection lost).

### C2 — Tertiary text color fails WCAG AA contrast

- **Source**: USER-TESTING.md (Accessibility), DESIGN-SYSTEM.md
- **Impact**: `--color-text-tertiary` (`#484F58` on `#0D1117`) has a 2.8:1 contrast ratio. Disabled/placeholder text is unreadable for low-vision users.
- **Action**: Change `--color-text-tertiary` from `#484F58` to at least `#6E7681` (4.5:1 ratio).

### C3 — No ARIA live regions for real-time status updates

- **Source**: USER-TESTING.md (Accessibility)
- **Impact**: Screen reader users won't receive agent status changes or log updates.
- **Action**: Document ARIA roles, live regions, and keyboard interaction patterns for all custom components.

---

## UX Issues

### Major (6)

| # | Issue | Source | Impact |
|---|-------|--------|--------|
| M1 | No task progress indicator beyond binary states | USER-TESTING.md (H1) | Users can't distinguish "almost done" from "stuck" for long-running tasks |
| M2 | No cancel/undo for running tasks | USER-TESTING.md (H3) | Users can't stop a misbehaving agent. Deferred to M3 is too late |
| M3 | No edit flow for goals/tasks after creation | USER-TESTING.md (H3) | Users must delete and recreate for any change |
| M4 | No guardrail for assigning tasks to offline agents | USER-TESTING.md (H5) | Silent failure when agent goes offline between assignment and execution |
| M5 | No keyboard shortcuts defined | USER-TESTING.md (H7) | Power users can't operate efficiently. Tab-only navigation is slow |
| M6 | No onboarding or first-run experience | USER-TESTING.md (H10) | Novel product category needs guided introduction |

### Minor (5)

| # | Issue | Source | Impact |
|---|-------|--------|--------|
| m1 | No visual notification for status transitions | USER-TESTING.md (H1) | Users may miss status changes if not watching dashboard |
| m2 | No light mode implementation | USER-TESTING.md (H4) | Some users prefer light themes |
| m3 | No search/filter for agents or tasks | USER-TESTING.md (H6) | Scrolling fatigue as count grows |
| m4 | No confirmation dialog for destructive actions | USER-TESTING.md (H5) | Accidental data loss possible |
| m5 | No log output rate limiting or virtual scrolling | USER-TESTING.md (Edge cases) | Verbose agents could overwhelm the UI |

---

## Security (Projected)

These aren't bugs today — there's no code. But they must be addressed during implementation.

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| S1 | Electron security posture not configured | High | SECURITY-REVIEW.md (F-003) |
| S2 | Subprocess execution — command injection risk | High | SECURITY-REVIEW.md (F-004) |
| S3 | CI actions not pinned by SHA | Medium | SECURITY-REVIEW.md (F-001) |
| S4 | No CSP configured | Medium | SECURITY-REVIEW.md (F-006) |

---

## Feature Requests

No feature requests yet — no external users to generate them. This section will populate once the app reaches alpha.

---

## Prioritized Action Items

### Before implementation (blockers)

1. Fix tertiary text contrast (C2) — trivial CSS change
2. Define error UX spec (C1) — create `docs/ERROR-UX.md`
3. Specify ARIA patterns (C3) — update DESIGN-SYSTEM.md

### Sprint 1-2 (M1 Foundation)

4. Add task cancel capability (M2) — don't defer to M3
5. Add edit flow for goals/tasks (M3)
6. Define keyboard shortcuts (M5) — update DESIGN-SYSTEM.md
7. Implement Electron security config (S1, S4) — ADR + CSP
8. Secure subprocess execution (S2) — spawn with arg arrays

### Sprint 3-4 (M2 Observability)

9. Add task progress sub-states (M1)
10. Add offline agent guardrail (M4)
11. Build onboarding flow (M6)
12. Add status transition notifications (m1)

### Post-MVP

13. Light mode (m2)
14. Search/filter (m3)
15. Destructive action confirmations (m4)
16. Log virtual scrolling (m5)
