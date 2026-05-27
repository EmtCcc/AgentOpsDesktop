# AgentOpsDesktop — Brand Identity Guidelines

> Version 1.0 · 2026-05-28

---

## 1. Brand Overview

**AgentOpsDesktop** is a desktop application for managing, monitoring, and orchestrating AI agent workflows. The brand conveys precision, reliability, and technical sophistication — a tool built for operators who demand clarity under complexity.

**Brand Personality:**
- Precise, not rigid
- Technical, not cold
- Confident, not loud
- Efficient, not minimal

---

## 2. Logo

### Primary Mark

The logo combines a stylized "A" with a node-graph motif, symbolizing agent orchestration. The mark stands alone at small sizes and pairs with the wordmark at larger scales.

### Logo Variants

| Variant | Usage |
|---------|-------|
| **Full lockup** (icon + wordmark) | Splash screens, about dialog, marketing |
| **Icon only** | App icon, taskbar, favicons, toolbar |
| **Wordmark only** | Documentation headers, email signatures |

### Clear Space

Maintain a minimum clear space equal to the height of the "A" icon on all sides. No text, borders, or graphic elements may encroach on this zone.

### Minimum Size

- Icon: 16×16 px (digital), 10 mm (print)
- Full lockup: 120 px wide (digital), 50 mm (print)

### Logo Don'ts

- Do not stretch, skew, or rotate the logo
- Do not alter the logo colors outside the approved palette
- Do not place the logo on busy or low-contrast backgrounds without a backing shape
- Do not add drop shadows, bevels, or outlines
- Do not rearrange the icon/wordmark relationship

---

## 3. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Ops Blue** | `#2563EB` | 37, 99, 235 | Primary actions, active states, links |
| **Deep Slate** | `#0F172A` | 15, 23, 42 | Backgrounds, primary text |
| **Clean White** | `#F8FAFC` | 248, 250, 252 | Surfaces, cards, input fields |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Node Green** | `#10B981` | 16, 185, 129 | Success states, active agents, healthy status |
| **Alert Amber** | `#F59E0B` | 245, 158, 11 | Warnings, degraded status, pending actions |
| **Critical Red** | `#EF4444` | 239, 68, 68 | Errors, failed states, destructive actions |
| **Idle Gray** | `#64748B` | 100, 116, 139 | Inactive states, secondary text, placeholders |

### Neutral Scale

| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-50` | `#F8FAFC` | Page background |
| `neutral-100` | `#F1F5F9` | Card background |
| `neutral-200` | `#E2E8F0` | Borders, dividers |
| `neutral-300` | `#CBD5E1` | Disabled text |
| `neutral-500` | `#64748B` | Secondary text |
| `neutral-700` | `#334155` | Primary text (light mode) |
| `neutral-900` | `#0F172A` | Primary text (dark mode) |

### Dark Mode Mapping

| Light Mode | Dark Mode |
|------------|-----------|
| `#F8FAFC` (surface) | `#0F172A` |
| `#0F172A` (text) | `#F8FAFC` |
| `#E2E8F0` (border) | `#334155` |
| `#2563EB` (primary) | `#3B82F6` |

### Color Accessibility

- All text/background combinations must meet WCAG 2.1 AA contrast ratio (4.5:1 for normal text, 3:1 for large text)
- Status colors (green/amber/red) must be distinguishable by shape or label in addition to color — never rely on color alone

---

## 4. Typography

### Font Stack

| Role | Font | Fallback |
|------|------|----------|
| **UI / Body** | Inter | system-ui, -apple-system, sans-serif |
| **Monospace / Code** | JetBrains Mono | ui-monospace, SFMono-Regular, monospace |

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 30 px | 700 | 1.2 | Splash, onboarding headings |
| `heading-1` | 24 px | 600 | 1.3 | Page titles |
| `heading-2` | 20 px | 600 | 1.35 | Section headings |
| `heading-3` | 16 px | 600 | 1.4 | Subsection headings |
| `body` | 14 px | 400 | 1.5 | Default body text |
| `body-sm` | 13 px | 400 | 1.5 | Secondary body, descriptions |
| `caption` | 12 px | 400 | 1.4 | Labels, timestamps, metadata |
| `code` | 13 px | 400 | 1.6 | Code blocks, terminal output |

### Typography Rules

- **Sentence case** for headings and UI labels (not Title Case, not ALL CAPS)
- **Tabular numbers** (`font-variant-numeric: tabular-nums`) for numeric displays, agent counts, metrics
- Maximum line length: 80 characters for body text in panels
- Code blocks use JetBrains Mono with syntax highlighting via the editor theme

---

## 5. Iconography

### Icon Library

Use **Lucide** as the primary icon set. Icons are 24×24 px by default with 1.5 px stroke weight.

### Icon Sizing

| Size | Stroke | Usage |
|------|--------|-------|
| 16 px | 1.5 px | Inline icons, toolbar buttons |
| 20 px | 1.5 px | Menu items, list items |
| 24 px | 1.5 px | Default, navigation, cards |
| 32 px | 2 px | Empty states, feature callouts |

### Icon Style Rules

- **Line icons only** — no filled variants in the default state
- Filled variants allowed for active/selected states (e.g., filled star for pinned items)
- Consistent 2 px padding within the icon grid
- Icons should be recognizable at 16 px — avoid excessive detail
- Custom icons must match Lucide's stroke weight, corner radius, and optical size

### Key Icon Mapping

| Concept | Icon |
|---------|------|
| Agent | `bot` |
| Task | `list-checks` |
| Workflow | `git-branch` |
| Settings | `settings` |
| Alert | `alert-triangle` |
| Success | `check-circle` |
| Error | `x-circle` |
| Terminal | `terminal` |
| Metrics | `bar-chart-3` |
| Deploy | `rocket` |

---

## 6. Spacing & Layout

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4 px | Tight gaps (icon-to-label) |
| `space-2` | 8 px | Default intra-component gap |
| `space-3` | 12 px | Card padding (compact) |
| `space-4` | 16 px | Card padding, section gaps |
| `space-6` | 24 px | Panel padding, major sections |
| `space-8` | 32 px | Page margins, major dividers |
| `space-12` | 48 px | Hero sections, splash spacing |

### Layout Grid

- Sidebar width: 240 px (collapsible to 56 px icon rail)
- Content area: fluid, min 480 px
- Maximum content width: 1200 px (centered)
- Panel border radius: 8 px (cards), 6 px (inputs), 4 px (small elements)

---

## 7. Tone of Voice

### Principles

1. **Operator-first.** Write for people who run systems, not browse them. Be direct. Respect their time.
2. **Precise over polite.** "Connection failed: timeout after 30s" beats "Oops, something went wrong!"
3. **Show, don't explain.** Prefer a clear UI label over a tooltip over a paragraph. If the interface needs a wall of text, the design is wrong.
4. **Status, not sentiment.** Report what happened and what to do next. Avoid emotional language ("exciting!", "we're sorry").

### Voice Examples

| Scenario | Do | Don't |
|----------|----|-------|
| Agent started | "Agent `gpt-4-planner` running" | "Your agent is now running! 🎉" |
| Task failed | "Task failed: rate limit exceeded. Retry in 60s." | "Oh no! Something went wrong. Please try again." |
| Empty state | "No agents configured. Add one to get started." | "It looks like you haven't created any agents yet! Let's fix that together." |
| Confirmation | "Delete 3 workflows? This cannot be undone." | "Are you absolutely sure you want to delete these workflows? This is a permanent action and we won't be able to recover them." |

### Writing Rules

- **Active voice.** "Agent completed the task" not "The task was completed by the agent"
- **Present tense.** "Agent starts" not "Agent will start"
- **Second person sparingly.** Use "you" for instructions ("Configure your agent"), not for status ("Your agent is running")
- **No jargon in UI.** Technical terms are fine in docs and logs, but UI labels should be accessible
- **Sentence case everywhere.** Buttons, headings, menu items — all sentence case

### Error Messages

Follow the pattern: **[What happened] · [Why] · [What to do]**

```
Deploy failed: Docker daemon not running.
Start Docker Desktop and retry.
```

```
Cannot delete agent: 2 active tasks depend on it.
Complete or cancel the tasks first.
```

---

## 8. Motion & Interaction

### Animation Principles

- **Functional only.** Every animation must communicate state change or spatial relationship. No decorative motion.
- **Fast.** Transitions under 200ms. No easing curves longer than 300ms.
- **Interruptible.** Animations can be cancelled by user input. Never block interaction.

### Standard Durations

| Token | Duration | Usage |
|-------|----------|-------|
| `duration-fast` | 100 ms | Button press, toggle |
| `duration-normal` | 150 ms | Panel slide, fade |
| `duration-slow` | 250 ms | Modal open, page transition |

### Easing

| Token | Curve | Usage |
|-------|-------|-------|
| `ease-out` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Entering elements |
| `ease-in` | `cubic-bezier(0.4, 0.0, 1, 1)` | Exiting elements |
| `ease-in-out` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Moving elements |

---

## 9. Audio Identity

### UI Sound Palette

AgentOpsDesktop uses subtle, functional audio cues. All sounds are short (< 300ms), low-volume, and non-intrusive.

| Event | Sound Character | Notes |
|-------|-----------------|-------|
| Agent started | Soft ascending tone | Confirmation without fanfare |
| Task completed | Brief double-tick | Like a mechanical switch |
| Error / failure | Low descending tone | Attention without alarm |
| Notification | Single soft chime | Neutral, non-urgent |
| Deploy success | Clean ping | Satisfying but restrained |

### Audio Rules

- All UI sounds are **opt-in** — off by default
- Sounds must work at low volume (laptop speakers, headphones)
- No looping sounds, no background music in the application
- Sound effects should use a consistent tonal palette — avoid mixing synthetic and organic timbres

---

## 10. Brand Application

### App Icon

The app icon uses the primary "A" mark on an `Ops Blue` rounded-rectangle background. Follow platform guidelines:
- macOS: 1024×1024 PNG, no alpha, no rounded corners (system applies mask)
- Windows: 256×256 ICO with multiple sizes
- Linux: 512×512 PNG

### Splash Screen

- Background: `Deep Slate` gradient
- Logo: Full lockup, centered
- Loading indicator: Indeterminate progress bar in `Ops Blue`
- No text other than the wordmark

### Documentation

- All docs use the neutral palette and typography scale defined here
- Code examples use JetBrains Mono with dark background (`Deep Slate`)
- Screenshots should use the light theme by default; include dark variant when illustrating theme support

---

## 11. File Naming

| Asset Type | Pattern | Example |
|------------|---------|---------|
| Logo icon | `logo-icon-{size}.png` | `logo-icon-256.png` |
| Logo lockup | `logo-lockup-{variant}.svg` | `logo-lockup-dark.svg` |
| Icon (custom) | `icon-{name}.svg` | `icon-agent.svg` |
| Sound effect | `sfx-{event}.ogg` | `sfx-task-complete.ogg` |
| Font | `{family}-{weight}.woff2` | `Inter-Regular.woff2` |

---

## 12. Usage Checklist

Before shipping any UI or content, verify:

- [ ] Colors from the defined palette only
- [ ] Fonts from the defined type stack only
- [ ] Icons from Lucide or matching custom set
- [ ] Text in sentence case
- [ ] Contrast ratios pass WCAG AA
- [ ] Animations under 200ms, functional only
- [ ] Sounds off by default, < 300ms, consistent timbre
- [ ] Error messages follow [What] · [Why] · [What to do]
