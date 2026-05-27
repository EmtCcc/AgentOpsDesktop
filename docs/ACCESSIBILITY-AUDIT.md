# Accessibility Audit — AgentOps Desktop

> WCAG 2.2 Level AA Baseline Audit
> Date: 2026-05-28
> Auditor: UX Research (pre-implementation design audit)
> Scope: Design System + Brand Identity specifications (no UI code exists yet)

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 3 | Blocks users from completing tasks |
| **Major** | 5 | Significant barrier, workaround possible |
| **Minor** | 4 | Degraded experience but usable |
| **Informational** | 3 | Best practice recommendations |

**Overall status: NOT READY for WCAG 2.2 AA compliance.** The design system has several contrast failures and missing accessibility patterns that must be resolved before implementation.

---

## 1. Perceivable

### 1.1.1 Non-text Content (Level A) — PASS (with caveats)

The design system specifies Lucide icons for all status indicators. However, no `alt` text or ARIA labeling guidance is documented.

**Finding (Minor):** Add guidance to the design system that all icon-only buttons require `aria-label`. Status indicators (dot + text badge) are fine since they use both color and text.

**Recommendation:**
- Document that icon-only controls must have `aria-label` or `aria-labelledby`
- Document that decorative icons must use `aria-hidden="true"`

---

### 1.3.1 Info and Relationships (Level A) — NOT ASSESSED

No HTML/ARIA structure guidance exists in the design system.

**Finding (Informational):** Add semantic structure guidance for the app shell:
- `<header>` for the 48px header
- `<nav>` for the sidebar
- `<main>` for the content area
- `<footer>` for the status bar
- `role="status"` for the footer status indicators

---

### 1.4.1 Use of Color (Level A) — PASS

The design system explicitly states: *"Status conveyed through color AND iconography (never color alone)"* and *"Status colors (green/amber/red) must be distinguishable by shape or label in addition to color."*

This is correct. Both the Design System and Brand Identity documents enforce this principle.

---

### 1.4.3 Contrast (Minimum) (Level AA) — FAIL

This is the most significant finding. Multiple color combinations fail WCAG AA contrast requirements.

#### Design System — Dark Theme

| Combination | Ratio | Required | Status |
|-------------|-------|----------|--------|
| text-primary (#E6EDF3) on bg-primary (#0D1117) | 16.02:1 | 4.5:1 | **PASS** |
| text-secondary (#8B949E) on bg-primary (#0D1117) | 6.15:1 | 4.5:1 | **PASS** |
| **text-tertiary (#484F58) on bg-primary (#0D1117)** | **2.28:1** | **4.5:1** | **FAIL** |
| accent (#58A6FF) on bg-primary (#0D1117) | 7.49:1 | 4.5:1 | **PASS** |
| success (#3FB950) on bg-primary (#0D1117) | 7.45:1 | 4.5:1 | **PASS** |
| warning (#D29922) on bg-primary (#0D1117) | 7.50:1 | 4.5:1 | **PASS** |
| danger (#F85149) on bg-primary (#0D1117) | 5.65:1 | 4.5:1 | **PASS** |
| **white (#FFF) on accent (#58A6FF)** | **2.53:1** | **4.5:1** | **FAIL** |
| **white (#FFF) on success (#3FB950)** | **2.54:1** | **4.5:1** | **FAIL** |
| white (#FFF) on danger (#F85149) | 3.35:1 | 4.5:1 | **FAIL** (passes AA-large at 3:1) |
| **white (#FFF) on warning (#D29922)** | **2.52:1** | **4.5:1** | **FAIL** |

**Critical failures:**
1. **text-tertiary on dark backgrounds** — `#484F58` on `#0D1117` achieves only 2.28:1. This token is used for disabled/placeholder text, which still needs to be perceivable. WCAG 1.4.3 applies to all text, including disabled states.
2. **White text on accent/success/warning buttons** — The primary button pattern (white text on colored background) fails for accent, success, and warning variants. Only the danger variant passes AA-large (3:1).

#### Brand Identity — Dark Mode

| Combination | Ratio | Required | Status |
|-------------|-------|----------|--------|
| **idle-gray (#64748B) on deep-slate (#0F172A)** | **3.75:1** | **4.5:1** | **FAIL** |
| **ops-blue (#2563EB) on deep-slate (#0F172A)** | **3.45:1** | **4.5:1** | **FAIL** |
| primary-dark (#3B82F6) on deep-slate (#0F172A) | 4.85:1 | 4.5:1 | **PASS** |
| **white (#FFF) on node-green (#10B981)** | **2.54:1** | **4.5:1** | **FAIL** |
| **white (#FFF) on alert-amber (#F59E0B)** | **2.15:1** | **4.5:1** | **FAIL** |
| white (#FFF) on critical-red (#EF4444) | 3.76:1 | 4.5:1 | **FAIL** (passes AA-large) |

#### Brand Identity — Light Mode

| Combination | Ratio | Required | Status |
|-------------|-------|----------|--------|
| **node-green (#10B981) on clean-white (#F8FAFC)** | **2.42:1** | **4.5:1** | **FAIL** |
| **alert-amber (#F59E0B) on clean-white (#F8FAFC)** | **2.05:1** | **4.5:1** | **FAIL** |
| critical-red (#EF4444) on clean-white (#F8FAFC) | 3.60:1 | 4.5:1 | **FAIL** (passes AA-large) |

**Recommendation — Color fixes:**

| Token | Current | Suggested | New Ratio (on #0D1117) |
|-------|---------|-----------|------------------------|
| `text-tertiary` | `#484F58` | `#768390` | 4.54:1 |
| `--color-accent` (button text) | white on `#58A6FF` | `#0D1117` on `#58A6FF` | 7.49:1 |
| `--color-success` (button text) | white on `#3FB950` | `#0D1117` on `#3FB950` | 7.45:1 |
| `--color-warning` (button text) | white on `#D29922` | `#0D1117` on `#D29922` | 7.50:1 |
| Brand `ops-blue` | `#2563EB` | `#3B82F6` (already in dark map) | 4.85:1 |
| Brand `idle-gray` | `#64748B` | `#8494a7` | 5.02:1 |
| Brand status colors (on light bg) | Use darkened variants | `#059669` green, `#D97706` amber | 4.5+:1 |

---

### 1.4.11 Non-text Contrast (Level AA) — NOT ASSESSED

UI components (borders, focus rings, icons) need 3:1 contrast against adjacent colors.

**Finding (Minor):** The design system border color `#30363D` on `#0D1117` achieves approximately 1.8:1 — below the 3:1 requirement for UI component boundaries. The focus ring (`--color-accent` at `#58A6FF`) on `#0D1117` achieves 7.49:1, which passes.

**Recommendation:** Lighten border color to `#444C56` (3.1:1 on `#0D1117`) for component boundaries that convey meaning. Decorative borders are exempt.

---

### 1.4.13 Content on Hover or Focus (Level AA) — NOT ASSESSED

Tooltips and popovers need to be dismissible, hoverable, and persistent.

**Finding (Informational):** No tooltip behavior spec exists. Add guidance:
- Tooltips must be dismissible (Escape key)
- Tooltips must be hoverable (pointer can move onto tooltip)
- Tooltips must remain visible until dismissed or focus moves

---

## 2. Operable

### 2.1.1 Keyboard (Level A) — PARTIALLY ADDRESSED

The design system states *"Support keyboard navigation throughout"* but provides no specifics.

**Finding (Major):** Add explicit keyboard interaction patterns:
- All interactive elements (buttons, links, inputs, cards) must be focusable
- Tab order must follow visual reading order (top-to-bottom, left-to-right)
- Sidebar collapse/expand must be keyboard-triggerable
- Modal dialogs must trap focus
- Dropdown menus must support arrow key navigation
- Drag-and-drop (task reassignment) needs keyboard alternative

**Recommendation:** Document keyboard patterns for each component:
- Buttons: Enter/Space to activate
- Dropdowns: Arrow keys to navigate, Enter to select, Escape to close
- Task board: Arrow keys between cards, Enter to open, Escape to close detail
- Sidebar: Tab to navigate items, Enter to activate
- Modal: Tab cycles within modal, Escape to close

---

### 2.1.2 No Keyboard Trap (Level A) — NOT ASSESSED

**Finding (Major):** The terminal emulator (xterm.js) is a known keyboard trap risk. Users must be able to Tab out of the terminal.

**Recommendation:** Implement a "pass-through" mode toggle for the terminal. Default: terminal captures keyboard. User presses Ctrl+Shift+Tab (or similar) to escape terminal focus and return to app navigation.

---

### 2.4.1 Bypass Blocks (Level A) — NOT ASSESSED

**Finding (Major):** No skip-to-content mechanism is specified. With a fixed sidebar and header, keyboard users must Tab through all sidebar items to reach the main content.

**Recommendation:** Add a "Skip to main content" link as the first focusable element, visible on focus. In an Electron app, this is implemented as a visually hidden link that moves focus to `<main>`.

---

### 2.4.3 Focus Order (Level A) — NOT ASSESSED

**Finding (Minor):** The layout (header → sidebar → content → footer) implies a reasonable tab order, but no explicit guidance exists. Focus must not jump unexpectedly when panels expand/collapse.

---

### 2.4.7 Focus Visible (Level AA) — PASS (design specified)

The design system specifies `--color-accent` 2px outline for focus rings, which is visible against all backgrounds (7.49:1 contrast on `#0D1117`).

**Finding (Minor):** The focus ring is only specified for inputs. Extend to all interactive elements (buttons, links, cards, sidebar items).

---

### 2.5.3 Label in Name (Level A) — NOT ASSESSED

**Finding (Informational):** When implementing, ensure visible labels match accessible names. For example, a button displaying "Add Agent" must have `aria-label="Add Agent"` or use the visible text as its accessible name.

---

## 3. Understandable

### 3.1.1 Language of Page (Level A) — NOT ASSESSED

**Finding (Minor):** Set `lang="en"` on the root HTML element. Electron apps using `BrowserWindow` should set this in the HTML template.

---

### 3.2.1 On Focus (Level A) — PASS

No auto-submission or context change on focus is specified in the design system.

---

### 3.3.1 Error Identification (Level A) — PARTIALLY ADDRESSED

The Brand Identity defines error message format: `[What happened] · [Why] · [What to do]`. This is good but doesn't specify how errors are presented to assistive technology.

**Recommendation:**
- Form errors: use `aria-describedby` to link error text to the input
- Use `role="alert"` for toast/notification errors
- Inline validation errors must be announced by screen readers

---

### 3.3.2 Labels or Instructions (Level A) — NOT ASSESSED

**Finding (Major):** The design system shows input fields but doesn't specify label association patterns.

**Recommendation:**
- All inputs must have visible `<label>` elements (not just placeholder text)
- Form groups (e.g., agent configuration) must use `<fieldset>` + `<legend>`
- Required fields must use `aria-required="true"` and visual indicator (not just color)

---

## 4. Robust

### 4.1.2 Name, Role, Value (Level A) — NOT ASSESSED

**Finding (Major):** Since no HTML exists yet, this is forward-looking guidance. Key patterns:

| Component | Required ARIA |
|-----------|---------------|
| Status dot | `role="status"` with text alternative |
| Task card | `role="article"` or semantic `<article>` |
| Sidebar nav | `<nav>` with `aria-label` |
| Agent status badge | `role="status"` |
| Modal dialog | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` |
| Dropdown menu | `role="menu"` + `role="menuitem"` |
| Log viewer | `role="log"` + `aria-live="polite"` |
| Loading spinner | `role="status"` + `aria-label="Loading"` |

---

## 5. Additional WCAG 2.2 Criteria

### 2.4.11 Focus Not Obscured (Minimum) (Level AA) — NEW in WCAG 2.2

**Finding (Major):** With a fixed sidebar (240px) and fixed header (48px), focused elements in the main content area could be partially obscured by these fixed elements when scrolling.

**Recommendation:** Ensure focused elements have at least the focus indicator area fully visible. Use `scroll-margin-top` and `scroll-margin-left` on focusable elements to account for fixed chrome.

---

### 2.5.7 Dragging Movements (Level AA) — NEW in WCAG 2.2

**Finding (Major):** The task board implies drag-and-drop for task reassignment. WCAG 2.2 requires a non-dragging alternative.

**Recommendation:** Provide a "Reassign" button or context menu option that opens a dropdown to select the target agent. Drag-and-drop can exist as a progressive enhancement.

---

### 2.5.8 Target Size (Minimum) (Level AA) — NEW in WCAG 2.2

**Finding (Minor):** Button sizes are sm (28px), md (32px), lg (36px). WCAG 2.2 requires 24×24 CSS px minimum target size. All button sizes meet this threshold. However, icon-only buttons at 16px icons with tight padding could fall below the target.

**Recommendation:** Ensure all interactive targets have at least 24×24px clickable area, including icon-only toolbar buttons. Add padding if the visual element is smaller.

---

### 3.2.6 Consistent Help (Level A) — NEW in WCAG 2.2

**Finding (Informational):** If the app provides help (tooltips, documentation links, support contact), it must appear in a consistent location across all views.

---

## Summary of Required Changes Before Implementation

### Critical (must fix)

1. **`text-tertiary` color** — Change from `#484F58` to `#768390` (or lighter) to achieve 4.5:1 on dark backgrounds
2. **Button text contrast** — Use dark text (`#0D1117`) on accent/success/warning button backgrounds, or darken the button backgrounds
3. **Brand `ops-blue` on dark** — Use `#3B82F6` (already mapped for dark mode) instead of `#2563EB`

### Major (should fix)

4. Document keyboard interaction patterns for all components
5. Implement terminal keyboard trap escape mechanism
6. Add skip-to-content navigation
7. Specify label/input association patterns
8. Provide non-dragging alternative for task reassignment
9. Address focus-not-obscured with fixed layout elements

### Minor (should address)

10. Lighten border color for non-decorative boundaries
11. Extend focus ring spec to all interactive elements
12. Set `lang="en"` on HTML root
13. Ensure 24×24px minimum touch targets

---

## Next Steps

1. Update `DESIGN-SYSTEM.md` with the color corrections from this audit
2. Create an `ACCESSIBILITY.md` in the component library (when built) with per-component ARIA patterns
3. Add accessibility acceptance criteria to the MVP milestones
4. Plan automated a11y testing (axe-core integration) for CI pipeline
5. Schedule manual screen reader testing (VoiceOver on macOS) once UI is built

---

*This audit is based on design specifications only. A full compliance audit must be conducted on the implemented UI using automated tools (axe, Lighthouse) and manual testing (keyboard, screen reader, high contrast mode).*
