# AgentOpsDesktop — Brand Identity Guidelines

> Version 2.0 · 2026-05-28

---

## 1. Brand Overview

**AgentOpsDesktop** is a desktop application for managing, monitoring, and orchestrating AI agent workflows. The brand conveys precision, reliability, and technical sophistication — a tool built for operators who demand clarity under complexity.

**Brand Personality:**
- Precise, not rigid
- Technical, not cold
- Confident, not loud
- Efficient, not minimal

**Tagline:** *Operational control for autonomous agents.*

**Design Direction:** Dark-mode-first. The application defaults to a dark theme (`#0D1117` background) — a cockpit instrument panel aesthetic. Light theme support is planned post-v1.

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

### Core Backgrounds (Dark Theme — Default)

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **bg-primary** | `#0D1117` | 13, 17, 23 | App background, main canvas |
| **bg-secondary** | `#161B22` | 22, 27, 34 | Panels, cards, sidebar |
| **bg-tertiary** | `#21262D` | 33, 38, 45 | Elevated surfaces, modals |

### Text

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **text-primary** | `#E6EDF3` | 230, 237, 243 | Headings, primary content |
| **text-secondary** | `#8B949E` | 139, 148, 158 | Descriptions, metadata |
| **text-tertiary** | `#484F58` | 72, 79, 88 | Disabled, placeholder |

### Accent / Semantic

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **Accent Blue** | `#58A6FF` | 88, 166, 255 | Links, focus rings, active states, primary actions |
| **Accent Blue Hover** | `#79C0FF` | 121, 192, 255 | Hover state for accent |
| **Success Green** | `#3FB950` | 63, 185, 80 | Agent healthy, task complete, positive indicators |
| **Warning Amber** | `#D29922` | 210, 153, 34 | Agent degraded, task queued, pending actions |
| **Critical Red** | `#F85149` | 248, 81, 73 | Agent offline, task failed, errors, destructive actions |
| **Info Blue** | `#58A6FF` | 88, 166, 255 | Logs, informational |

### Borders

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **border-default** | `#30363D` | 48, 54, 61 | Default borders, dividers |
| **border-subtle** | `#21262D` | 33, 38, 45 | Subtle separations |

### Agent Status Colors

| Status | Hex | Semantic |
|--------|-----|----------|
| Running | `#3FB950` | Agent actively executing |
| Idle | `#8B949E` | Agent waiting for work |
| Error | `#F85149` | Agent in fault state |
| Spawning | `#D29922` | Agent initializing |

### Light Theme Mapping (Planned — Post-v1)

| Dark Token | Light Token | Hex |
|------------|-------------|-----|
| `bg-primary` | `bg-primary-light` | `#FFFFFF` |
| `bg-secondary` | `bg-secondary-light` | `#F6F8FA` |
| `bg-tertiary` | `bg-tertiary-light` | `#F0F2F5` |
| `text-primary` | `text-primary-light` | `#1F2328` |
| `text-secondary` | `text-secondary-light` | `#656D76` |
| `border-default` | `border-default-light` | `#D0D7DE` |

### Color Accessibility

- All text/background combinations must meet WCAG 2.1 AA contrast ratio (4.5:1 for normal text, 3:1 for large text)
- Status colors (green/amber/red) must be distinguishable by shape or label in addition to color — never rely on color alone
- Dark theme background `#0D1117` with text `#E6EDF3` achieves 13.1:1 contrast ratio

---

## 4. Typography

### Font Stack

| Role | Font | Fallback |
|------|------|----------|
| **UI / Body** | Inter | system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif |
| **Monospace / Code** | JetBrains Mono | 'Fira Code', 'Cascadia Code', ui-monospace, SFMono-Regular, monospace |

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-xs` | 11 px | 400 | 16 px | Timestamps, badges |
| `text-sm` | 13 px | 400 | 20 px | Secondary text, metadata |
| `text-base` | 14 px | 400 | 22 px | Body text, list items |
| `text-lg` | 16 px | 600 | 24 px | Card titles, section headers |
| `text-xl` | 20 px | 600 | 28 px | Page titles |
| `text-2xl` | 24 px | 700 | 32 px | App title, hero text |

### Mono Scale (for logs / terminal)

| Token | Size | Usage |
|-------|------|-------|
| `text-mono-sm` | 12 px | Inline code, agent IDs |
| `text-mono-base` | 13 px | Log output, terminal |
| `text-mono-lg` | 15 px | Code blocks, highlighted output |

### Typography Rules

- **Sentence case** for headings and UI labels (not Title Case, not ALL CAPS)
- **Tabular numbers** (`font-variant-numeric: tabular-nums`) for numeric displays, agent counts, metrics
- Maximum line length: 80 characters for body text in panels
- Code blocks use JetBrains Mono with syntax highlighting via the editor theme

---

## 5. Iconography

### Icon Library

Use **Lucide** as the primary icon set. Consistent stroke-based icon set, MIT licensed.

### Icon Sizing

| Size | Stroke | Usage |
|------|--------|-------|
| 16 px | 1.5 px | Inline icons, toolbar buttons |
| 20 px | 1.5 px | Menu items, list items, default |
| 24 px | 1.5 px | Navigation, cards, emphasis |

### Icon Style Rules

- **Line icons only** — no filled variants in the default state
- Filled variants allowed for active/selected states (e.g., filled star for pinned items)
- Icons inherit color from `currentColor`
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

Base unit: **4 px**

| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0 | Reset |
| `space-1` | 4 px | Tight gaps (icon-to-label) |
| `space-2` | 8 px | Default intra-component gap |
| `space-3` | 12 px | Card padding (compact), default inner padding |
| `space-4` | 16 px | Card padding, section gaps, list item gaps |
| `space-5` | 20 px | Section gaps |
| `space-6` | 24 px | Panel padding, major sections |
| `space-8` | 32 px | Page margins, major dividers |
| `space-10` | 40 px | Page margins |
| `space-12` | 48 px | Hero sections, splash spacing, top-level layout gaps |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4 px | Badges, tags, small buttons |
| `radius-md` | 6 px | Cards, inputs, standard elements |
| `radius-lg` | 8 px | Modals, panels |
| `radius-full` | 9999 px | Avatars, status dots |

### Layout Grid

- Sidebar width: 240 px (collapsible to 48 px icon rail)
- Content area: fluid, min 480 px
- Maximum content width: 1200 px (centered)
- Panel border radius: 8 px (cards), 6 px (inputs), 4 px (small elements)
- 12-column grid with 24 px gutter, 32 px margin

### Window Dimensions

| Property | Value |
|----------|-------|
| Default width | 1280 px |
| Default height | 800 px |
| Min width | 960 px |
| Min height | 600 px |
| Title bar height | 32 px (frameless) |

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
- **Fast.** Transitions under 200 ms. No easing curves longer than 300 ms.
- **Interruptible.** Animations can be cancelled by user input. Never block interaction.
- **Respect `prefers-reduced-motion`.** Disable animations when the user prefers.

### Standard Durations

| Token | Duration | Usage |
|-------|----------|-------|
| `motion-fast` | 100 ms | Button press, toggle, hover states |
| `motion-normal` | 200 ms | Panel slide, fade, default transitions |
| `motion-slow` | 300 ms | Modal open, page transition |

### Easing

| Token | Curve | Usage |
|-------|-------|-------|
| `ease-out` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Entering elements |
| `ease-in` | `cubic-bezier(0.4, 0.0, 1, 1)` | Exiting elements |
| `ease-in-out` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Moving elements |

---

## 9. Audio Identity

### UI Sound Palette

AgentOpsDesktop uses subtle, functional audio cues. All sounds are short (< 300 ms), low-volume, and non-intrusive.

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
- Volume controlled independently from system audio
- Web Audio API preferred for procedural generation

---

## 10. Shadows / Elevation

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle lift, tooltips |
| `shadow-md` | `0 4px 8px rgba(0,0,0,0.4)` | Dropdowns, popovers |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | Modals, dialogs |

---

## 11. Brand Application

### App Icon

The app icon uses the primary "A" mark on an `Accent Blue` rounded-rectangle background. Follow platform guidelines:
- macOS: 1024×1024 PNG, no alpha, no rounded corners (system applies mask)
- Windows: 256×256 ICO with multiple sizes
- Linux: 512×512 PNG

### Splash Screen

- Background: `bg-primary` gradient
- Logo: Full lockup, centered
- Loading indicator: Indeterminate progress bar in `Accent Blue`
- No text other than the wordmark

### Documentation

- All docs use the neutral palette and typography scale defined here
- Code examples use JetBrains Mono with dark background (`bg-primary`)
- Screenshots should use the dark theme by default

---

## 12. File Naming

| Asset Type | Pattern | Example |
|------------|---------|---------|
| Logo icon | `logo-icon-{size}.png` | `logo-icon-256.png` |
| Logo lockup | `logo-lockup-{variant}.svg` | `logo-lockup-dark.svg` |
| Icon (custom) | `icon-{name}.svg` | `icon-agent.svg` |
| Sound effect | `sfx-{event}.ogg` | `sfx-task-complete.ogg` |
| Font | `{family}-{weight}.woff2` | `Inter-Regular.woff2` |

---

## 13. Usage Checklist

Before shipping any UI or content, verify:

- [ ] Colors from the defined palette only
- [ ] Fonts from the defined type stack only
- [ ] Icons from Lucide or matching custom set
- [ ] Text in sentence case
- [ ] Contrast ratios pass WCAG AA (4.5:1 for text, 3:1 for large text)
- [ ] Animations under 200 ms, functional only
- [ ] Sounds off by default, < 300 ms, consistent timbre
- [ ] Error messages follow [What] · [Why] · [What to do]
- [ ] Status conveyed through color AND iconography (never color alone)

---

## 14. Design Token Reference

All tokens are implemented as CSS custom properties. See `src/renderer/tokens.css` for the canonical implementation.

---

*This brand identity is the single source of truth for visual design decisions. The DESIGN-SYSTEM.md implements these tokens as CSS custom properties. Update this document first, then propagate to implementation.*
