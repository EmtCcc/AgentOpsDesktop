# AgentOps Desktop — Design System

## Brand Identity

**Product**: AgentOps Desktop — a desktop application for monitoring, managing, and orchestrating AI agent operations.

**Voice**: Technical, precise, calm. Information density over decoration. The UI should feel like a cockpit instrument panel — clear hierarchy, fast scanning, minimal chrome.

**Tagline**: *Operational control for autonomous agents.*

---

## Color Palette

### Core

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-primary` | `#0D1117` | App background, main canvas |
| `--color-bg-secondary` | `#161B22` | Panels, cards, sidebar |
| `--color-bg-tertiary` | `#21262D` | Elevated surfaces, modals |
| `--color-border` | `#30363D` | Default borders, dividers |
| `--color-border-subtle` | `#21262D` | Subtle separations |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#E6EDF3` | Headings, primary content |
| `--color-text-secondary` | `#8B949E` | Descriptions, metadata |
| `--color-text-tertiary` | `#484F58` | Disabled, placeholder |

### Accent / Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-accent` | `#58A6FF` | Links, focus rings, active states |
| `--color-accent-hover` | `#79C0FF` | Hover state for accent |
| `--color-success` | `#3FB950` | Agent healthy, task complete |
| `--color-warning` | `#D29922` | Agent degraded, task queued |
| `--color-danger` | `#F85149` | Agent offline, task failed |
| `--color-info` | `#58A6FF` | Logs, informational |

### Agent Status Colors

| Status | Hex | Semantic |
|--------|-----|----------|
| Running | `#3FB950` | Agent actively executing |
| Idle | `#8B949E` | Agent waiting for work |
| Error | `#F85149` | Agent in fault state |
| Spawning | `#D29922` | Agent initializing |

---

## Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

**Primary font**: Inter — used for all UI text.
**Mono font**: JetBrains Mono — used for logs, code, terminal output, agent IDs.

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | 11px | 400 | 16px | Timestamps, badges |
| `--text-sm` | 13px | 400 | 20px | Secondary text, metadata |
| `--text-base` | 14px | 400 | 22px | Body text, list items |
| `--text-lg` | 16px | 600 | 24px | Card titles, section headers |
| `--text-xl` | 20px | 600 | 28px | Page titles |
| `--text-2xl` | 24px | 700 | 32px | App title, hero text |

### Mono Scale (for logs / terminal)

| Token | Size | Usage |
|-------|------|-------|
| `--text-mono-sm` | 12px | Inline code, agent IDs |
| `--text-mono-base` | 13px | Log output, terminal |
| `--text-mono-lg` | 15px | Code blocks, highlighted output |

---

## Spacing Scale

Base unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0 | Reset |
| `--space-1` | 4px | Tight gaps, icon padding |
| `--space-2` | 8px | Compact element spacing |
| `--space-3` | 12px | Default inner padding |
| `--space-4` | 16px | Card padding, list item gaps |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Panel padding |
| `--space-8` | 32px | Major section separation |
| `--space-10` | 40px | Page margins |
| `--space-12` | 48px | Top-level layout gaps |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Badges, tags, small buttons |
| `--radius-md` | 6px | Cards, inputs, standard elements |
| `--radius-lg` | 8px | Modals, panels |
| `--radius-full` | 9999px | Avatars, status dots |

---

## Shadows / Elevation

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle lift, tooltips |
| `--shadow-md` | `0 4px 8px rgba(0,0,0,0.4)` | Dropdowns, popovers |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | Modals, dialogs |

---

## Component Patterns

### Buttons

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| Primary | `--color-accent` | `#FFFFFF` | none | Main CTAs |
| Secondary | transparent | `--color-text-primary` | `--color-border` | Secondary actions |
| Danger | `--color-danger` | `#FFFFFF` | none | Destructive actions |
| Ghost | transparent | `--color-text-secondary` | none | Tertiary, toolbar |

**Sizes**: sm (28px h), md (32px h), lg (36px h)

### Inputs

- Background: `--color-bg-primary`
- Border: `--color-border`
- Focus ring: `--color-accent` 2px outline
- Placeholder: `--color-text-tertiary`
- Height: 32px (standard), 28px (compact)

### Cards / Panels

- Background: `--color-bg-secondary`
- Border: 1px solid `--color-border`
- Border radius: `--radius-md`
- Padding: `--space-4`

### Status Indicators

- Dot: 8px circle, filled with status color
- Badge: pill shape, status color background at 15% opacity, status color text

### Scrollbars

- Track: `--color-bg-primary`
- Thumb: `--color-border`, rounded, 6px wide
- Hover thumb: `--color-text-tertiary`

---

## Layout

### App Shell

```
┌──────────────────────────────────────────────┐
│  Header (48px)                               │
├────────┬─────────────────────────────────────┤
│        │                                     │
│ Side   │  Main Content Area                  │
│ bar    │  (scrollable)                       │
│ 240px  │                                     │
│        │                                     │
├────────┴─────────────────────────────────────┤
│  Footer / Status Bar (28px)                  │
└──────────────────────────────────────────────┘
```

- Sidebar: collapsible, 240px default, 48px collapsed
- Content: fluid, min-width 320px
- Header: fixed, 48px, contains navigation and global actions
- Footer: fixed, 28px, contains status and connection info

### Grid

- Use CSS Grid for dashboard layouts
- Default column gap: `--space-4` (16px)
- Default row gap: `--space-4` (16px)
- Breakpoints not needed (desktop-only), but support window resize down to 960px wide

---

## Motion

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `--motion-fast` | 100ms | `ease-out` | Hover states, toggles |
| `--motion-normal` | 200ms | `ease-in-out` | Panel transitions, expansions |
| `--motion-slow` | 300ms | `ease-in-out` | Modal open/close, page transitions |

- Prefer instant feedback for clicks (< 50ms)
- Use `prefers-reduced-motion` media query to disable animations

---

## Iconography

- **Library**: Lucide Icons (consistent stroke-based icon set)
- **Size**: 16px (inline), 20px (toolbar), 24px (navigation)
- **Stroke width**: 1.5px (default), 2px (emphasis)
- **Color**: `currentColor` — inherits from text color

---

## Responsive Breakpoints

Desktop-only application. Window resize triggers layout adjustments:

| Name | Width | Behavior |
|------|-------|----------|
| `compact` | < 960px | Sidebar collapses to icon rail (48px), data tables switch to card view |
| `default` | 960–1279px | Standard layout, sidebar 240px |
| `wide` | ≥ 1280px | Full layout, optional secondary panels |

Modal behavior: modals become full-screen below 640px width.

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for text, 3:1 for large text and UI components
- All interactive elements must have visible focus indicators (`--color-accent` ring)
- Support keyboard navigation throughout
- Status conveyed through color AND iconography (never color alone)
- `prefers-reduced-motion` respected
- `prefers-color-scheme: light` support planned (dark is default)

---

## CSS Custom Properties Summary

All tokens are exposed as CSS custom properties on `:root`. Example:

```css
:root {
  /* Colors */
  --color-bg-primary: #0D1117;
  --color-bg-secondary: #161B22;
  --color-bg-tertiary: #21262D;
  --color-border: #30363D;
  --color-text-primary: #E6EDF3;
  --color-text-secondary: #8B949E;
  --color-accent: #58A6FF;
  --color-success: #3FB950;
  --color-warning: #D29922;
  --color-danger: #F85149;

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Motion */
  --motion-fast: 100ms ease-out;
  --motion-normal: 200ms ease-in-out;
  --motion-slow: 300ms ease-in-out;
}
```

---

## Implementation Notes

### For Engineers

1. **Design Tokens** — Create `src/renderer/styles/tokens.css` with all CSS custom properties from this document
2. **Base Styles** — Create `src/renderer/styles/base.css` with reset, typography, and global styles
3. **Component Library** — Scaffold components in `src/renderer/components/` following the patterns defined above
4. **Dark Mode** — Default theme is dark; light mode support is planned but not required for v1

### File Structure

```
src/renderer/styles/
├── tokens.css      # All CSS custom properties
├── base.css        # Reset, typography, global styles
├── components/     # Component-specific styles
└── utilities/      # Helper classes (spacing, text, etc.)
```

---

*This design system is a living document. Update as the product evolves.*
