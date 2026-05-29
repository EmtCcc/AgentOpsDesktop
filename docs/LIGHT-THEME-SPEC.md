# Light Theme Design Specification

> Version 1.0 · 2026-05-29
> Issue: CMPAAA-511

---

## 1. Overview

This spec defines the light theme implementation for AgentOps Desktop, complementing the existing dark theme. The approach uses `data-theme` attribute on `<html>` for explicit user control, replacing the current `prefers-color-scheme` media query approach.

### Design Philosophy

- **Light theme is not an afterthought.** It is a first-class theme with intentional color choices, not simply inverted dark theme values.
- **Maintain the cockpit aesthetic.** Information density and hierarchy remain paramount. Light backgrounds must not sacrifice scanning speed.
- **Accessibility-first.** All contrast ratios meet WCAG 2.1 AA (4.5:1 text, 3:1 UI components).

---

## 2. Theme Switching Mechanism

### Architecture

```
┌─────────────────────────────────────────────┐
│  <html data-theme="light|dark|system">      │
│    ┌─────────────────────────────────────┐  │
│    │  CSS Custom Properties (tokens.css) │  │
│    │  [data-theme="light"] { ... }       │  │
│    │  [data-theme="dark"]  { ... }       │  │
│    │  @media (prefers-color-scheme: dark)│  │
│    │    [data-theme="system"] { ... }    │  │
│    └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Theme States

| Value | Behavior |
|-------|----------|
| `light` | Always light, ignores OS preference |
| `dark` | Always dark, ignores OS preference |
| `system` | Follows `prefers-color-scheme` (default) |

### Persistence

- **Storage key**: `agentops-theme`
- **Storage location**: `localStorage`
- **Values**: `"light"` | `"dark"` | `"system"`
- **Default**: `"system"` (preserves current behavior for existing users)

### Initialization Sequence

```
1. Read localStorage('agentops-theme') → value or 'system'
2. If 'system': detect prefers-color-scheme → 'light' | 'dark'
3. Set document.documentElement.dataset.theme = resolved value
4. Apply CSS tokens immediately (no flash)
```

---

## 3. Color Token Mapping

### Backgrounds

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| `--color-bg-primary` | `#FFFFFF` | `#111827` | Main canvas |
| `--color-bg-secondary` | `#F9FAFB` | `#1F2937` | Panels, sidebar |
| `--color-bg-tertiary` | `#F3F4F6` | `#374151` | Elevated surfaces |
| `--color-bg-elevated` | `#FFFFFF` | `#1F2937` | Modals, dropdowns |

### Text

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| `--color-text-primary` | `#111827` | `#F9FAFB` | Headings, primary |
| `--color-text-secondary` | `#6B7280` | `#D1D5DB` | Descriptions |
| `--color-text-tertiary` | `#5F6368` | `#9CA3AF` | Disabled, placeholder |
| `--color-text-inverse` | `#FFFFFF` | `#111827` | Text on primary bg |

### Borders

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| `--color-border` | `#E5E7EB` | `#374151` | Default borders |
| `--color-border-subtle` | `#F3F4F6` | `#1F2937` | Subtle separations |
| `--color-border-focus` | `#6366F1` | `#818CF8` | Focus rings |

### Accent / Semantic

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| `--color-primary` | `#6366F1` | `#818CF8` | Links, actions |
| `--color-primary-hover` | `#4F46E5` | `#6366F1` | Hover state |
| `--color-primary-light` | `rgba(99,102,241,0.1)` | `rgba(129,140,248,0.15)` | Selections |
| `--color-success` | `#10B981` | `#34D399` | Healthy/complete |
| `--color-success-light` | `rgba(16,185,129,0.1)` | `rgba(52,211,153,0.15)` | Success bg |
| `--color-warning` | `#F59E0B` | `#FBBF24` | Degraded/queued |
| `--color-warning-light` | `rgba(245,158,11,0.1)` | `rgba(251,191,36,0.15)` | Warning bg |
| `--color-danger` | `#EF4444` | `#F87171` | Offline/failed |
| `--color-danger-light` | `rgba(239,68,68,0.1)` | `rgba(248,113,113,0.15)` | Danger bg |
| `--color-info` | `#3B82F6` | `#60A5FA` | Informational |
| `--color-info-light` | `rgba(59,130,246,0.1)` | `rgba(96,165,250,0.15)` | Info bg |

### Shadows

| Token | Light | Dark |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.2)` |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | `0 4px 6px rgba(0,0,0,0.25)` |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | `0 10px 15px rgba(0,0,0,0.3)` |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.12)` | `0 20px 25px rgba(0,0,0,0.35)` |

---

## 4. Theme Toggle UI Specification

### Location

Settings page → **Appearance** section (new section, placed after "General")

### Toggle Design

```
┌─────────────────────────────────────────────────────┐
│  Appearance                                          │
│  ┌─────────────────────────────────────────────┐    │
│  │  Theme                          [segmented] │    │
│  │  Switch between light and dark appearance    │    │
│  │                              ┌────┬────┬────┐│    │
│  │                              │ ☀  │ 🌙 │ 💻 ││    │
│  │                              │Light│Dark│Sys ││    │
│  │                              └────┴────┴────┘│    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Segmented Control Specification

- **Height**: 36px (matches `btn` default)
- **Border**: 1px solid `--color-border`
- **Border radius**: `--radius-md` (6px)
- **Background**: `--color-bg-tertiary`
- **Selected segment**: `--color-bg-elevated` background, `--shadow-sm`
- **Segment width**: Equal thirds, min 64px each
- **Icon size**: 16px
- **Label**: `--text-sm`, `--font-medium`
- **Transition**: `--motion-fast` (150ms ease)

### Iconography

| Theme | Icon | Label |
|-------|------|-------|
| Light | Sun (Lucide `sun`) | "Light" |
| Dark | Moon (Lucide `moon`) | "Dark" |
| System | Monitor (Lucide `monitor`) | "System" |

### Accessibility

- `role="radiogroup"` on container
- `role="radio"` on each segment
- `aria-checked="true|false"` on segments
- `aria-label="Theme selection"` on group
- Keyboard: Arrow keys navigate, Enter/Space selects
- Focus ring: `--color-border-focus`

---

## 5. Component Audit — Light Theme Concerns

### High Priority (Must Fix)

| Component | Issue | Fix |
|-----------|-------|-----|
| Status dots | Contrast on white bg | Verify `--status-*` colors meet 3:1 |
| Code blocks | Need light syntax theme | Use light code highlight tokens |
| Scrollbar thumb | May be invisible on white | Adjust `--color-border` usage |
| Focus rings | Indigo on white is fine | Verify 3:1 contrast |
| Log viewer | Dark bg expected | Keep dark bg for code/logs, or add light variant |

### Medium Priority

| Component | Issue | Fix |
|-----------|-------|-----|
| Charts/graphs | Dark grid lines on white | Adjust chart color palette |
| Badge colors | Semantic badges need review | Test all badge variants |
| Hover states | Subtle on white | Ensure `--color-bg-tertiary` is visible |

### Low Priority

| Component | Issue | Fix |
|-----------|-------|-----|
| SVG icons | `currentColor` — should be fine | Verify in context |
| Logo | Need light variant | Use `designs/logo.svg` (light) |

---

## 6. Logo Switching

| Context | Light Theme | Dark Theme |
|---------|-------------|------------|
| Header | `designs/logo.svg` (dark text) | `designs/logo-dark.svg` (light text) |
| About dialog | `designs/logo.svg` | `designs/logo-dark.svg` |
| App icon | `designs/logo-mark.svg` (unchanged) | `designs/logo-mark.svg` (unchanged) |

### CSS Approach

```css
[data-theme="light"] .header__logo svg { /* light logo */ }
[data-theme="dark"] .header__logo svg { /* dark logo */ }
```

Or use `prefers-color-scheme` within `[data-theme="system"]`.

---

## 7. Transition Behavior

### Theme Switch Animation

- **Duration**: `--motion-normal` (200ms)
- **Property**: `background-color`, `color`, `border-color`, `box-shadow`
- **Easing**: `ease-in-out`
- **Scope**: Apply to `body` and major containers

```css
body {
  transition: background-color var(--motion-normal),
              color var(--motion-normal);
}
```

### No Flash on Load

- Inline `<script>` in `<head>` reads localStorage and sets `data-theme` before first paint
- CSS uses `[data-theme]` selectors, not media queries, for explicit themes

---

## 8. Implementation Checklist

### For Engineer

- [ ] Add inline script to `index.html` `<head>` for theme initialization
- [ ] Refactor `tokens.css`: replace `@media (prefers-color-scheme: dark)` with `[data-theme="dark"]`
- [ ] Add `[data-theme="system"]` block that uses `@media (prefers-color-scheme: dark)`
- [ ] Add Appearance section to SettingsPage with segmented control
- [ ] Implement `localStorage` persistence
- [ ] Audit all pages for light theme rendering
- [ ] Add logo switching logic
- [ ] Test system theme detection
- [ ] Verify no FOUC (flash of unstyled content)

### For Designer (This Spec)

- [x] Define light theme color tokens
- [x] Specify theme toggle UI
- [x] Document persistence mechanism
- [x] Identify component audit items
- [ ] Review implementation screenshots
- [ ] Sign off on visual quality

---

## 9. Acceptance Criteria Mapping

| Criterion | Spec Section |
|-----------|--------------|
| User can switch between light and dark theme via settings | §4 Theme Toggle UI |
| Theme persists across app restarts | §2 Persistence |
| All screens render correctly in light mode | §5 Component Audit |
| Design System doc updated with light theme token values | DESIGN-SYSTEM.md update |

---

*This specification is the authoritative design reference for CMPAAA-511. Engineers implement from this spec; deviations require designer approval.*
