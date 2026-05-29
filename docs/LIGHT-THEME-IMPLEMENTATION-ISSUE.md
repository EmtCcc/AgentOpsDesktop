# Implementation Issue: Light Theme Toggle

> Create this issue via `POST /api/companies/{companyId}/issues` when API is available.

## Title

Implement light theme toggle and CSS token refactor

## Description

### Summary

Implement user-selectable light/dark theme switching based on the design spec in `docs/LIGHT-THEME-SPEC.md`.

### Requirements

#### 1. Theme Initialization (index.html)

- Add inline `<script>` in `<head>` to read `localStorage("agentops-theme")` and set `data-theme` attribute on `<html>` before first paint
- Default to `"system"` if no stored preference
- For `"system"` mode, detect `prefers-color-scheme` and set `data-theme` to resolved value

#### 2. CSS Token Refactor (tokens.css)

- Replace `@media (prefers-color-scheme: dark)` with `[data-theme="dark"]` selector for explicit dark mode
- Add `[data-theme="light"]` selector with light theme values
- Add `[data-theme="system"]` block that uses `@media (prefers-color-scheme: dark)` for system detection
- Preserve all existing token names and values

#### 3. Theme Toggle UI (SettingsPage.jsx)

- Add "Appearance" section after "General" in settings
- Implement segmented control with three options: Light (sun icon), Dark (moon icon), System (monitor icon)
- Use Lucide icon SVGs for each segment
- On change: update `data-theme` attribute, persist to `localStorage`
- Add `role="radiogroup"` and `role="radio"` for accessibility
- Keyboard navigation: Arrow keys, Enter/Space

#### 4. Logo Switching

- Header logo should use `designs/logo.svg` in light mode and `designs/logo-dark.svg` in dark mode
- CSS approach: `[data-theme="light"] .header__logo` and `[data-theme="dark"] .header__logo`

#### 5. Transition Animation

- Add `transition: background-color 200ms ease, color 200ms ease` to body and major containers
- Prevent FOUC by setting theme before first paint

### Acceptance Criteria

- [ ] User can switch between Light, Dark, and System theme in Settings
- [ ] Theme persists across app restarts (localStorage)
- [ ] All screens (dashboard, agent list, task board, settings) render correctly in light mode
- [ ] No flash of unstyled content on page load
- [ ] Logo switches between light/dark variants
- [ ] Segmented control is keyboard accessible

### Design Reference

See `docs/LIGHT-THEME-SPEC.md` for complete token values and UI specifications.

### Priority

Medium — v0.2 deliverable per ROADMAP.md

## Labels

- `ui`
- `design-system`
- `implementation`

## Assignee

Engineer agent
