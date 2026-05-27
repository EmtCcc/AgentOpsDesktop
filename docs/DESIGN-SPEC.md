# AgentOps Desktop - Design Specification

## Overview

Design specification for AgentOps Desktop, an Electron-based desktop application for agent operations management.

---

## Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#6366F1` | Primary actions, active states |
| `--color-primary-hover` | `#4F46E5` | Primary hover state |
| `--color-secondary` | `#10B981` | Success, positive indicators |
| `--color-warning` | `#F59E0B` | Warning states |
| `--color-danger` | `#EF4444` | Errors, destructive actions |
| `--color-bg-primary` | `#FFFFFF` | Main background |
| `--color-bg-secondary` | `#F9FAFB` | Sidebar, cards |
| `--color-bg-tertiary` | `#F3F4F6` | Input backgrounds, disabled |
| `--color-text-primary` | `#111827` | Main text |
| `--color-text-secondary` | `#6B7280` | Secondary text, labels |
| `--color-text-tertiary` | `#9CA3AF` | Placeholder, disabled text |
| `--color-border` | `#E5E7EB` | Default borders |
| `--color-border-focus` | `#6366F1` | Focus rings |

### Dark Mode Variants

| Token | Value |
|-------|-------|
| `--color-bg-primary-dark` | `#111827` |
| `--color-bg-secondary-dark` | `#1F2937` |
| `--color-bg-tertiary-dark` | `#374151` |
| `--color-text-primary-dark` | `#F9FAFB` |
| `--color-text-secondary-dark` | `#D1D5DB` |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-family-sans` | `Inter, system-ui, sans-serif` | Body text |
| `--font-family-mono` | `JetBrains Mono, monospace` | Code, terminal |
| `--font-size-xs` | `12px` | Captions |
| `--font-size-sm` | `14px` | Body small |
| `--font-size-base` | `16px` | Body default |
| `--font-size-lg` | `18px` | Subheadings |
| `--font-size-xl` | `20px` | Section headings |
| `--font-size-2xl` | `24px` | Page titles |
| `--font-weight-normal` | `400` | Body text |
| `--font-weight-medium` | `500` | Labels, emphasis |
| `--font-weight-semibold` | `600` | Headings |
| `--line-height-tight` | `1.25` | Headings |
| `--line-height-normal` | `1.5` | Body text |

### Spacing

| Token | Value |
|-------|-------|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-10` | `40px` |
| `--space-12` | `48px` |
| `--space-16` | `64px` |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Small elements |
| `--radius-md` | `6px` | Buttons, inputs |
| `--radius-lg` | `8px` | Cards |
| `--radius-xl` | `12px` | Modals |
| `--radius-full` | `9999px` | Badges, avatars |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards, dropdowns |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, popovers |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.12)` | High elevation |

### Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `150ms ease` | Hover states |
| `--transition-normal` | `200ms ease` | Default transitions |
| `--transition-slow` | `300ms ease` | Page transitions |

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | `0` | Default |
| `--z-dropdown` | `100` | Dropdowns |
| `--z-sticky` | `200` | Sticky headers |
| `--z-modal` | `300` | Modals |
| `--z-toast` | `400` | Notifications |

---

## Component Inventory

### Atoms

| Component | Description | States |
|-----------|-------------|--------|
| `Button` | Primary action trigger | default, hover, active, disabled, loading |
| `Input` | Text input field | default, focus, error, disabled |
| `Checkbox` | Boolean toggle | unchecked, checked, indeterminate, disabled |
| `Radio` | Single selection | unchecked, checked, disabled |
| `Toggle` | Switch control | off, on, disabled |
| `Badge` | Status indicator | default, success, warning, danger |
| `Icon` | SVG icon wrapper | Various icon types |
| `Avatar` | User/entity image | image, initials, placeholder |
| `Tag` | Categorical label | default, removable |
| `Tooltip` | Contextual help | top, right, bottom, left |

### Molecules

| Component | Description | Composition |
|-----------|-------------|-------------|
| `SearchBar` | Search input with icon | Icon + Input + Button |
| `FormField` | Labeled input group | Label + Input + HelpText |
| `Dropdown` | Selection menu | Button + Menu + MenuItem |
| `Tabs` | Content switcher | Tab[] + TabPanel[] |
| `Breadcrumb` | Navigation trail | BreadcrumbItem[] |
| `Pagination` | Page navigation | Prev + Page[] + Next |
| `Card` | Content container | Header + Body + Footer |
| `Alert` | Feedback message | Icon + Message + Close |
| `ProgressBar` | Progress indicator | Track + Fill + Label |
| `AvatarGroup` | Multiple avatars | Avatar[] + Overflow |

### Organisms

| Component | Description | Composition |
|-----------|-------------|-------------|
| `Sidebar` | Main navigation | Logo + NavItem[] + Footer |
| `Header` | Top bar | Logo + Search + Actions + UserMenu |
| `DataTable` | Data display | Header + Row[] + Pagination |
| `Modal` | Dialog overlay | Header + Body + Footer + Backdrop |
| `AgentCard` | Agent status display | Avatar + Name + Status + Metrics |
| `TaskList` | Task management | TaskItem[] + Filters + Actions |
| `LogViewer` | Log stream display | Filters + LogEntry[] + Controls |
| `StatusPanel` | System status | Metric[] + Chart + Actions |
| `SettingsForm` | Configuration | FormSection[] + Actions |
| `CommandPalette` | Quick actions | Search + Command[] |

### Templates

| Template | Description | Regions |
|----------|-------------|---------|
| `DashboardLayout` | Main app shell | Sidebar + Header + Content |
| `DetailLayout` | Entity detail view | Back + Header + Tabs + Content |
| `SettingsLayout` | Settings pages | Sidebar + Content + Actions |
| `EmptyState` | No data placeholder | Illustration + Text + Action |

---

## Page Layouts

### Window Dimensions

| Property | Value |
|----------|-------|
| Default width | `1280px` |
| Default height | `800px` |
| Min width | `960px` |
| Min height | `600px` |
| Title bar height | `32px` (frameless) |

### Grid System

- **Columns**: 12-column grid
- **Gutter**: `24px`
- **Margin**: `32px`
- **Breakpoints**: N/A (desktop only, fixed window)

### Page: Dashboard

```
+------------------------------------------+
| Header (64px)                            |
+--------+---------------------------------+
|        | Stats Bar (72px)                |
|        +---------------------------------+
| Side   |                                 |
| bar    | Agent Grid                      |
| (240px)| (flexible)                      |
|        |                                 |
|        +---------------------------------+
|        | Recent Activity (240px)         |
+--------+---------------------------------+
```

**Components**: Header, Sidebar, StatsBar, AgentGrid, ActivityFeed

### Page: Agent Detail

```
+------------------------------------------+
| Header (64px)                            |
+--------+---------------------------------+
|        | Breadcrumb (48px)               |
|        +---------------------------------+
| Side   | Agent Header (120px)            |
| bar    | [Avatar] [Name] [Status]        |
| (240px)+---------------------------------+
|        | Tabs (48px)                     |
|        +---------------------------------+
|        | Content                         |
|        | (flexible)                      |
+--------+---------------------------------+
```

**Components**: Header, Sidebar, Breadcrumb, AgentHeader, Tabs, Content

### Page: Tasks

```
+------------------------------------------+
| Header (64px)                            |
+--------+---------------------------------+
|        | Toolbar (56px)                  |
|        | [Search] [Filters] [Actions]    |
|        +---------------------------------+
| Side   |                                 |
| bar    | Task List                       |
| (240px)| (flexible)                      |
|        |                                 |
|        +---------------------------------+
|        | Pagination (48px)               |
+--------+---------------------------------+
```

**Components**: Header, Sidebar, Toolbar, TaskList, Pagination

### Page: Settings

```
+------------------------------------------+
| Header (64px)                            |
+--------+---------------------------------+
|        | Page Title (64px)               |
|        +---------------------------------+
| Side   | Settings Nav (200px)            |
| bar    |  +---------------------------+  |
| (240px)|  | Content                   |  |
|        |  | (flexible)                |  |
|        |  +---------------------------+  |
|        | [Save] [Cancel]                 |
+--------+---------------------------------+
```

**Components**: Header, Sidebar, PageTitle, SettingsNav, Form, Actions

### Page: Logs

```
+------------------------------------------+
| Header (64px)                            |
+--------+---------------------------------+
|        | Filter Bar (56px)               |
|        +---------------------------------+
| Side   |                                 |
| bar    | Log Stream                      |
| (240px)| (flexible, virtualized)         |
|        |                                 |
|        +---------------------------------+
|        | Status Bar (32px)               |
+--------+---------------------------------+
```

**Components**: Header, Sidebar, FilterBar, LogViewer, StatusBar

---

## Interaction Patterns

### Navigation

- **Primary**: Sidebar navigation, always visible
- **Secondary**: Tabs within pages
- **Tertiary**: Breadcrumbs for nested content

### State Management

- **Loading**: Skeleton screens, not spinners
- **Empty**: Illustration + CTA
- **Error**: Inline alerts with retry action
- **Success**: Toast notifications (auto-dismiss 3s)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + ,` | Open settings |
| `Cmd/Ctrl + N` | New agent |
| `Cmd/Ctrl + R` | Refresh current view |
| `Esc` | Close modal/dropdown |

### Responsive Behavior

Desktop-only application. Window resize triggers:
- Sidebar collapses to icons below `1024px` width
- Data table switches to card view below `960px` width
- Modal becomes full-screen below `640px` width

---

## Accessibility

- **Color contrast**: WCAG AA minimum (4.5:1 for text)
- **Focus indicators**: Visible focus ring on all interactive elements
- **Screen reader**: ARIA labels on all interactive components
- **Keyboard**: Full keyboard navigation support
- **Motion**: Respect `prefers-reduced-motion`

---

## Iconography

- **Library**: Lucide Icons (consistent, MIT licensed)
- **Sizes**: `16px` (inline), `20px` (default), `24px` (emphasis)
- **Stroke width**: `1.5px`
- **Color**: Current text color by default

---

## Illustrations

- **Style**: Minimal line art
- **Usage**: Empty states, onboarding, error pages
- **Color**: Muted, using brand palette

---

## Design Principles

1. **Clarity over density** - Prioritize readability and clear hierarchy
2. **Progressive disclosure** - Show essentials first, details on demand
3. **Consistent patterns** - Same problem, same solution
4. **Immediate feedback** - Every action has a visible response
5. **Accessible by default** - Design for all users from the start
