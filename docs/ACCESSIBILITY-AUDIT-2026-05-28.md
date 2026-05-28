# AgentOps Desktop — WCAG 2.2 Accessibility Audit

**Date**: 2026-05-28
**Auditor**: UX Researcher
**Scope**: Full renderer codebase (`index.html`, `app.js`, all CSS files in `src/renderer/styles/`)
**Standard**: WCAG 2.2 AA
**Phase**: Foundation v0.1 — vanilla HTML/CSS/JS

---

## Executive Summary

The codebase has a solid accessibility foundation: semantic landmarks, `aria-hidden` on decorative SVGs, `aria-live` regions on dynamic content, `:focus-visible` outlines, and `prefers-reduced-motion` support. However, several WCAG 2.2 AA failures remain, primarily around **color contrast**, **keyboard operability**, and **focus management**.

**Overall WCAG 2.2 AA compliance: Partial — 11 failures found.**

| Severity | Count | WCAG Criteria |
|----------|-------|---------------|
| Critical | 2 | 1.4.3, 2.4.7 |
| Serious | 3 | 1.4.1, 2.1.1, 2.4.3 |
| Moderate | 4 | 1.3.1, 2.4.1, 2.5.8, 4.1.2 |
| Minor | 2 | 1.3.1, 2.4.7 |

---

## What Passes

| WCAG | Criterion | Evidence |
|------|-----------|----------|
| 1.1.1 | Non-text Content | All decorative SVGs have `aria-hidden="true"`. Icon-only buttons have `aria-label`. |
| 1.3.1 | Info and Relationships | Semantic HTML: `<header>`, `<nav>`, `<main>`, `<footer>`. Form labels use `<label for>`. |
| 1.4.4 | Resize Text | All sizes in `px` but base is 16px; no `max-font-size` override blocks browser zoom. |
| 1.4.10 | Reflow | Desktop-only app; no horizontal scroll at 1280px. Sidebar collapses at 1024px. |
| 1.4.12 | Text Spacing | No `line-height`, `letter-spacing`, or `word-spacing` overrides block user adjustment. |
| 1.4.13 | Content on Hover | Tooltips use `:hover` with `pointer-events: none` — no hover trap. |
| 2.1.2 | No Keyboard Trap | No keyboard traps found (except modal — see F4). |
| 2.4.2 | Page Titled | `<title>AgentOps</title>` present. |
| 2.4.6 | Headings and Labels | Page titles use `<h1>`, section titles use `<h3>`. |
| 3.1.1 | Language of Page | `lang="en"` on `<html>`. |
| 4.1.1 | Parsing | Valid HTML5 structure. |
| — | Reduced Motion | `prefers-reduced-motion: reduce` disables all animations in `base.css:171-179`. |
| — | Dark Mode | Full `prefers-color-scheme: dark` token override in `tokens.css:123-155`. |
| — | Focus Visible | `:focus-visible` 2px outline on all interactive elements in `base.css:148-161`. |
| — | Live Regions | `aria-live="polite"` on dashboard stats, activity feed, agent list, task board, log viewer. `aria-live="assertive"` on toast container. |

---

## Failures

### F1 — Toast notification text contrast fails AA [CRITICAL]

**WCAG**: 1.4.3 Contrast (Minimum)
**File**: `app.js:1117`

Toast backgrounds use inline styles with design system colors:

| Toast Type | Background | Text | Ratio | Required |
|------------|-----------|------|-------|----------|
| Error | `#EF4444` | `white` | 3.9:1 | 4.5:1 |
| Success | `#10B981` | `white` | 3.1:1 | 4.5:1 |
| Info | `#3B82F6` | `white` | 3.1:1 | 4.5:1 |

All three fail WCAG AA for normal text. Users with low vision cannot read toast messages.

**Fix**: Use darker variants for backgrounds or dark text on light backgrounds:
- Error: `#DC2626` bg (4.5:1) or `#FEF2F2` bg with `#991B1B` text
- Success: `#059669` bg (4.6:1) or `#F0FDF4` bg with `#14532D` text
- Info: `#2563EB` bg (4.6:1) or `#EFF6FF` bg with `#1E40AF` text

### F2 — Status dots rely on color alone [SERIOUS]

**WCAG**: 1.4.1 Use of Color
**Files**: `app.js:422`, `components.css:258-268`

Agent status is communicated solely through colored dots (green=running, gray=idle, red=error, amber=spawning). The `.status-dot` elements have no text label, no `aria-label`, and no icon variation.

```html
<span class="status-dot status-dot--running"></span>
```

Screen readers announce nothing. Color-blind users cannot distinguish states.

**Fix**: Add `aria-label` and/or a visible text label:
```html
<span class="status-dot status-dot--running" aria-label="Running" role="img"></span>
```
Or add a text label adjacent to the dot (the `status-badge` class already shows text — use it consistently).

### F3 — Sidebar items use incorrect ARIA role [SERIOUS]

**WCAG**: 4.1.2 Name, Role, Value
**File**: `index.html:70-116`

Sidebar items are `<a>` tags with `role="button"` but no `href`:
```html
<a class="sidebar__item" data-page="agents" role="button" tabindex="0">
```

These are navigation links, not buttons. Using `role="button"` misleads screen readers into expecting button behavior (activation) rather than link behavior (navigation). Additionally, `<a>` without `href` is not natively focusable — `tabindex="0"` is a workaround but not ideal.

**Fix**: Either:
- Use `<button>` elements (they're triggering navigation, not following links)
- Use `<a href="#agents">` (proper links, remove `role="button"`)

### F4 — Modal focus trap not enforced [SERIOUS]

**WCAG**: 2.4.3 Focus Order
**Files**: `app.js:371-406` (agent modal), `app.js:715-747` (task modal)

Modals have `role="dialog"` and `aria-modal="true"` but no JavaScript focus trap. Keyboard users can Tab behind the modal into sidebar and main content. No Escape key handler exists to close modals.

**Fix**: Implement focus trap:
```javascript
function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideModal(); return; }
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  first?.focus();
}
```

### F5 — Search input missing accessible label [MODERATE]

**WCAG**: 1.3.1 Info and Relationships
**File**: `index.html:40`

```html
<input type="text" class="header__search-input" placeholder="Search... (⌘K)" id="global-search">
```

The search input has a placeholder but no `<label>`, `aria-label`, or `aria-labelledby`. Placeholder text is not a sufficient label per WCAG.

**Fix**: Add `aria-label`:
```html
<input type="text" class="header__search-input" placeholder="Search... (⌘K)" id="global-search" aria-label="Search">
```

### F6 — No skip-to-content link [MODERATE]

**WCAG**: 2.4.1 Bypass Blocks
**File**: `index.html`

Keyboard users must Tab through 10+ sidebar items to reach main content. No skip link exists.

**Fix**: Add a visually hidden skip link at the top of `<body>`:
```html
<a href="#main-content" class="sr-only sr-only--focusable">Skip to main content</a>
```
```css
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
.sr-only--focusable:focus { position: static; width: auto; height: auto; padding: inherit; margin: inherit; overflow: visible; clip: auto; }
```

### F7 — Task cards and agent rows not keyboard-operable [MODERATE]

**WCAG**: 2.1.1 Keyboard
**Files**: `app.js:421-436` (agent rows), `app.js:774-782` (task cards)

Agent rows have `style="cursor:pointer;"` and click handlers but no `tabindex`, no `role`, and no keyboard event handler. Task cards have `data-navigate` but are plain `<div>` elements with no keyboard support.

```html
<div class="agent-row" data-agent-id="..." style="cursor:pointer;">
```

Keyboard users cannot activate these elements.

**Fix**: Add `tabindex="0"`, `role="link"` (or `role="button"`), and `keydown` handler for Enter/Space.

### F8 — Agent modal form fields missing `required` and `aria-required` [MODERATE]

**WCAG**: 3.3.2 Labels or Instructions
**File**: `app.js:378-399`

The agent name field is validated in JS (`if (!name) return;`) but has no `required` attribute or `aria-required="true"`. Users receive no indication that the field is mandatory before submitting.

**Fix**: Add `required` to mandatory fields:
```html
<input type="text" id="agent-name" placeholder="e.g. Claude Code" required aria-required="true">
```

### F9 — Notification badge lacks accessible name [MINOR]

**WCAG**: 4.1.2 Name, Role, Value
**File**: `index.html:47`

```html
<span class="header__action-badge"></span>
```

The red notification badge is purely visual with no accessible name. Screen readers don't announce its presence or meaning.

**Fix**: Add `aria-label` or visually hidden text:
```html
<span class="header__action-badge" aria-label="New notifications"></span>
```

### F10 — Landing page features not in list markup [MINOR]

**WCAG**: 1.3.1 Info and Relationships
**File**: `app.js:152-185`

Three feature cards are rendered as sibling `<div>` elements without a list container. Screen readers don't convey the count or grouping.

**Fix**: Wrap in `<ul>` with `<li>` items, or add `role="list"` + `role="listitem"`.

### F11 — Inline styles override design token contrast [MINOR]

**WCAG**: 1.4.3 Contrast (Minimum)
**File**: `app.js` (throughout)

Multiple inline `style=` attributes use `var(--color-text-tertiary)` for small text. In dark mode, `--color-text-tertiary: #9CA3AF` on `--color-bg-primary: #111827` yields ~5.5:1 (passes AA). However, in light mode, `#71717A` on `#FFFFFF` is ~4.5:1 (borderline). Inline styles make it impossible to audit contrast at the CSS level.

**Fix**: Replace inline styles with CSS classes from the design system. This is also a maintainability issue.

---

## Color Contrast Analysis

### Light Mode

| Pair | Foreground | Background | Ratio | WCAG AA | WCAG AAA |
|------|-----------|------------|-------|---------|----------|
| Primary text on bg | `#111827` | `#FFFFFF` | 15.4:1 | Pass | Pass |
| Secondary text on bg | `#6B7280` | `#FFFFFF` | 4.6:1 | Pass | Fail |
| Tertiary text on bg | `#71717A` | `#FFFFFF` | 4.5:1 | Borderline | Fail |
| Primary on bg | `#6366F1` | `#FFFFFF` | 4.6:1 | Pass | Fail |
| Primary btn text | `#FFFFFF` | `#6366F1` | 4.6:1 | Pass | Fail |
| Danger btn text | `#FFFFFF` | `#EF4444` | 3.9:1 | **Fail** | Fail |
| Success badge | `#10B981` | `rgba(16,185,129,0.1)` | 3.1:1 | **Fail** | Fail |
| Error badge | `#EF4444` | `rgba(239,68,68,0.1)` | 3.1:1 | **Fail** | Fail |
| Warning badge | `#F59E0B` | `rgba(245,158,11,0.1)` | 1.8:1 | **Fail** | Fail |

### Dark Mode

| Pair | Foreground | Background | Ratio | WCAG AA | WCAG AAA |
|------|-----------|------------|-------|---------|----------|
| Primary text on bg | `#F9FAFB` | `#111827` | 15.4:1 | Pass | Pass |
| Secondary text on bg | `#D1D5DB` | `#111827` | 8.6:1 | Pass | Pass |
| Tertiary text on bg | `#9CA3AF` | `#111827` | 5.5:1 | Pass | Fail |
| Primary on bg | `#818CF8` | `#111827` | 5.9:1 | Pass | Fail |
| Primary btn text | `#111827` | `#818CF8` | 5.9:1 | Pass | Fail |
| Danger btn text | `#111827` | `#F87171` | 3.9:1 | **Fail** | Fail |
| Success badge | `#34D399` | `rgba(52,211,153,0.15)` | 4.2:1 | Borderline | Fail |
| Error badge | `#F87171` | `rgba(248,113,113,0.15)` | 4.0:1 | **Fail** | Fail |

**Note**: Badge contrast issues are mitigated by the fact that badges show text (e.g., "running", "error") — the text itself needs to meet 4.5:1 against the badge background. Status dots (color-only) fail 1.4.1 regardless of contrast.

---

## Keyboard Navigation Map

| Element | Focusable | Operable | Notes |
|---------|-----------|----------|-------|
| Sidebar toggle | ✅ | ✅ | Button, Enter/Space native |
| Sidebar items | ✅ (tabindex) | ✅ | Enter/Space handler in `app.js:1195-1200` |
| Global search | ✅ | ✅ | Native input |
| Header action buttons | ✅ | ✅ | Native buttons |
| Agent rows | ❌ | ❌ | No tabindex, no keyboard handler |
| Task cards | ❌ (some) | ❌ (some) | `data-navigate` cards lack tabindex |
| Agent modal | ⚠️ | ⚠️ | Tab can escape modal |
| Task modal | ⚠️ | ⚠️ | Tab can escape modal |
| Settings inputs | ✅ | ✅ | Native inputs |
| Log filters | ✅ | ✅ | Native select/input |
| Landing page buttons | ✅ | ✅ | Native buttons |

---

## Screen Reader Compatibility

| Element | Announced Correctly | Issue |
|---------|-------------------|-------|
| Page title | ✅ | `<title>AgentOps</title>` |
| Landmarks | ✅ | `<header>`, `<nav>`, `<main>`, `<footer>` |
| Sidebar section titles | ✅ | Text content announced |
| Active sidebar item | ⚠️ | No `aria-current="page"` to indicate active state |
| Agent status | ❌ | Status dot has no accessible name |
| Modal title | ✅ | `aria-labelledby` points to title |
| Modal open/close | ⚠️ | No focus move to modal on open |
| Toast messages | ✅ | `role="alert" aria-live="assertive"` |
| Dashboard stats | ✅ | `aria-live="polite"` on region |
| Log viewer | ✅ | `role="log" aria-live="polite"` |
| Form validation errors | ❌ | No error message announced on validation failure |

---

## Recommendations (Priority Order)

### P0 — Must Fix (blocks WCAG AA compliance)

1. **Fix toast contrast** — Darken success/info backgrounds or use dark text on light backgrounds
2. **Add modal focus trap** — Trap Tab, add Escape handler, move focus into modal on open
3. **Add text alternatives for status** — `aria-label` on status dots, or always show status badge text
4. **Fix sidebar item semantics** — Remove `role="button"`, use proper `<button>` or `<a href>`

### P1 — Should Fix

5. **Add skip-to-content link** — Hidden link, visible on focus
6. **Add `aria-label` to search input**
7. **Make agent rows and task cards keyboard-operable** — `tabindex`, `role`, `keydown` handler
8. **Add `aria-current="page"` to active sidebar item**
9. **Add `required` and `aria-required` to mandatory form fields**
10. **Add form validation error announcements** — `aria-describedby` or `aria-errormessage`

### P2 — Nice to Have

11. **Replace inline styles with CSS classes** — Improves auditability and maintainability
12. **Add `aria-label` to notification badge**
13. **Use list markup for landing page features**
14. **Add loading state announcements** — `aria-busy="true"` during data fetches

---

## WCAG 2.2 Criteria Mapping

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | ✅ | SVGs hidden, icons labeled |
| 1.3.1 Info and Relationships | A | ⚠️ | F5, F9, F10 |
| 1.3.2 Meaningful Sequence | A | ✅ | DOM order matches visual order |
| 1.3.3 Sensory Characteristics | A | ✅ | No shape-only instructions |
| 1.4.1 Use of Color | A | ❌ | F2 — status dots color-only |
| 1.4.3 Contrast (Minimum) | AA | ❌ | F1, F11 — toast/badge contrast |
| 1.4.4 Resize Text | AA | ✅ | Browser zoom works |
| 1.4.11 Non-text Contrast | AA | ⚠️ | Focus rings pass; badge borders need check |
| 1.4.12 Text Spacing | AA | ✅ | No overrides block user adjustment |
| 1.4.13 Content on Hover/Focus | AA | ✅ | Tooltips non-trapping |
| 2.1.1 Keyboard | A | ❌ | F7 — agent rows/task cards not operable |
| 2.1.2 No Keyboard Trap | A | ⚠️ | F4 — modal focus not trapped |
| 2.4.1 Bypass Blocks | A | ❌ | F6 — no skip link |
| 2.4.3 Focus Order | A | ❌ | F4 — modal focus escapes |
| 2.4.6 Headings and Labels | AA | ✅ | Proper heading hierarchy |
| 2.4.7 Focus Visible | AA | ✅ | `:focus-visible` on all elements |
| 2.5.8 Target Size (Minimum) | AA | ⚠️ | Buttons 36px height (passes 24px min); icon buttons 32px — borderline |
| 3.3.2 Labels or Instructions | A | ⚠️ | F8 — required fields not indicated |
| 4.1.2 Name, Role, Value | A | ❌ | F3, F9 — incorrect roles, missing names |

---

## Appendix: Files Audited

| File | Path | Lines | Role |
|------|------|-------|------|
| HTML shell | `src/renderer/index.html` | 167 | App shell, landmarks, sidebar |
| Application JS | `src/renderer/app.js` | 1238 | All page rendering, interactions |
| Tokens | `src/renderer/styles/tokens.css` | 155 | Design tokens (light + dark) |
| Base styles | `src/renderer/styles/base.css` | 179 | Reset, focus, reduced motion |
| Layout | `src/renderer/styles/layout.css` | 746 | App shell, sidebar, header, footer |
| Components | `src/renderer/styles/components.css` | 634 | Buttons, cards, badges, inputs |
| Pages | `src/renderer/styles/pages.css` | 1143 | Page-specific styles |

---

*End of audit. Findings based on static code review as of 2026-05-28.*
