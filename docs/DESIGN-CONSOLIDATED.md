# AgentOps Desktop — Consolidated Design Specification

> Source of truth: CSS implementation in `src/renderer/styles/`
> Generated: 2026-05-28

---

## 1. Design Tokens

All tokens are CSS custom properties on `:root` (dark theme only).

### 1.1 Colors — Background

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-primary` | `#0D1117` | App background, main canvas |
| `--color-bg-secondary` | `#161B22` | Panels, cards, sidebar |
| `--color-bg-tertiary` | `#21262D` | Elevated surfaces, hover states |

### 1.2 Colors — Text

| Token | Value | Usage |
|-------|-------|-------|
| `--color-text-primary` | `#E6EDF3` | Headings, primary content |
| `--color-text-secondary` | `#8B949E` | Descriptions, metadata |
| `--color-text-tertiary` | `#484F58` | Disabled, placeholder |

### 1.3 Colors — Border

| Token | Value | Usage |
|-------|-------|-------|
| `--color-border` | `#30363D` | Default borders, dividers |
| `--color-border-subtle` | `#21262D` | Subtle separations |

### 1.4 Colors — Accent / Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent` | `#58A6FF` | Links, focus rings, primary actions |
| `--color-accent-hover` | `#79C0FF` | Accent hover state |
| `--color-success` | `#3FB950` | Agent healthy, task complete |
| `--color-warning` | `#D29922` | Agent degraded, task queued |
| `--color-danger` | `#F85149` | Agent offline, task failed |
| `--color-info` | `#58A6FF` | Logs, informational |

### 1.5 Colors — Agent Status

| Token | Value | Semantic |
|-------|-------|----------|
| `--status-running` | `#3FB950` | Agent actively executing |
| `--status-idle` | `#8B949E` | Agent waiting for work |
| `--status-error` | `#F85149` | Agent in fault state |
| `--status-spawning` | `#D29922` | Agent initializing |

### 1.6 Typography — Fonts

| Token | Value |
|-------|-------|
| `--font-sans` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace` |

### 1.7 Typography — Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | `11px` | Timestamps, badges |
| `--text-sm` | `13px` | Secondary text, metadata |
| `--text-base` | `14px` | Body text, list items |
| `--text-lg` | `16px` | Card titles, section headers |
| `--text-xl` | `20px` | Page titles |
| `--text-2xl` | `24px` | App title, hero text |

### 1.8 Typography — Mono Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-mono-sm` | `12px` | Inline code, agent IDs |
| `--text-mono-base` | `13px` | Log output, terminal |
| `--text-mono-lg` | `15px` | Code blocks, highlighted output |

### 1.9 Typography — Line Heights

| Token | Value |
|-------|-------|
| `--leading-xs` | `16px` |
| `--leading-sm` | `20px` |
| `--leading-base` | `22px` |
| `--leading-lg` | `24px` |
| `--leading-xl` | `28px` |
| `--leading-2xl` | `32px` |

### 1.10 Spacing

Base unit: **4px**

| Token | Value |
|-------|-------|
| `--space-0` | `0` |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-10` | `40px` |
| `--space-12` | `48px` |

### 1.11 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Badges, tags, small buttons |
| `--radius-md` | `6px` | Cards, inputs, standard elements |
| `--radius-lg` | `8px` | Modals, panels |
| `--radius-full` | `9999px` | Avatars, status dots |

### 1.12 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.3)` | Subtle lift, tooltips |
| `--shadow-md` | `0 4px 8px rgba(0, 0, 0, 0.4)` | Dropdowns, popovers |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.5)` | Modals, dialogs |

### 1.13 Motion

| Token | Value | Usage |
|-------|-------|-------|
| `--motion-fast` | `100ms ease-out` | Hover states, toggles |
| `--motion-normal` | `200ms ease-in-out` | Panel transitions, expansions |
| `--motion-slow` | `300ms ease-in-out` | Modal open/close |

### 1.14 Layout Dimensions

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar-width` | `240px` | Default sidebar width |
| `--sidebar-collapsed` | `48px` | Collapsed sidebar width |
| `--header-height` | `48px` | Header bar height |
| `--footer-height` | `28px` | Footer/status bar height |
| `--content-min-width` | `320px` | Minimum content area width |

---

## 2. Component Inventory

Extracted from `src/renderer/styles/components.css`. Uses BEM naming convention.

### 2.1 Atoms

| Component | CSS Classes | Description | Variants |
|-----------|-------------|-------------|----------|
| **Button** | `.btn` | Inline action trigger | `--primary`, `--secondary`, `--danger`, `--ghost`; sizes: `--sm` (28px), default (32px), `--lg` (36px); `--icon` for icon-only |
| **Status Dot** | `.status-dot` | 8px circle indicator | `--running`, `--idle`, `--error`, `--spawning` |
| **Status Badge** | `.status-badge` | Pill-shaped status label | `--running`, `--idle`, `--error`, `--spawning` |
| **Badge / Tag** | `.badge` | Categorical label | `--accent` |
| **Stat Value** | `.stat__value` | Large numeric display | Uses `tabular-nums` |
| **Stat Label** | `.stat__label` | Stat descriptor | — |

### 2.2 Molecules

| Component | CSS Classes | Description |
|-----------|-------------|-------------|
| **Card** | `.card`, `.card--hover` | Content container with optional hover state |
| **Card Header** | `.card__header` | Flex row: title left, actions right |
| **Card Title** | `.card__title` | 14px semibold heading |
| **Card Subtitle** | `.card__subtitle` | 13px secondary text |
| **Card Body** | `.card__body` | 13px secondary content |
| **Card Footer** | `.card__footer` | Actions row with top border |
| **Stat Card** | `.stat` | Flex column: value + label |
| **Page Header** | `.page-header` | Title + description + actions row |
| **Empty State** | `.empty-state` | Centered icon + title + description |

### 2.3 Organisms

| Component | CSS Classes | Description |
|-----------|-------------|-------------|
| **Table** | `.table` | Full-width data table with hover rows |
| **Dashboard Stats** | `.dashboard-stats` | 4-column grid of stat cards with colored icons |
| **Dashboard Grid** | `.dashboard-grid` | 2:1 column layout for main + sidebar content |
| **Activity Feed** | `.activity-feed` | Vertical list of activity items |
| **Activity Item** | `.activity-item` | Icon + content + timestamp row |
| **Agent List** | `.agent-list` | Vertical list of agent rows |
| **Agent Row** | `.agent-row` | Status dot + info + actions, card-style |
| **Task Columns** | `.task-columns` | 4-column grid for task board |
| **Task Column** | `.task-column` | Header + card list for one status |
| **Task Card** | `.task-card` | Clickable task with title + meta + agent |
| **Settings Section** | `.settings-section` | Titled section with settings rows |
| **Settings Row** | `.settings-row` | Label + description + control |
| **Log Viewer** | `.log-viewer` | Full-height monospace log display |
| **Log Line** | `.log-line` | Timestamp + tag + message, supports `--error` and `--warn` |

### 2.4 Templates (from layout.css)

| Template | CSS Classes | Description |
|----------|-------------|-------------|
| **App Shell** | `.app` | CSS Grid: header, sidebar, content, footer |
| **Header** | `.header`, `.header__left`, `.header__right`, `.header__toggle`, `.header__title` | Fixed 48px top bar with drag region |
| **Sidebar** | `.sidebar`, `.sidebar--collapsed`, `.sidebar__section`, `.sidebar__item`, `--active` | Collapsible 240px nav with active indicator |
| **Main Content** | `.main` | Scrollable content area with 24px padding |
| **Footer** | `.footer`, `.footer__left`, `.footer__right`, `.footer__status`, `.footer__dot` | Fixed 28px status bar |

---

## 3. Page Layouts

Extracted from `src/renderer/styles/pages.css`.

### 3.1 Dashboard

```
+------------------------------------------+
| Header (48px)                            |
+--------+---------------------------------+
|        | Stats Grid (4 columns)          |
|        +---------------------------------+
| Side   | Content (2fr) | Sidebar (1fr)   |
| bar    |               |                 |
| (240px)|               |                 |
+--------+---------------------------------+
| Footer (28px)                            |
+------------------------------------------+
```

- **Stats Grid**: 4-column grid, each card has colored icon (accent/success/warning/danger) + stat value + label
- **Dashboard Grid**: 2:1 ratio, main content + sidebar
- **Components**: `.dashboard-stats`, `.dashboard-grid`, `.stat`, `.card`

### 3.2 Agent Detail

- **Agent Row**: status dot + name + type (mono) + action buttons
- **Agent List**: vertical stack of agent rows with card styling
- **Components**: `.agent-list`, `.agent-row`, `.status-dot`, `.badge`

### 3.3 Tasks (Board View)

```
+------------------------------------------+
| Header (48px)                            |
+--------+---------------------------------+
|        | Col 1 | Col 2 | Col 3 | Col 4  |
| Side   | Todo  | In    | Done  | Blocked|
| bar    |       | Prog  |       |        |
| (240px)| Cards | Cards | Cards | Cards  |
+--------+---------------------------------+
| Footer (28px)                            |
+------------------------------------------+
```

- **Task Columns**: 4-column grid, min-height 400px
- **Task Card**: title + meta (agent name in mono, status badge)
- **Components**: `.task-columns`, `.task-column`, `.task-card`

### 3.4 Settings

```
+------------------------------------------+
| Header (48px)                            |
+--------+---------------------------------+
|        | Page Title                      |
| Side   +---------------------------------+
| bar    | Section Title                   |
| (240px)| [Label]              [Control]  |
|        | [Label]              [Control]  |
|        +---------------------------------+
|        | Section Title                   |
|        | [Label]              [Control]  |
+--------+---------------------------------+
| Footer (28px)                            |
+------------------------------------------+
```

- **Settings Section**: titled group with rows
- **Settings Row**: flex row with label + description on left, control on right
- **Components**: `.page-header`, `.settings-section`, `.settings-row`

### 3.5 Logs

```
+------------------------------------------+
| Header (48px)                            |
+--------+---------------------------------+
|        | Filter bar                      |
| Side   +---------------------------------+
| bar    | Log stream (monospace, full ht) |
| (240px)| [ts] [tag] message              |
|        | [ts] [tag] message              |
+--------+---------------------------------+
| Footer (28px)                            |
+------------------------------------------+
```

- **Log Viewer**: full-height monospace area, virtualized
- **Log Line**: timestamp (70px, tertiary) + tag badge + message, supports `--error` (red) and `--warn` (yellow)
- **Components**: `.log-viewer`, `.log-line`, `.logs-filter`

---

## 4. Asset Catalog

### 4.1 CSS Stylesheets

| File | Path | Size | Purpose |
|------|------|------|---------|
| `tokens.css` | `src/renderer/styles/tokens.css` | 2,230 B | All CSS custom properties on `:root` |
| `base.css` | `src/renderer/styles/base.css` | 2,099 B | Reset, global typography, form defaults, scrollbar, titlebar |
| `components.css` | `src/renderer/styles/components.css` | 5,646 B | Button, card, status, stat, badge, empty state, table, page header |
| `layout.css` | `src/renderer/styles/layout.css` | 4,519 B | App shell grid, header, sidebar, main, footer |
| `pages.css` | `src/renderer/styles/pages.css` | 5,154 B | Dashboard, activity feed, agent list, task board, settings, logs |

**Total CSS**: ~19.6 KB (5 files)

### 4.2 Design Documentation

| File | Path | Size | Purpose |
|------|------|------|---------|
| `DESIGN-SYSTEM.md` | `docs/DESIGN-SYSTEM.md` | 9.8 KB | Design system reference (tokens, components, patterns) |
| `DESIGN-SPEC.md` | `docs/DESIGN-SPEC.md` | 11.5 KB | Design specification (atomic inventory, page layouts, interactions) |
| `DESIGN-AUDIT.md` | `docs/DESIGN-AUDIT.md` | 10.3 KB | Design/UX audit with conflict analysis |
| `BRAND-IDENTITY.md` | `docs/BRAND-IDENTITY.md` | 14.3 KB | Brand guidelines (logo, color, typography, voice, audio) |
| `ACCESSIBILITY-AUDIT.md` | `docs/ACCESSIBILITY-AUDIT.md` | 14.2 KB | WCAG 2.2 AA compliance audit |
| `DESIGN-CONSOLIDATED.md` | `docs/DESIGN-CONSOLIDATED.md` | — | This file |

**Total Docs**: ~60 KB (5 files)

### 4.3 Test Harness

| File | Path | Lines | Purpose |
|------|------|-------|---------|
| `design-system-harness.html` | `tests/e2e/design-system-harness.html` | 263 | Standalone HTML rendering of app shell, sidebar, cards, buttons, logs |

### 4.4 Image / Icon Assets

**None.** No PNG, SVG, JPG, GIF, PSD, Sketch, or Figma exports exist in the project. The `assets/` directory contains only `.gitkeep`.

### 4.5 Font Assets

**None.** Fonts are loaded via system stacks (`-apple-system`, etc.) and Google Fonts references (Inter, JetBrains Mono). No local font files.

### 4.6 Audio Assets

**None.** Sound design is specified in `BRAND-IDENTITY.md` but no audio files exist.

---

## 5. Documented Conflicts

### 5.1 Primary Blue Accent — Three Values

| Source | Token | Value | Usage |
|--------|-------|-------|-------|
| `tokens.css` / `DESIGN-SYSTEM.md` | `--color-accent` | `#58A6FF` | Links, focus rings, buttons |
| `DESIGN-SPEC.md` | `--color-primary` | `#6366F1` | Primary actions (indigo) |
| `BRAND-IDENTITY.md` | Accent Blue / `ops-blue` | `#2563EB` | Brand accent |

**Resolution**: The CSS implementation (`tokens.css`) uses `#58A6FF`. This is the de facto standard. `DESIGN-SPEC.md` should be updated to match. `BRAND-IDENTITY.md` brand blue can remain distinct for marketing/brand assets but `#58A6FF` is the UI accent.

### 5.2 Font Size Base — 14px vs 16px

| Source | Base Size |
|--------|-----------|
| `tokens.css` / `DESIGN-SYSTEM.md` / `BRAND-IDENTITY.md` | `14px` |
| `DESIGN-SPEC.md` | `16px` |

**Resolution**: 14px is correct for a desktop ops tool (density over comfort). `DESIGN-SPEC.md` should be updated.

### 5.3 Shadow Values — Dark Theme vs Light Theme

| Source | `--shadow-sm` | `--shadow-md` | `--shadow-lg` |
|--------|---------------|---------------|---------------|
| `tokens.css` / `DESIGN-SYSTEM.md` | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.5)` |
| `DESIGN-SPEC.md` | `rgba(0,0,0,0.05)` | `rgba(0,0,0,0.07)` | `rgba(0,0,0,0.1)` |

**Resolution**: CSS uses darker shadows appropriate for dark theme. `DESIGN-SPEC.md` values are for light theme. The CSS values are correct for the implemented dark theme.

### 5.4 Border Radius Tokens — Extra `--radius-xl`

| Source | Has `--radius-xl` (12px) |
|--------|--------------------------|
| `tokens.css` | No |
| `DESIGN-SPEC.md` | Yes (for modals) |

**Resolution**: Add `--radius-xl: 12px` to `tokens.css` if modal borders need it. Low priority.

---

## 6. Accessibility Notes

From `ACCESSIBILITY-AUDIT.md`, three critical contrast issues exist in the current token set:

| Issue | Token | Current | Suggested |
|-------|-------|---------|-----------|
| `text-tertiary` on dark bg | `--color-text-tertiary` | `#484F58` (2.28:1) | `#768390` (4.54:1) |
| White on accent buttons | `.btn--primary` | `#FFF` on `#58A6FF` (2.53:1) | `#0D1117` on `#58A6FF` (7.49:1) |
| White on warning buttons | `.btn--warning` | `#FFF` on `#D29922` (2.52:1) | `#0D1117` on `#D29922` (7.50:1) |

These are flagged but not yet resolved in the CSS.

---

## 7. Design Principles

From `DESIGN-SYSTEM.md`:

1. **Clarity over density** — Prioritize readability and clear hierarchy
2. **Progressive disclosure** — Show essentials first, details on demand
3. **Consistent patterns** — Same problem, same solution
4. **Immediate feedback** — Every action has a visible response
5. **Accessible by default** — Design for all users from the start

---

*This document consolidates design intent from all project design files. The CSS implementation (`src/renderer/styles/`) is the source of truth for what is actually built. Update this document when the CSS changes.*
