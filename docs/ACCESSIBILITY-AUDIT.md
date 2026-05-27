# Accessibility Audit — AgentOps Desktop

> WCAG 2.2 Level AA Implementation Audit
> Date: 2026-05-28
> Auditor: QA Engineer (code-level audit)
> Scope: `src/renderer/index.html`, `src/renderer/app.js`, `src/renderer/styles/*.css`
> Supersedes: 2026-05-28 design-phase audit (pre-implementation)

---

## Summary

| Severity | Count |
|----------|-------|
| **Critical** | 4 |
| **Major** | 7 |
| **Minor** | 6 |
| **Informational** | 3 |

**Overall status: NOT COMPLIANT.** The implementation has several WCAG 2.2 AA failures that block keyboard-only and screen reader users from completing core tasks.

---

## 1. Perceivable

### 1.1.1 Non-text Content (Level A)

**Finding 1 — Critical:** All inline SVG icons lack text alternatives. Icons used in buttons (sidebar toggle, notifications, settings, refresh, trash, play, pause, plus, etc.) are decorative-only `aria-hidden` not set and no `aria-label` provided. Screen readers announce these as unlabeled graphics.

Affected locations:
- `index.html:20-22` — sidebar toggle button SVG
- `index.html:36` — search icon SVG
- `index.html:43-44` — notifications button SVG
- `index.html:48` — settings button SVG
- `app.js:9-22` — all `icons.*` SVG strings (bot, check, listChecks, rocket, barChart, terminal, plus, trash, play, pause, refresh, search, activity)
- Every button in `app.js` that uses `${icons.plus}`, `${icons.refresh}`, `${icons.trash}`, etc.

**Recommendation:**
- Icon-only buttons: add `aria-label="description"` to the `<button>` element
- Decorative icons inside buttons with visible text: add `aria-hidden="true"` to the `<svg>`
- Standalone decorative icons: add `aria-hidden="true"`

---

### 1.3.1 Info and Relationships (Level A)

**Finding 2 — Major:** Form labels are visually present but not programmatically associated with inputs. All `<label>` elements in the agent and task modals lack `for` attributes, and the `<input>`/`<select>` elements lack `id` matching a label's `for`.

Affected locations:
- `app.js:209-229` — Add Agent modal: labels for Agent name, Type, Executable path, Working directory
- `app.js:377-396` — New Task modal: labels for Title, Description, Assign to agent, Goal
- `index.html:37` — global search input has no label (only placeholder)

**Recommendation:**
- Add `for="agent-name"` to the Agent name `<label>`, and `id="agent-name"` to the input (the `id` already exists, but `for` is missing)
- Repeat for all modal form fields
- Add `<label for="global-search" class="sr-only">Search</label>` for the search input

---

**Finding 3 — Major:** The header search input (`index.html:37`) has no associated label. The `placeholder` attribute is not a substitute for a label per WCAG 1.3.1.

**Recommendation:** Add a visually hidden `<label for="global-search">Search</label>`.

---

### 1.4.3 Contrast (Minimum) (Level AA)

**Finding 4 — Critical:** `--color-text-tertiary: #71717A` on `--color-bg-primary: #FFFFFF` achieves approximately **4.07:1**, failing the 4.5:1 minimum for normal text. This token is used for placeholder text, timestamps, secondary descriptions, and empty-state messaging.

Affected locations:
- `app.js:112` — "No recent activity" text
- `app.js:426` — "No tasks" text in empty columns
- `app.js:600-601` — "No logs yet" empty state
- CSS `.empty-state__desc`, `.card__subtitle`, `::placeholder`

**Recommendation:** Change `--color-text-tertiary` from `#71717A` to `#5F6368` (4.63:1 on white) or `#595D62` (5.0:1).

---

**Finding 5 — Major:** `--color-text-secondary: #6B7280` on `--color-bg-primary: #FFFFFF` achieves **4.59:1** — technically passing but only marginally. When rendered at `--text-xs` (12px), this is visually small and the thin stroke weight reduces perceived contrast.

**Recommendation:** No token change required, but document that `--text-secondary` at `--text-xs` size should be avoided for essential information. Use `--text-primary` for small-critical text.

---

**Finding 6 — Major:** Status badges use `--color-success` (`#10B981`) on `--color-success-light` (`rgba(16,185,129,0.1)`) which resolves to approximately `#10B981` on `#E6F9F1` — ratio ~2.4:1, failing 4.5:1. Same issue for `--color-warning` on `--color-warning-light` (~1.8:1) and `--color-danger` on `--color-danger-light` (~2.8:1).

Affected: `.status-badge--running`, `.status-badge--error`, `.status-badge--spawning` in `components.css:281-298`.

**Recommendation:** Darken the text color for badges on light backgrounds, or darken the badge background:
- Success badge: text `#047857` on `#D1FAE5` → 4.52:1
- Warning badge: text `#92400E` on `#FEF3C7` → 4.54:1
- Danger badge: text `#991B1B` on `#FEE2E2` → 4.63:1

---

### 1.4.11 Non-text Contrast (Level AA)

**Finding 7 — Minor:** Form input borders use `--color-border: #E5E7EB` on `--color-bg-primary: #FFFFFF` — ratio ~1.6:1, below the 3:1 minimum for UI component boundaries. While the focus state has adequate contrast (`--color-border-focus: #6366F1`), the unfocused state border may not be perceivable.

**Recommendation:** For inputs that convey meaning (all form inputs), darken the default border to at least `#BCBEC2` (3:1 on white).

---

## 2. Operable

### 2.1.1 Keyboard (Level A)

**Finding 8 — Critical:** Sidebar navigation items are `<a>` elements without `href` attributes (`index.html:67-72`, etc.). Without `href`, anchor elements are not in the tab order by default. Keyboard users cannot tab to sidebar navigation items.

Affected: All `.sidebar__item` elements (Dashboard, Home, Agents, Tasks, Logs, Workflows, Settings).

**Recommendation:** Either:
- Add `href="#"` with `event.preventDefault()`, or
- Change to `<button>` elements styled as navigation items, or
- Add `tabindex="0"` to each sidebar item

---

**Finding 9 — Critical:** Modal dialogs (`#modal-overlay` for agents, `#task-modal-overlay` for tasks) do not trap focus. When a modal opens:
- Focus does not move into the modal
- Tab can escape the modal to background content
- Escape key does not close the modal
- When closed, focus does not return to the trigger button

Affected: `app.js:273-276` (showModal), `app.js:278-281` (hideModal), `app.js:462-464` (task modal show).

**Recommendation:**
- Move focus to the first input when modal opens
- Trap Tab within the modal (cycle between first and last focusable element)
- Close modal on Escape key
- Return focus to the trigger button on close
- Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the modal title

---

### 2.4.1 Bypass Blocks (Level A)

**Finding 10 — Major:** No skip-to-content link exists. The app has a fixed header (64px) and sidebar (240px) with 7+ navigation items. Keyboard users must Tab through all of these before reaching the main content.

**Recommendation:** Add a visually hidden skip link as the first focusable element in `<body>`:
```html
<a href="#main-content" class="sr-only sr-only--focusable">Skip to main content</a>
```
With CSS:
```css
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
.sr-only--focusable:focus { position: static; width: auto; height: auto; padding: inherit; margin: inherit; overflow: visible; clip: auto; }
```

---

### 2.4.7 Focus Visible (Level AA)

**Finding 11 — Minor:** Focus styles are defined in `base.css:148-160` using `:focus-visible` with a 2px outline, which is good. However, the header action buttons (`index.html:42`, `index.html:47`) use `.header__action` styling which may override or clip the focus ring depending on `overflow` or `border-radius` rules.

**Recommendation:** Verify focus rings are visible on all interactive header elements in both light and dark modes.

---

### 2.4.11 Focus Not Obscured (Level AA) — WCAG 2.2

**Finding 12 — Minor:** The fixed header (64px) and sidebar (240px) can obscure focused elements. When tabbing through the main content area, focused elements near the top may be hidden behind the header.

**Recommendation:** Add `scroll-margin-top: 80px` to focusable elements in the main content area.

---

### 2.5.7 Dragging Movements (Level AA) — WCAG 2.2

**Finding 13 — Major:** The task board (`app.js:343-368`) displays tasks in columns (Pending, Running, Done, Failed) but provides no non-dragging mechanism to move tasks between columns. There is no "Move to..." button or context menu.

**Recommendation:** Add a dropdown or button on each task card to change its status without dragging.

---

### 2.5.8 Target Size (Minimum) (Level AA) — WCAG 2.2

**Finding 14 — Minor:** Icon-only buttons (`.btn--icon.btn--sm`) are 32x32px, which meets the 24x24px minimum. However, the header action buttons and some inline SVGs may have smaller effective tap targets.

**Recommendation:** Ensure all interactive elements maintain a minimum 24x24px clickable area.

---

## 3. Understandable

### 3.1.1 Language of Page (Level A)

**Status: PASS.** `<html lang="en">` is correctly set at `index.html:2`.

---

### 3.2.1 On Focus (Level A)

**Status: PASS.** No context changes on focus are implemented.

---

### 3.3.1 Error Identification (Level A)

**Finding 15 — Minor:** Toast notifications use `role="alert"` and `aria-live="assertive"` (`app.js:706-707`), which is correct. However, form validation errors (e.g., empty agent name at `app.js:296`) silently return without informing the user or screen reader.

**Recommendation:** When form validation fails, add `aria-invalid="true"` to the invalid field and use `aria-describedby` to link an error message.

---

### 3.3.2 Labels or Instructions (Level A)

**Finding 16 — Major:** Settings page inputs (`app.js:538-560`) for "Max parallel agents", "Task timeout", and "Log retention" have descriptive text in `.settings-row__label` but no `<label>` element or `aria-labelledby` association. Screen readers will not announce what each input is for.

**Recommendation:** Add `<label>` elements or `aria-labelledby` pointing to the `.settings-row__label` text.

---

## 4. Robust

### 4.1.2 Name, Role, Value (Level A)

**Finding 17 — Major:** The user menu (`index.html:53-59`, `div#user-menu`) is a `<div>` with no role, no `aria-expanded`, and no keyboard interaction. It appears interactive but is not focusable or operable by keyboard.

**Recommendation:** Change to `<button>` or add `role="button"`, `tabindex="0"`, and keyboard event handlers.

---

**Finding 18 — Minor:** Dynamic content regions use `aria-live="polite"` correctly:
- `app.js:72` — dashboard stats region
- `app.js:109` — activity feed
- `app.js:190` — agent list
- `app.js:343` — task board
- `app.js:598` — log viewer

This is good. However, the log viewer at `app.js:598` uses `role="log"` with `aria-live="polite"` — the `role="log"` already implies `aria-live="polite"`, so the explicit attribute is redundant (not harmful).

---

**Finding 19 — Informational:** The sidebar section titles (`index.html:66`, `index.html:82`, etc.) are `<div>` elements. Consider using heading elements (`<h2>` or appropriate level) for better screen reader navigation.

---

**Finding 20 — Informational:** The footer status bar (`index.html:141-158`) conveys system status via `#footer-status-dot` (a colored span) and `#footer-status-text`. The status dot is purely visual — the text provides the accessible name, which is correct. However, the dot should have `aria-hidden="true"`.

---

**Finding 21 — Informational:** The `user-select: none` on `body` (`base.css:26`) prevents text selection for all users, including those who may need to select text for alternative input methods or cognitive accessibility.

**Recommendation:** Remove `user-select: none` from `body` or scope it to specific non-text elements.

---

## Dark Mode Audit

The dark mode override (`tokens.css:123-155`) changes color tokens via `prefers-color-scheme: dark`. Key checks:

| Combination | Ratio | Status |
|-------------|-------|--------|
| `--color-text-primary` (#F9FAFB) on `--color-bg-primary` (#111827) | ~15.4:1 | **PASS** |
| `--color-text-secondary` (#D1D5DB) on `--color-bg-primary` (#111827) | ~10.3:1 | **PASS** |
| `--color-text-tertiary` (#9CA3AF) on `--color-bg-primary` (#111827) | ~5.7:1 | **PASS** |
| `--color-primary` (#818CF8) on `--color-bg-primary` (#111827) | ~6.2:1 | **PASS** |
| White text on `--color-danger` (#F87171) | ~2.8:1 | **FAIL** (passes AA-large) |

Dark mode has better contrast overall. The danger button text issue persists but is less severe.

---

## Positive Findings

1. **`lang="en"`** — Correctly set on `<html>` element
2. **Landmark regions** — `<header>`, `<nav>`, `<main>`, `<footer>` are correctly used
3. **Heading hierarchy** — `h1` for page titles, `h3` for card titles (proper nesting)
4. **Focus-visible** — `:focus-visible` styles defined with 2px outline in `base.css:148-160`
5. **Reduced motion** — `prefers-reduced-motion: reduce` media query disables animations (`base.css:171-179`)
6. **ARIA live regions** — Dynamic content areas use `aria-live="polite"` and `role="log"`
7. **Toast notifications** — `showToast()` creates elements with `role="alert"` and `aria-live="assertive"`
8. **Color tokens** — Systematic approach with CSS custom properties enables easy contrast fixes
9. **Dark mode** — Full dark mode via `prefers-color-scheme` media query
10. **Escape HTML** — User-generated content is escaped via `escapeHtml()` preventing XSS in rendered content

---

## Required Fixes (by priority)

### Critical (must fix — blocks users)

| # | Issue | WCAG | Fix |
|---|-------|------|-----|
| 1 | SVG icons lack text alternatives | 1.1.1 | Add `aria-label` to icon-only buttons, `aria-hidden` to decorative SVGs |
| 8 | Sidebar `<a>` items not keyboard-focusable | 2.1.1 | Add `href="#"` + `preventDefault` or convert to `<button>` |
| 9 | Modals don't trap focus | 2.1.1 | Implement focus trap, Escape close, focus return |
| 4 | `--color-text-tertiary` fails contrast | 1.4.3 | Change to `#5F6368` or darker |

### Major (should fix — significant barriers)

| # | Issue | WCAG | Fix |
|---|-------|------|-----|
| 2 | Form labels not associated with inputs | 1.3.1 | Add `for` attributes to all `<label>` elements |
| 3 | Search input has no label | 1.3.1 | Add `<label class="sr-only">` |
| 6 | Status badge text fails contrast on tinted bg | 1.4.3 | Darken badge text colors |
| 10 | No skip-to-content link | 2.4.1 | Add visually hidden skip link |
| 13 | No non-dragging alternative for task board | 2.5.7 | Add "Move to" dropdown on task cards |
| 16 | Settings inputs lack label association | 3.3.2 | Add `aria-labelledby` or `<label>` |
| 17 | User menu div has no role/keyboard support | 4.1.2 | Convert to `<button>` or add ARIA |

### Minor (should address)

| # | Issue | WCAG | Fix |
|---|-------|------|-----|
| 5 | `--text-secondary` at `--text-xs` borderline | 1.4.3 | Avoid for essential info |
| 7 | Input borders too low contrast unfocused | 1.4.11 | Darken to `#BCBEC2` |
| 11 | Focus ring clipping on header buttons | 2.4.7 | Verify in light/dark modes |
| 12 | Fixed header can obscure focused elements | 2.4.11 | Add `scroll-margin-top` |
| 14 | Some icon-only buttons near min target size | 2.5.8 | Verify 24x24px minimum |
| 15 | Silent form validation failures | 3.3.1 | Add `aria-invalid` + error messages |

---

## Next Steps

1. Fix all Critical findings before any release
2. Fix Major findings before beta
3. Run axe-core automated scan as part of CI
4. Manual VoiceOver testing on macOS after fixes
5. Update this audit after each fix cycle

---

*This audit was conducted on the implemented source code. Previous design-phase audit (same date) assessed specifications only.*
