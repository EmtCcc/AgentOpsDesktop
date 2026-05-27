# Design & UX Audit — Live Application Code

**Date**: 2026-05-28
**Auditor**: UI & Brand Designer
**Scope**: Page-by-page visual and UX audit of the implemented Electron renderer (`src/renderer/`)
**Reference**: `docs/BRAND-IDENTITY.md`, `docs/DESIGN-SYSTEM.md`, `src/renderer/styles/tokens.css`
**Previous audit**: `docs/DESIGN-AUDIT.md` (documentation-only, by cross-functional auditor)

---

## Summary

The application implements a functional dark-theme ops dashboard with consistent design token usage. The design system foundation (tokens, base styles, layout) is solid. However, the audit reveals **accessibility gaps**, **inconsistent inline styling**, **missing interaction states**, and **incomplete component patterns** that need resolution before any public release.

**Verdict**: Foundation is sound. 12 blocking issues, 8 high-priority improvements, 10 polish items.

---

## 0. Global Shell (Header + Sidebar + Footer)

### What Works
- Grid layout (`layout.css:4-14`) correctly implements the 3-row, 2-column shell defined in DESIGN-SYSTEM.md
- Header height (48px), sidebar width (240px/48px collapsed), footer (28px) all match design tokens
- Sidebar active indicator (`layout.css:138-148`) — accent blue left bar — is clean and on-brand
- `titlebar-drag` region correctly excludes interactive elements (`base.css:103-110`)

### Issues

| # | Severity | Issue | Location | Recommendation |
|---|----------|-------|----------|----------------|
| G-1 | **Critical** | `button` has `outline: none` with no replacement focus indicator | `base.css:54` | Add `button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` |
| G-2 | **Critical** | `input, select, textarea` has `outline: none` — keyboard users lose focus visibility | `base.css:65` | Replace with `:focus-visible` outline matching design system spec |
| G-3 | **High** | No `prefers-reduced-motion` support in production CSS | All style files | Add `@media (prefers-reduced-motion: reduce)` block per BRAND-IDENTITY.md §8 |
| G-4 | **High** | No ARIA landmarks — `<header>`, `<nav>`, `<main>`, `<footer>` lack `role` attributes | `index.html:14-103` | Add `role="banner"` to header, `role="navigation"` to sidebar, `role="main"` to main, `role="contentinfo"` to footer |
| G-5 | **Medium** | Sidebar collapse has no CSS transition — instant jump | `layout.css:78` | `transition: width var(--motion-normal)` exists but sidebar items lack transition for label hide |
| G-6 | **Medium** | No loading state for async IPC calls — UI shows stale/zero values until data arrives | `app.js:141-154` | Add skeleton loading or spinner for stat cards |
| G-7 | **Low** | Header title "AgentOps" has no logo/icon — just text | `index.html:23` | Add app icon or logomark before text for brand recognition |
| G-8 | **Low** | Footer version `v0.1.0` is hardcoded | `index.html:96` | Read from `package.json` via IPC |

---

## 1. Dashboard Page

### What Works
- Stat cards grid (4-column) matches design spec
- Semantic color coding for stat icons (accent/success/warning/danger) is consistent
- Activity feed + Quick actions 2:1 grid layout is a good information hierarchy
- `loadStats()` and `loadRecentActivity()` gracefully handle IPC unavailability

### Issues

| # | Severity | Issue | Location | Recommendation |
|---|----------|-------|----------|----------------|
| D-1 | **High** | Stat card icons use inline `stat__icon` class but the parent `.dashboard-stats .card` doesn't define `position: relative` or `overflow` — icon can bleed on small sizes | `pages.css:12-16` | Add `overflow: hidden` to `.dashboard-stats .card` |
| D-2 | **High** | No `aria-live="polite"` region for dynamic stat values | `app.js:74-100` | Wrap stats in `<div aria-live="polite">` for screen reader updates |
| D-3 | **Medium** | Empty activity feed shows terminal icon + text in a generic empty state — no visual differentiation from other empty states | `app.js:110-114` | Use a more distinctive empty state illustration or animation |
| D-4 | **Medium** | "Quick actions" buttons use `data-navigate` but don't have `aria-label` describing the action | `app.js:122-130` | Add `aria-label="Navigate to agents page"` etc. |
| D-5 | **Medium** | Dashboard stats don't animate/count up when values load — static number swap feels jarring | `app.js:145-148` | Add subtle number transition or count-up animation |
| D-6 | **Low** | "View all" button in activity feed header uses `data-navigate="logs"` but has no visual indication it's a link-styled button | `app.js:107` | Consider using anchor-style or underline to signal navigation |

---

## 2. Agents Page

### What Works
- Agent list with status dot + badge pattern is clean and scannable
- Health check and delete action buttons are appropriately sized and placed
- Empty state with icon + title + description + CTA button follows good empty state pattern
- Modal overlay for "Add agent" form is functional

### Issues

| # | Severity | Issue | Location | Recommendation |
|---|----------|-------|----------|----------------|
| A-1 | **Critical** | Modal overlay has duplicate `display` property: `style="display:none; ... display:none;"` | `index.html:202` | Remove duplicate `display:none` — the second one overrides the `align-items` / `justify-content` set later |
| A-2 | **Critical** | Modal form inputs have no `<label>` association — `<label>` elements exist visually but are not linked via `for`/`id` | `app.js:209-229` | Add `for="agent-name"` etc. to label elements |
| A-3 | **High** | No form validation feedback — empty name silently fails | `app.js:294` | Add validation state (red border + error message) for required fields |
| A-4 | **High** | Delete button has no confirmation dialog — destructive action is one click | `app.js:316-319` | Add confirmation modal: "Delete agent? This cannot be undone." per BRAND-IDENTITY.md §7 |
| A-5 | **High** | Agent rows use inline `style` for modal overlay positioning | `index.html:202` | Move to CSS class `.modal-overlay` |
| A-6 | **Medium** | Status badge text is lowercase (`running`, `idle`, `error`) — BRAND-IDENTITY.md says sentence case | `app.js:258` | Capitalize: "Running", "Idle", "Error" |
| A-7 | **Medium** | Agent type displayed in monospace (`agent-row__type`) but no visual indicator of what type means | `pages.css:139-142` | Consider adding a type icon or tooltip |
| A-8 | **Medium** | "Add agent" modal has no Escape key handler to close | `app.js:270-279` | Add `keydown` listener for Escape |
| A-9 | **Low** | No hover state defined for agent row actions (health/delete buttons) | `pages.css:145-148` | Buttons inherit ghost hover but row-level hover could highlight actions |

---

## 3. Tasks Page (Kanban Board)

### What Works
- 4-column kanban layout (Pending / Running / Done / Failed) is clear
- Column headers with count badges provide good at-a-glance status
- Task cards with title + agent + timestamp metadata are well-structured
- Card hover effect with border color change + shadow is subtle and effective

### Issues

| # | Severity | Issue | Location | Recommendation |
|---|----------|-------|----------|----------------|
| T-1 | **Critical** | No drag-and-drop support — kanban board is display-only | `app.js:327-405` | Implement drag-and-drop for task status changes (or disable the kanban metaphor if not planned) |
| T-2 | **High** | Task columns use `grid-template-columns: repeat(4, 1fr)` — at narrow widths, 4 columns become unreadable | `pages.css:152-157` | Add responsive breakpoint: stack columns vertically < 1200px, or switch to tab view |
| T-3 | **High** | No empty column visual — "No tasks" text is plain with no visual anchor | `app.js:388` | Add subtle dashed border or icon to empty columns |
| T-4 | **Medium** | Task card click does nothing — cards are `cursor: pointer` but have no click handler | `app.js:392-400`, `pages.css:202` | Either implement task detail view or remove `cursor: pointer` |
| T-5 | **Medium** | Column titles ("Pending", "Running", etc.) use sentence case but the count badge sits inline — no visual separation | `app.js:343-345` | Add `gap` between title text and count badge |
| T-6 | **Medium** | Task agent shown as raw ID (`t.agentId || 'unassigned'`) — no agent name resolution | `app.js:396` | Resolve agent ID to name for display |
| T-7 | **Low** | No visual distinction between column statuses — all columns look identical | `pages.css:159-163` | Add subtle color accent to column headers (e.g., pending=blue, running=green, done=gray, failed=red) |

---

## 4. Logs Page

### What Works
- Terminal-style log viewer with monospace font is appropriate for the audience
- Log line structure (timestamp + agent tag + stderr tag + message) is well-organized
- Real-time log subscription with auto-scroll is functional
- Filter controls (agent + level) are useful and positioned correctly
- Error/warn log lines use semantic colors (red/amber) for quick scanning

### Issues

| # | Severity | Issue | Location | Recommendation |
|---|----------|-------|----------|----------------|
| L-1 | **Critical** | `word-break: break-all` mids-word — log output becomes unreadable | `pages.css:294` | Use `overflow-wrap: break-word` instead, or `overflow-x: auto` with `white-space: pre` |
| L-2 | **High** | No `aria-live="polite"` on log viewer — screen readers won't announce new entries | `app.js:596` | Add `aria-live="polite"` and `role="log"` to the viewer container |
| L-3 | **High** | Log viewer height is calculated with `calc(100vh - ... - 140px)` — magic number, fragile if header/footer change | `pages.css:278` | Use CSS Grid to let the log viewer fill remaining space naturally |
| L-4 | **Medium** | "Clear" button empties the viewer without confirmation | `app.js:671-674` | Add confirmation or undo toast for destructive clear |
| L-5 | **Medium** | Filter dropdowns use native `<select>` with inline styles — inconsistent with design system | `app.js:580-589` | Style selects to match `.logs-filter` class or build custom dropdown |
| L-6 | **Medium** | No search/filter by text content — only by agent and level | `app.js:668-688` | Add text search input for log message filtering |
| L-7 | **Low** | Log line tag font size is hardcoded `10px` instead of using `--text-xs` (11px) | `pages.css:319` | Use `var(--text-xs)` for consistency |
| L-8 | **Low** | No "jump to bottom" button when scrolled up in log viewer | — | Add floating button to scroll to latest entries |

---

## 5. Settings Page

### What Works
- Clean section-based layout with dividers
- Settings rows with label + description + control pattern is scannable
- Max-width constraint (640px) prevents overly wide form elements

### Issues

| # | Severity | Issue | Location | Recommendation |
|---|----------|-------|----------|----------------|
| S-1 | **Critical** | Settings inputs have no `<label>` association — `<label>` text is visual only | `app.js:419-476` | Add `for`/`id` linking for all settings inputs |
| S-2 | **High** | Settings values are hardcoded — no persistence or IPC binding | `app.js:449-458` | Bind to settings store via IPC; show current values from config |
| S-3 | **High** | No "Save" or "Apply" button — changes to inputs have no effect | `app.js:410-476` | Add save button or auto-save with visual confirmation |
| S-4 | **Medium** | Number inputs use inline `style="width: 64px; text-align: center;"` — should use CSS class | `app.js:449-458` | Add `.settings-input--number` class |
| S-5 | **Medium** | No validation on number inputs — user can type values outside min/max | `app.js:449-458` | Add client-side validation with error state |
| S-6 | **Low** | "App version" and "Platform" are read-only but styled identically to editable settings | `app.js:422-437` | Differentiate read-only rows (e.g., lighter text, no border on control) |
| S-7 | **Low** | No "About" section or link to documentation/changelog | — | Add links to docs, GitHub repo, and changelog |

---

## 6. Cross-Cutting Findings

### 6.1 Accessibility (WCAG 2.2 AA)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 1.1.1 Non-text Content | ⚠️ Partial | SVG icons lack `aria-label` or `<title>` elements |
| 1.3.1 Info and Relationships | ❌ Fail | Form inputs not associated with labels; no ARIA landmarks |
| 1.4.3 Contrast (Minimum) | ✅ Pass | `#E6EDF3` on `#0D1117` = 13.1:1; accent `#58A6FF` on dark = 5.9:1 |
| 1.4.11 Non-text Contrast | ✅ Pass | Status dots and borders meet 3:1 |
| 2.1.1 Keyboard | ❌ Fail | Buttons have `outline: none`; no visible focus on interactive elements |
| 2.4.7 Focus Visible | ❌ Fail | No `:focus-visible` styles defined for buttons |
| 4.1.2 Name, Role, Value | ⚠️ Partial | Buttons have `title` but no `aria-label`; status badges lack `aria-label` |
| 4.1.3 Status Messages | ❌ Fail | No `aria-live` regions for dynamic content (stats, logs, task updates) |

### 6.2 Design Token Compliance

| Token Category | Compliance | Notes |
|----------------|------------|-------|
| Colors | ✅ 98% | All colors use tokens. One hardcoded `#FFFFFF` in button text (`components.css:23`) — acceptable for contrast |
| Typography | ⚠️ 90% | One hardcoded `10px` in log tags; all other sizes use tokens |
| Spacing | ⚠️ 85% | Inline styles in JS templates use hardcoded values (e.g., `style="padding: var(--space-8) 0;"`) — mixed |
| Border Radius | ✅ 100% | All border-radius values use tokens |
| Shadows | ✅ 100% | Task card hover uses `--shadow-sm` correctly |
| Motion | ⚠️ 80% | Transitions use tokens, but `prefers-reduced-motion` not implemented |

### 6.3 Brand Consistency

| Aspect | Status | Notes |
|--------|--------|-------|
| Color palette | ✅ Consistent | Matches BRAND-IDENTITY.md exactly (`#58A6FF` accent) |
| Typography (Inter + JetBrains Mono) | ✅ Consistent | Both fonts referenced in `--font-sans` and `--font-mono` |
| Icon style (Lucide, stroke-based) | ✅ Consistent | All SVGs use `stroke="currentColor"`, `stroke-width="2"` |
| Voice/tone in UI copy | ✅ Good | "No agents configured" not "You don't have any agents yet!" — on-brand |
| Sentence case | ⚠️ Partial | Page titles correct; status badges lowercase |
| Dark theme default | ✅ Correct | `#0D1117` background matches spec |

### 6.4 Inline Style Proliferation

The JS templates (`app.js`) contain **38 inline `style` attributes** across all pages. These should be migrated to CSS classes for:
- Maintainability (changes require editing JS, not CSS)
- Consistency (inline values can drift from design tokens)
- Performance (inline styles can't be cached)

**Top offenders**:
- Modal overlay positioning (`app.js:202`)
- Settings input widths (`app.js:449-458`)
- Empty state padding overrides (`app.js:110, 388, 597-599`)
- Quick actions button alignment (`app.js:121`)

---

## 7. Priority Matrix

### P0 — Blocking (fix before any release)

1. **G-1/G-2**: Add `:focus-visible` styles for buttons and inputs
2. **A-1**: Fix duplicate `display` on modal overlay
3. **A-2/S-1**: Associate all form labels with inputs via `for`/`id`
4. **L-1**: Fix `word-break: break-all` in log viewer

### P1 — High (fix before beta)

5. **G-3**: Add `prefers-reduced-motion` support
6. **G-4**: Add ARIA landmarks to shell
7. **A-3**: Add form validation feedback
8. **A-4**: Add confirmation for delete actions
9. **T-1**: Either implement drag-drop or remove kanban affordance
10. **T-2**: Add responsive column stacking
11. **L-2**: Add `aria-live` to log viewer
12. **S-2/S-3**: Wire settings to IPC persistence

### P2 — Medium (polish pass)

13. **D-2**: Add `aria-live` to dashboard stats
14. **A-6**: Capitalize status badge text
15. **A-8**: Add Escape key to close modals
16. **T-4**: Wire task card clicks or remove pointer cursor
17. **T-6**: Resolve agent IDs to names in task cards
18. **L-5**: Style filter selects consistently
19. **S-4**: Migrate inline input styles to CSS classes
20. **Inline style cleanup**: Migrate 38 inline styles to CSS

### P3 — Low (future polish)

21. Dashboard stat count-up animation
22. Task column color accents
23. Log text search
24. Jump-to-bottom in log viewer
25. About section in settings
26. App logo in header

---

## 8. Comparison with Previous Audit

| Finding from DESIGN-AUDIT.md | Status in Live Code |
|------------------------------|---------------------|
| Blue accent conflict (#2563EB vs #58A6FF) | ✅ Resolved — code uses `#58A6FF` consistently |
| Font size base (14px vs 16px) | ✅ Resolved — code uses 14px |
| Light mode planned | ❌ Not implemented — dark only |
| No onboarding flow | ❌ Still missing |
| No empty states for key flows | ⚠️ Partial — generic empty states exist but are not contextual |
| Progressive disclosure plan | ❌ Not implemented |
| Agent templates | ❌ Not implemented |

---

*This audit covers the actual rendered application code. Next audit should include a live running session with Playwright screenshots for visual regression baseline.*
