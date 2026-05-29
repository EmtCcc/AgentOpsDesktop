# System Tray Integration (Electron Tray)

> Issue: CMPAAA-354 | Priority: P1 | Effort: S | Pillar: UI
> Status: Specification | Last updated: 2026-05-29

## Overview

Add native system tray integration to AgentOps Desktop using Electron's `Tray` API. Provides minimize-to-tray behavior, dynamic agent status icons, and a quick actions context menu.

**Competitive gap**: Golutra (Tauri) has native tray integration; AgentOps currently lacks this desktop-native affordance.

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│  Main Process                                           │
│                                                         │
│  ┌───────────────┐     ┌─────────────────────────────┐  │
│  │  TrayManager   │────▶│  NotificationService        │  │
│  │  (new module)  │     │  (existing - event source)  │  │
│  └───────┬───────┘     └─────────────────────────────┘  │
│          │                                              │
│          ▼                                              │
│  ┌───────────────┐     ┌─────────────────────────────┐  │
│  │  Electron Tray │     │  AgentRuntime               │  │
│  │  + Menu        │     │  (existing - status source) │  │
│  └───────────────┘     └─────────────────────────────┘  │
│                                                         │
│          ▲ IPC                                          │
│          │                                              │
│  ┌───────┴───────┐                                      │
│  │  Preload       │                                      │
│  │  (tray:*)      │                                      │
│  └───────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

### Module: `src/main/tray-manager.js`

New module responsible for all tray lifecycle management.

```js
// TrayManager responsibilities:
// - Create/update/destroy Tray instance
// - Build context menu (static items + dynamic agent status)
// - Handle minimize-to-tray on window close
// - Expose IPC channels for renderer control
// - Aggregate agent status into icon state
```

---

## Tray Icon States

| State | Icon | Condition | Color Accent |
|-------|------|-----------|--------------|
| **Idle** | `tray-idle` | 0 agents running | Neutral (gray) |
| **Active** | `tray-active` | ≥1 agent running, no errors | Green |
| **Busy** | `tray-busy` | ≥1 agent at high utilization (>80% budget) | Yellow |
| **Error** | `tray-error` | ≥1 agent in error state | Red |

Icons should be provided at 16x16 and 32x32 (for Retina) in `.png` format for cross-platform compatibility. On macOS, template images (monochrome) are preferred.

**File locations**:
```
src/main/assets/tray/
├── tray-idleTemplate.png       # macOS template (16x16, @2x)
├── tray-idle.png               # Windows/Linux
├── tray-activeTemplate.png
├── tray-active.png
├── tray-busyTemplate.png
├── tray-busy.png
├── tray-errorTemplate.png
└── tray-error.png
```

---

## Context Menu Structure

```
┌─────────────────────────────────────┐
│  AgentOps Desktop                   │
│─────────────────────────────────────│
│  ▶ Agent Status                     │  ── Submenu: per-agent list
│     • Claude Code  ● running        │
│     • Codex        ○ idle           │
│─────────────────────────────────────│
│  ➕ New Task                        │  ── Opens task creation modal
│  📋 Show Window                     │  ── Restores from tray
│─────────────────────────────────────│
│  ⚙  Settings                       │  ── Opens settings page
│  🔄 Check for Updates              │  ── Triggers updater check
│─────────────────────────────────────│
│  ❌ Quit                            │  ── app.quit()
└─────────────────────────────────────┘
```

**Dynamic items**:
- "Agent Status" submenu rebuilds on each `agent:status-change` event
- Active agents shown with green bullet, idle with gray, error with red
- Click an agent → opens window and navigates to that agent's detail page

---

## IPC API

### Renderer → Main (Preload)

| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `tray:getStatus` | invoke | → `{ visible: bool, iconState: string, agentCount: number }` | Query current tray state |
| `tray:setMinimizeToTray` | invoke | `{ enabled: bool }` | Toggle minimize-to-tray behavior |
| `tray:getMinimizeToTray` | invoke | → `{ enabled: bool }` | Read minimize-to-tray setting |

### Main → Renderer (Events via `webContents.send`)

| Channel | Payload | Trigger |
|---------|---------|---------|
| `tray:agentStatusChanged` | `{ agents: Array<{id, name, status}> }` | Agent starts/stops/errors |
| `tray:iconStateChanged` | `{ state: string }` | Icon visual state changes |

### Implementation in `preload.js`

```js
// Add to contextBridge.exposeInMainWorld('electronAPI', { ... })
tray: {
  getStatus: () => ipcRenderer.invoke('tray:getStatus'),
  setMinimizeToTray: (enabled) => ipcRenderer.invoke('tray:setMinimizeToTray', enabled),
  getMinimizeToTray: () => ipcRenderer.invoke('tray:getMinimizeToTray'),
  onAgentStatusChanged: (cb) => ipcRenderer.on('tray:agentStatusChanged', (_e, data) => cb(data)),
  onIconStateChanged: (cb) => ipcRenderer.on('tray:iconStateChanged', (_e, data) => cb(data)),
}
```

---

## Minimize-to-Tray Behavior

When `minimizeToTray` is enabled (persisted in settings store):

1. User clicks close button → window hides (`mainWindow.hide()`) instead of closing
2. App remains running in tray
3. Click tray icon or "Show Window" menu → `mainWindow.show()`
4. macOS: clicking dock icon also restores window
5. "Quit" menu item or `Cmd+Q`/`Ctrl+Q` → actual `app.quit()`

**Setting persistence**: Store `minimizeToTray: boolean` in existing `settings` repository.

---

## Integration Points

### With `NotificationService` (existing)

- Subscribe to `agent:status-change` events
- Tray icon state derives from aggregated agent statuses
- Tray notifications can supplement (not replace) OS notifications

### With `AgentRuntime` (existing)

- Query `runtime.getRunningAgents()` for initial status on tray creation
- Subscribe to runtime events for status updates

### With `updater.js` (existing)

- "Check for Updates" menu item calls `updater.checkForUpdates()`
- Update download progress can be shown in tooltip

### With Settings (existing)

- `minimizeToTray` setting stored in `settings` table
- Settings UI exposes toggle for minimize-to-tray

---

## Platform Considerations

### macOS
- Use `Template` image suffix for automatic dark/light mode adaptation
- App is expected in menu bar; dock icon remains visible
- `app.dock.hide()` only if user explicitly wants dock-less mode

### Windows
- Tray icon appears in system notification area
- Balloon notifications supported via `tray.displayBalloon()`
- Single click shows window; right-click shows menu

### Linux
- Tray support varies by desktop environment
- `appIndicator` fallback for GNOME/KDE
- May require `libappindicator1` on some systems

---

## Implementation Checklist

- [ ] Create `src/main/tray-manager.js` module
- [ ] Create tray icon assets (16x16, @2x, template variants)
- [ ] Wire `TrayManager` into `src/main/index.js` app lifecycle
- [ ] Register IPC handlers in `src/main/ipc/index.js`
- [ ] Add preload bindings for tray channels
- [ ] Implement minimize-to-tray window close interception
- [ ] Build dynamic context menu with agent status
- [ ] Persist `minimizeToTray` setting
- [ ] Add tray toggle to Settings page UI
- [ ] Test on macOS, Windows, Linux

---

## Code Sketch: `tray-manager.js`

```js
const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const logger = require('./logger');

class TrayManager {
  constructor({ mainWindow, runtime, settingsRepo, notificationService }) {
    this.mainWindow = mainWindow;
    this.runtime = runtime;
    this.settingsRepo = settingsRepo;
    this.notificationService = notificationService;
    this.tray = null;
    this.minimizeToTray = settingsRepo.get('minimizeToTray') ?? true;
    this.agentStatuses = [];
    this.iconState = 'idle';
  }

  init() {
    this.tray = new Tray(this._getIconPath('idle'));
    this.tray.setToolTip('AgentOps Desktop');

    this.tray.on('click', () => this._toggleWindow());
    this.tray.on('double-click', () => this._showWindow());

    this._buildMenu();
    this._setupCloseInterceptor();
    this._subscribeToEvents();

    logger.info('tray.initialized', { minimizeToTray: this.minimizeToTray });
  }

  _getIconPath(state) {
    const suffix = process.platform === 'darwin' ? 'Template' : '';
    return path.join(__dirname, 'assets', 'tray', `tray-${state}${suffix}.png`);
  }

  _buildMenu() {
    const template = [
      { label: 'AgentOps Desktop', enabled: false },
      { type: 'separator' },
      {
        label: 'Agent Status',
        submenu: this._buildAgentSubmenu(),
      },
      { type: 'separator' },
      {
        label: 'New Task',
        click: () => { this._showWindow(); /* navigate to task creation */ },
      },
      {
        label: 'Show Window',
        click: () => this._showWindow(),
      },
      { type: 'separator' },
      { label: 'Settings', click: () => { this._showWindow(); /* navigate to settings */ } },
      { label: 'Check for Updates', click: () => { /* updater.checkForUpdates() */ } },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ];

    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  _buildAgentSubmenu() {
    if (this.agentStatuses.length === 0) {
      return [{ label: 'No agents running', enabled: false }];
    }
    return this.agentStatuses.map((agent) => ({
      label: `${agent.name}  ${this._statusSymbol(agent.status)}`,
      click: () => { this._showWindow(); /* navigate to agent */ },
    }));
  }

  _statusSymbol(status) {
    return { running: '●', idle: '○', error: '✕' }[status] || '○';
  }

  _setupCloseInterceptor() {
    this.mainWindow.on('close', (e) => {
      if (this.minimizeToTray && !app.isQuitting) {
        e.preventDefault();
        this.mainWindow.hide();
      }
    });
  }

  _subscribeToEvents() {
    // Subscribe to agent status changes from runtime
    this.runtime.on('agent:status-change', (data) => {
      this.agentStatuses = data.agents || [];
      this._updateIconState();
      this._buildMenu();
      this.mainWindow.webContents.send('tray:agentStatusChanged', { agents: this.agentStatuses });
    });
  }

  _updateIconState() {
    const hasError = this.agentStatuses.some((a) => a.status === 'error');
    const hasBusy = this.agentStatuses.some((a) => a.utilization > 0.8);
    const hasActive = this.agentStatuses.some((a) => a.status === 'running');

    const newState = hasError ? 'error' : hasBusy ? 'busy' : hasActive ? 'active' : 'idle';
    if (newState !== this.iconState) {
      this.iconState = newState;
      this.tray.setImage(this._getIconPath(newState));
      this.tray.setToolTip(`AgentOps Desktop — ${this.agentStatuses.length} agent(s)`);
      this.mainWindow.webContents.send('tray:iconStateChanged', { state: newState });
    }
  }

  _showWindow() {
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  _toggleWindow() {
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this._showWindow();
    }
  }

  setMinimizeToTray(enabled) {
    this.minimizeToTray = enabled;
    this.settingsRepo.set('minimizeToTray', enabled);
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = { TrayManager };
```

---

## References

- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray)
- [Electron Menu API](https://www.electronjs.org/docs/latest/api/menu)
- Competitive analysis: `docs/phase3-competitive-analysis.md` (Golutra tray capabilities)
- Phase 3 roadmap: `docs/phase3-roadmap.md` (CMPAAA-354)
