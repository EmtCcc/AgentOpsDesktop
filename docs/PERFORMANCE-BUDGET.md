# Performance Budget — AgentOps Desktop

## Context

AgentOps Desktop is an Electron application. The renderer process runs on Chromium, so traditional browser-engine cross-testing doesn't apply the same way as web apps. However:

1. **Renderer HTML/CSS** is tested across Chromium, Firefox, and WebKit via Playwright to catch layout regressions early — relevant if the renderer is ever ported to a web client or embedded in another shell.
2. **Core Web Vitals** apply to the renderer's DOM performance even though it's not a web page.
3. **Desktop-specific metrics** (startup time, memory, IPC latency) matter more than typical web metrics.

---

## Core Web Vitals Budgets (Renderer)

| Metric | Good | Needs Improvement | Poor | Source |
|--------|------|-------------------|------|--------|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5s – 4.0s | > 4.0s | Web Vitals |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1 – 0.25 | > 0.25 | Web Vitals |
| FCP (First Contentful Paint) | < 1.5s | 1.5s – 3.0s | > 3.0s | Web Vitals |

## Renderer Performance Budgets

| Metric | Target | Rationale |
|--------|--------|-----------|
| DOM Interactive | < 1s | Fast initial shell render |
| FCP | < 1.5s | Content visible quickly |
| Total bundle size | < 5MB | Desktop app, generous limit |
| Render-blocking resources | < 500ms each | No waterfall stalls |
| Frame rate (animations) | 60fps (16.67ms/frame) | Smooth interactions |
| Memory (idle) | < 200MB | Reasonable for Electron |
| Memory growth after navigation | < 20% | No memory leaks |

## Desktop-Specific Budgets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Cold start to window visible | < 3s | Perceived startup speed |
| Window visible to interactive | < 1.5s | Time to first click |
| IPC round-trip (main↔renderer) | < 5ms | Responsive agent communication |
| Agent log stream latency | < 100ms | Real-time monitoring feel |
| SQLite query (p95) | < 50ms | Task board responsiveness |

## Viewport Testing Matrix

| Viewport | Width | Height | Device |
|----------|-------|--------|--------|
| Desktop default | 1440 | 900 | Standard monitor |
| Minimum width | 960 | 800 | Design system breakpoint |
| Sidebar collapsed | < 960 | any | Responsive state |
| High-DPI | 2880 | 1800 | Retina MacBook Pro |

## Browser Engine Testing (Renderer)

| Engine | Device | Purpose |
|--------|--------|---------|
| Chromium | Desktop Chrome | Primary (matches Electron) |
| Firefox | Desktop Firefox | CSS/layout compatibility |
| WebKit | Desktop Safari | CSS/layout compatibility |
| Chromium | Pixel 5 | Mobile viewport layout |
| WebKit | iPhone 13 | Mobile viewport layout |

---

## How to Run

```bash
# All E2E tests (cross-browser + performance)
npm run test:e2e

# Specific engines
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
npm run test:e2e:mobile

# Performance only
npm run test:perf

# Cross-browser compatibility only
npm run test:cross-browser

# View HTML report
npm run test:report
```

---

*This is a living document. Update budgets as the application matures.*
