# AgentOps Desktop — Design Specification

**Source of truth**: `src/renderer/styles/tokens.css` (v2)
**Last updated**: 2026-05-28

---

## Design Tokens

### Colors — Light Mode (Default)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-primary` | `#FFFFFF` | Main background |
| `--color-bg-secondary` | `#F9FAFB` | Sidebar, cards, panels |
| `--color-bg-tertiary` | `#F3F4F6` | Input backgrounds, disabled states |
| `--color-bg-elevated` | `#FFFFFF` | Elevated surfaces |
| `--color-border` | `#E5E7EB` | Default borders, dividers |
| `--color-border-subtle` | `#F3F4F6` | Subtle separations |
| `--color-border-focus` | `#6366F1` | Focus rings |
| `--color-text-primary` | `#111827` | Main text |
| `--color-text-secondary` | `#6B7280` | Secondary text, labels |
| `--color-text-tertiary` | `#9CA3AF` | Placeholder, disabled text |
| `--color-text-inverse` | `#FFFFFF` | Inverse text (on dark surfaces) |

### Colors — Accent / Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#6366F1` | Primary actions, links, active states |
| `--color-primary-hover` | `#4F46E5` | Primary hover state |
| `--color-primary-light` | `rgba(99, 102, 241, 0.1)` | Primary background tint |
| `--color-success` | `#10B981` | Success, positive indicators |
| `--color-success-light` | `rgba(16, 185, 129, 0.1)` | Success background tint |
| `--color-warning` | `#F59E0B` | Warning states |
| `--color-warning-light` | `rgba(245, 158, 11, 0.1)` | Warning background tint |
| `--color-danger` | `#EF4444` | Errors, destructive actions |
| `--color-danger-light` | `rgba(239, 68, 68, 0.1)` | Danger background tint |
| `--color-info` | `#3B82F6` | Informational |
| `--color-info-light` | `rgba(59, 130, 246, 0.1)` | Info background tint |

### Colors — Agent Status

| Token | Value | Semantic |
|-------|-------|----------|
| `--status-running` | `#10B981` | Agent actively executing |
| `--status-idle` | `#6B7280` | Agent waiting for work |
| `--status-error` | `#EF4444` | Agent in fault state |
| `--status-spawning` | `#F59E0B` | Agent initializing |

### Colors — Dark Mode (`prefers-color-scheme: dark`)

| Token | Value |
|-------|-------|
| `--color-bg-primary` | `#111827` |
| `--color-bg-secondary` | `#1F2937` |
| `--color-bg-tertiary` | `#374151` |
| `--color-bg-elevated` | `#1F2937` |
| `--color-border` | `#374151` |
| `--color-border-subtle` | `#1F2937` |
| `--color-border-focus` | `#818CF8` |
| `--color-text-primary` | `#F9FAFB` |
| `--color-text-secondary` | `#D1D5DB` |
| `--color-text-tertiary` | `#9CA3AF` |
| `--color-text-inverse` | `#111827` |
| `--color-primary` | `#818CF8` |
| `--color-primary-hover` | `#6366F1` |
| `--color-primary-light` | `rgba(129, 140, 248, 0.15)` |
| `--color-success` | `#34D399` |
| `--color-success-light` | `rgba(52, 211, 153, 0.15)` |
| `--color-warning` | `#FBBF24` |
| `--color-warning-light` | `rgba(251, 191, 36, 0.15)` |
| `--color-danger` | `#F87171` |
| `--color-danger-light` | `rgba(248, 113, 113, 0.15)` |
| `--color-info` | `#60A5FA` |
| `--color-info-light` | `rgba(96, 165, 250, 0.15)` |

---

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif` | Body text |
| `--font-mono` | `JetBrains Mono, 'Fira Code', 'Cascadia Code', monospace` | Code, logs, terminal |

#### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | 12px | 400 | 1.25 | Timestamps, badges, captions |
| `--text-sm` | 14px | 400 | 1.5 | Secondary text, metadata |
| `--text-base` | 16px | 400 | 1.5 | Body default |
| `--text-lg` | 18px | 600 | 1.25 | Card titles, section headers |
| `--text-xl` | 20px | 600 | 1.25 | Page titles |
| `--text-2xl` | 24px | 700 | 1.25 | App title, hero text |
| `--text-3xl` | 30px | 700 | 1.25 | Large display |
| `--text-4xl` | 36px | 700 | 1.25 | Hero display |

#### Weights

| Token | Value |
|-------|-------|
| `--font-normal` | 400 |
| `--font-medium` | 500 |
| `--font-semibold` | 600 |
| `--font-bold` | 700 |

#### Line Heights

| Token | Value |
|-------|-------|
| `--leading-tight` | 1.25 |
| `--leading-normal` | 1.5 |
| `--leading-relaxed` | 1.75 |

---

### Spacing

Base unit: **4px**

| Token | Value |
|-------|-------|
| `--space-0` | 0 |
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-20` | 80px |
| `--space-24` | 96px |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Badges, tags, small elements |
| `--radius-md` | 6px | Buttons, inputs, cards |
| `--radius-lg` | 8px | Modals, panels |
| `--radius-xl` | 12px | Large containers |
| `--radius-2xl` | 16px | Extra-large containers |
| `--radius-full` | 9999px | Avatars, status dots, pills |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards, dropdowns |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, popovers |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.12)` | High elevation |
| `--shadow-2xl` | `0 25px 50px rgba(0,0,0,0.15)` | Maximum elevation |
| `--shadow-inner` | `inset 0 2px 4px rgba(0,0,0,0.05)` | Inset surfaces |

Dark mode shadows increase opacity (0.2 → 0.35 range).

### Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--motion-fast` | 150ms ease | Hover states, toggles |
| `--motion-normal` | 200ms ease | Panel transitions, expansions |
| `--motion-slow` | 300ms ease | Modal open/close, page transitions |
| `--motion-spring` | 300ms cubic-bezier(0.34, 1.56, 0.64, 1) | Bouncy entrance effects |

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 0 | Default |
| `--z-dropdown` | 100 | Dropdowns |
| `--z-sticky` | 200 | Sticky headers |
| `--z-modal` | 300 | Modals |
| `--z-toast` | 400 | Notifications |
| `--z-tooltip` | 500 | Tooltips |

### Grid

| Token | Value |
|-------|-------|
| `--grid-columns` | 12 |
| `--grid-gutter` | 24px |
| `--grid-margin` | 32px |

---

## Layout

### Window Dimensions

| Property | Value |
|----------|-------|
| Default width | 1280px |
| Default height | 800px |
| Min width | 960px |
| Min height | 600px |
| Title bar height | 32px (frameless) |

### Layout Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar-width` | 240px | Default sidebar width |
| `--sidebar-collapsed` | 64px | Collapsed sidebar (icon rail) |
| `--header-height` | 64px | Top header bar |
| `--footer-height` | 32px | Bottom status bar |
| `--content-min-width` | 320px | Minimum content area |
| `--max-content-width` | 1280px | Maximum content width |

### App Shell

CSS Grid layout with three rows and two columns:

```
grid-template-areas:
  "header  header"
  "sidebar content"
  "footer  footer";
```

- **Header**: Fixed top bar (64px), contains logo, navigation toggle, notifications, settings
- **Sidebar**: Left nav (240px), collapsible to 64px icon rail. Sections: Overview (Dashboard), Operations (Agents, Tasks, Logs), Footer (Settings)
- **Content**: Fluid scrollable area, padding 24px, min-width 320px
- **Footer**: Status bar (32px), shows system status, agent count, version

### Responsive Behavior

Desktop-only. Window resize triggers:
- Sidebar collapses to icon rail below 960px width
- Modals become full-screen below 640px width

---

## Component Inventory

### Atoms

| Component | CSS Class | States | Source |
|-----------|-----------|--------|--------|
| Button | `.btn` | default, hover, active, disabled, loading | `components.css` |
| Button — Primary | `.btn--primary` | hover → primary-hover + shadow-md | |
| Button — Secondary | `.btn--secondary` | hover → bg-tertiary, border-text-tertiary | |
| Button — Danger | `.btn--danger` | hover → `#DC2626` | |
| Button — Ghost | `.btn--ghost` | hover → bg-tertiary | |
| Status Dot | `.status-dot` | running, idle, error, spawning | |
| Status Badge | `.status-badge` | running, idle, error, spawning | |
| Badge / Tag | `.badge` | default, primary, success, warning, danger | |
| Avatar | `.avatar` | sm, lg, xl, primary, success, warning, danger | |

**Button sizes**: sm (32px), md (36px default), lg (40px), icon (36×36)

### Molecules

| Component | CSS Class | Composition |
|-----------|-----------|-------------|
| Card | `.card` | header + body + footer |
| Card — Hover | `.card--hover` | hover → border-primary + shadow-md |
| Card — Elevated | `.card--elevated` | static shadow-md |
| Stat Card | `.stat-card` | icon + content (value + label + change) |
| Alert | `.alert` | icon + content (title + description) + close |
| Progress Bar | `.progress` | bar with success/warning/danger variants |
| Tooltip | `.tooltip` | content positioned above target |
| Skeleton | `.skeleton` | text, title, avatar, card loading states |
| Page Header | `.page-header` | title + description + actions |
| Activity Item | `.activity-item` | icon + content + timestamp |
| Agent Row | `.agent-row` | info + type + actions |
| Task Card | `.task-card` | title + meta + agent reference |
| Empty State | `.empty-state` | icon + title + description + actions |

### Organisms

| Component | CSS Class | Composition |
|-----------|-----------|-------------|
| Header | `.header` | left (toggle + title) + right (actions) |
| Sidebar | `.sidebar` | sections + items + footer |
| Dashboard Stats | `.dashboard-stats` | 4-column stat card grid |
| Dashboard Grid | `.dashboard-grid` | 2:1 content/sidebar split |
| Activity Feed | `.activity-feed` | ActivityItem[] |
| Agent List | `.agent-list` | AgentRow[] |
| Task Board | `.task-columns` | 4-column kanban |
| Task Column | `.task-column` | header + cards[] |
| Settings Section | `.settings-section` | title + rows[] |
| Log Viewer | `.log-viewer` | log-line[] with timestamps |
| Table | `.table` | th + td with hover rows |
| Footer | `.footer` | status + metadata |

### Templates / Pages

| Page | Route | Components |
|------|-------|------------|
| Dashboard | `dashboard` | DashboardStats, DashboardGrid (AgentList + ActivityFeed) |
| Agents | `agents` | PageHeader, AgentList, AgentRow[] |
| Tasks | `tasks` | PageHeader, TaskBoard (TaskColumn × 4) |
| Logs | `logs` | PageHeader, FilterBar, LogViewer |
| Settings | `settings` | PageHeader, SettingsSection[], Form |

---

## Page Layouts

### Dashboard

```
+------------------------------------------+
| Header (64px)                            |
+--------+---------------------------------+
|        | Stats Bar (4 × stat cards)      |
|        +---------------------------------+
| Side   |                                 |
| bar    | Agent List (2fr)  | Activity    |
| (240px)|                   | Feed (1fr)  |
|        |                   |             |
+--------+---------------------------------+
| Footer (32px)                            |
+------------------------------------------+
```

### Agents

```
+------------------------------------------+
| Header                                   |
+--------+---------------------------------+
|        | Page Header [title] [actions]   |
| Side   +---------------------------------+
| bar    | Agent Row (name, type, status)  |
|        | Agent Row                       |
|        | ...                             |
+--------+---------------------------------+
| Footer                                   |
+------------------------------------------+
```

### Tasks (Kanban Board)

```
+------------------------------------------+
| Header                                   |
+--------+---------------------------------+
|        | Page Header                     |
| Side   +---------------------------------+
| bar    | Pending | In Prog | Done | Failed|
|        | card    | card    | card | card  |
|        | card    | card    |      |       |
+--------+---------------------------------+
| Footer                                   |
+------------------------------------------+
```

### Logs

```
+------------------------------------------+
| Header                                   |
+--------+---------------------------------+
|        | Page Header + Filter Bar        |
| Side   +---------------------------------+
| bar    | [ts] [tag] log message          |
|        | [ts] [tag] log message          |
|        | ... (virtualized scroll)        |
+--------+---------------------------------+
| Footer                                   |
+------------------------------------------+
```

### Settings

```
+------------------------------------------+
| Header                                   |
+--------+---------------------------------+
|        | Page Header                     |
| Side   +─────────────────────────────────+
| bar    | Section Title                   |
|        |  Label .............. [control] |
|        |  Label .............. [control] |
|        | Section Title                   |
|        |  ...                            |
+--------+---------------------------------+
| Footer                                   |
+------------------------------------------+
```

---

## Interaction Patterns

### Navigation

- **Primary**: Sidebar nav, always visible (collapsible to icon rail)
- **Secondary**: Tabs within pages
- **Tertiary**: Breadcrumbs for nested content

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + ,` | Open settings |
| `Cmd/Ctrl + N` | New agent |
| `Cmd/Ctrl + R` | Refresh current view |
| `Esc` | Close modal/dropdown |

### State Feedback

- **Loading**: Skeleton screens (not spinners)
- **Empty**: Illustration + CTA via `.empty-state`
- **Error**: Inline alerts with retry action
- **Success**: Toast notifications (auto-dismiss 3s)

---

## Accessibility

- **Color contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for large text)
- **Focus indicators**: Visible focus ring (`--color-border-focus`) on all interactive elements
- **Screen reader**: ARIA labels on all interactive components
- **Keyboard**: Full keyboard navigation
- **Motion**: Respect `prefers-reduced-motion`
- **Status**: Conveyed through color AND iconography (never color alone)

---

## Iconography

- **Library**: Lucide Icons (consistent, MIT licensed)
- **Sizes**: 16px (inline), 18px (sidebar, default), 24px (emphasis)
- **Stroke width**: 2px
- **Color**: `currentColor` — inherits from text color

---

## Design Principles

1. **Clarity over density** — Prioritize readability and clear hierarchy
2. **Progressive disclosure** — Show essentials first, details on demand
3. **Consistent patterns** — Same problem, same solution
4. **Immediate feedback** — Every action has a visible response
5. **Accessible by default** — Design for all users from the start

---

## Documentation Sync Notes

`DESIGN-SYSTEM.md` and `BRAND-IDENTITY.md` reference a dark-first color palette (`#0D1117` bg, `#58A6FF` accent) that predates `tokens.css` v2. This spec is the canonical reference for the current implementation. The other docs should be updated to match on the next pass.
