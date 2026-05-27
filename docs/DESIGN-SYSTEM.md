# AgentOps Desktop — Design System v2.0

## Brand Identity

**Product**: AgentOps Desktop — a desktop application for monitoring, managing, and orchestrating AI agent operations.

**Voice**: Technical, precise, calm. Information density over decoration. The UI should feel like a cockpit instrument panel — clear hierarchy, fast scanning, minimal chrome.

**Tagline**: *Operational control for autonomous agents.*

### Logo Assets

| Asset | File | Usage |
|-------|------|-------|
| Full logo (light) | `designs/logo.svg` | Header, onboarding |
| Full logo (dark) | `designs/logo-dark.svg` | Dark mode header |
| Icon mark | `designs/logo-mark.svg` | App icon, favicon |
| Icon sprite | `designs/icons.svg` | Custom UI icons |

**Clear space**: Minimum 1x the mark height on all sides.
**Minimum size**: 120px wide (full logo), 24px (icon mark).

---

## Color Palette

### Core (Light Mode Default)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-primary` | `#FFFFFF` | App background, main canvas |
| `--color-bg-secondary` | `#F9FAFB` | Panels, cards, sidebar |
| `--color-bg-tertiary` | `#F3F4F6` | Elevated surfaces, hover states |
| `--color-bg-elevated` | `#FFFFFF` | Modals, dropdowns |
| `--color-border` | `#E5E7EB` | Default borders, dividers |
| `--color-border-subtle` | `#F3F4F6` | Subtle separations |
| `--color-border-focus` | `#6366F1` | Focus rings |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#111827` | Headings, primary content |
| `--color-text-secondary` | `#6B7280` | Descriptions, metadata |
| `--color-text-tertiary` | `#71717A` | Disabled, placeholder |
| `--color-text-inverse` | `#FFFFFF` | Text on primary backgrounds |

### Accent / Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#6366F1` | Links, focus rings, primary actions |
| `--color-primary-hover` | `#4F46E5` | Hover state for primary |
| `--color-primary-light` | `rgba(99,102,241,0.1)` | Selection highlights, badges |
| `--color-success` | `#10B981` | Agent healthy, task complete |
| `--color-warning` | `#F59E0B` | Agent degraded, task queued |
| `--color-danger` | `#EF4444` | Agent offline, task failed |
| `--color-info` | `#3B82F6` | Logs, informational |

### Agent Status Colors

| Token | Hex | Semantic |
|-------|-----|----------|
| `--status-running` | `#10B981` | Agent actively executing |
| `--status-idle` | `#6B7280` | Agent waiting for work |
| `--status-error` | `#EF4444` | Agent in fault state |
| `--status-spawning` | `#F59E0B` | Agent initializing |

### Dark Mode

All tokens have dark mode variants via `@media (prefers-color-scheme: dark)`. See `src/renderer/styles/tokens.css` for the full mapping.

---

## Typography

### Font Stack

| Role | Font | Fallback |
|------|------|----------|
| UI Text | Inter | -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif |
| Code/Paths | JetBrains Mono | Fira Code, Cascadia Code, monospace |

### Type Scale

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `--text-xs` | 12px | 16px | Timestamps, badges, metadata |
| `--text-sm` | 14px | 20px | Body, descriptions, navigation |
| `--text-base` | 16px | 22px | Default body text |
| `--text-lg` | 18px | 24px | Section titles, card headers |
| `--text-xl` | 20px | 28px | Card titles |
| `--text-2xl` | 24px | 32px | Page titles |
| `--text-3xl` | 30px | 36px | Hero headings |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--font-normal` | 400 | Body text |
| `--font-medium` | 500 | Labels, navigation items |
| `--font-semibold` | 600 | Headings, emphasis |
| `--font-bold` | 700 | Hero text, brand |

---

## Spacing

Base unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0 | Reset |
| `--space-1` | 4px | Tight gaps, inline elements |
| `--space-2` | 8px | Small gaps, compact layouts |
| `--space-3` | 12px | Default internal padding |
| `--space-4` | 16px | Standard gaps, card padding |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Panel padding, large gaps |
| `--space-8` | 32px | Page margins, major sections |
| `--space-10` | 40px | Hero spacing |
| `--space-12` | 48px | Page-level spacing |
| `--space-16` | 64px | Major layout gaps |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Inline code, small badges |
| `--radius-md` | 6px | Inputs, buttons, small cards |
| `--radius-lg` | 8px | Cards, panels, modals |
| `--radius-xl` | 12px | Large cards, hero sections |
| `--radius-2xl` | 16px | Feature cards |
| `--radius-full` | 9999px | Avatars, status dots, pills |

---

## Shadows / Elevation

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift, cards |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Dropdowns, popovers |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dialogs |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.12)` | Toast notifications |
| `--shadow-inner` | `inset 0 2px 4px rgba(0,0,0,0.05)` | Inset elements |

---

## Motion

| Token | Value | Usage |
|-------|-------|-------|
| `--motion-fast` | 150ms ease | Hover states, focus rings |
| `--motion-normal` | 200ms ease | Transitions, toggles |
| `--motion-slow` | 300ms ease | Page transitions, modals |
| `--motion-spring` | 300ms cubic-bezier(0.34,1.56,0.64,1) | Bouncy entrances |

**Reduced motion**: All animations respect `prefers-reduced-motion: reduce`.

---

## Layout

### App Shell

```
┌─────────────────────────────────────────────┐
│                  Header (64px)               │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │          Content                 │
│ (240px)  │                                  │
│          │                                  │
├──────────┴──────────────────────────────────┤
│               Footer (32px)                 │
└─────────────────────────────────────────────┘
```

### Dimensions

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar-width` | 240px | Default sidebar width |
| `--sidebar-collapsed` | 64px | Collapsed sidebar |
| `--header-height` | 64px | Header bar |
| `--footer-height` | 32px | Status bar |
| `--content-min-width` | 320px | Minimum content area |
| `--max-content-width` | 1280px | Max content width |

### Responsive

| Breakpoint | Width | Sidebar | Grid |
|------------|-------|---------|------|
| Desktop | >1024px | Full (240px) | 4 columns |
| Tablet | 960-1024px | Collapsed (64px) | 2 columns |
| Mobile | <960px | Hidden | 1 column |

### Grid

- 12-column grid with 24px gutter
- Max content width: 1280px
- CSS Grid for dashboard layouts

---

## Component Patterns

### Buttons

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| Primary | `--color-primary` | White | None | Main CTAs |
| Secondary | `--color-bg-tertiary` | `--color-text-primary` | `--color-border` | Secondary actions |
| Ghost | Transparent | `--color-text-secondary` | None | Tertiary, toolbar |
| Danger | `--color-danger` | White | None | Destructive actions |

**Sizes**: `btn--sm` (28px), default (36px), `btn--lg` (44px)

**States**: Default → Hover (darken 5%) → Active (darken 10%) → Disabled (50% opacity)

### Inputs

- Height: 36px
- Border: 1px solid `--color-border`
- Focus: border `--color-border-focus`, ring `0 0 0 3px --color-primary-light`
- Placeholder: `--color-text-tertiary`

### Cards / Panels

- Background: `--color-bg-elevated`
- Border: 1px solid `--color-border`
- Radius: `--radius-lg`
- Shadow: `--shadow-sm`
- Padding: `--space-4`

### Status Indicators

- Dot: 8px circle, filled with status color
- Badge: pill shape, status color background at 15% opacity, status color text

### Scrollbars

- Track: `--color-bg-primary`
- Thumb: `--color-border`, rounded, 8px wide
- Hover thumb: `--color-text-tertiary`

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 0 | Default stacking |
| `--z-dropdown` | 100 | Dropdowns, popovers |
| `--z-sticky` | 200 | Header, sidebar |
| `--z-modal` | 300 | Modal overlays |
| `--z-toast` | 400 | Toast notifications |
| `--z-tooltip` | 500 | Tooltips |

---

## Iconography

- **Library**: Lucide Icons (stroke-based, consistent)
- **Sizes**: 14px (inline), 16px (toolbar), 18px (navigation), 20px (sidebar)
- **Stroke width**: 2px
- **Color**: `currentColor` — inherits from text color
- **Custom icons**: `designs/icons.svg` sprite sheet

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for text, 3:1 for large text and UI components
- All interactive elements have visible focus indicators (`outline: 2px solid --color-border-focus`)
- Support keyboard navigation throughout
- Status conveyed through color AND iconography (never color alone)
- `prefers-reduced-motion` respected
- `aria-live="polite"` for real-time content updates
- Semantic HTML with ARIA labels for dynamic regions

---

## Design Token Files

| File | Format | Purpose |
|------|--------|---------|
| `src/renderer/styles/tokens.css` | CSS Custom Properties | Runtime tokens |
| `src/renderer/styles/tokens.json` | JSON | Tooling, code generation |
| `designs/logo.svg` | SVG | Brand asset (light) |
| `designs/logo-dark.svg` | SVG | Brand asset (dark) |
| `designs/logo-mark.svg` | SVG | App icon basis |
| `designs/icons.svg` | SVG Sprite | Custom icon system |

---

## Implementation Notes

### For Engineers

1. **Design Tokens** — All CSS custom properties are in `src/renderer/styles/tokens.css`
2. **Base Styles** — Reset, typography, and globals in `src/renderer/styles/base.css`
3. **Layout** — App shell in `src/renderer/styles/layout.css`
4. **Components** — Component styles in `src/renderer/styles/components.css`
5. **Pages** — Page-specific styles in `src/renderer/styles/pages.css`

### File Structure

```
src/renderer/styles/
├── tokens.css      # All CSS custom properties (light + dark)
├── base.css        # Reset, typography, global styles
├── layout.css      # App shell, grid, responsive
├── components.css  # Buttons, cards, inputs, etc.
└── pages.css       # Page-specific styles

designs/
├── README.md       # Asset index
├── logo.svg        # Full logo (light)
├── logo-dark.svg   # Full logo (dark)
├── logo-mark.svg   # Icon mark
└── icons.svg       # SVG sprite sheet
```

---

*This design system is a living document. Update as the product evolves.*
