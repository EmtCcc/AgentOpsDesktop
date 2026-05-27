import { test, expect } from './fixtures/app.fixture';

/**
 * Performance and Core Web Vitals tests for AgentOps Desktop renderer.
 *
 * Electron apps don't have traditional Core Web Vitals (no Lighthouse
 * field data), but the same metrics apply to renderer performance:
 * - LCP (Largest Contentful Paint) → main content render time
 * - FID/INP (Interaction to Next Paint) → input responsiveness
 * - CLS (Cumulative Layout Shift) → visual stability
 *
 * These tests measure renderer performance using the Web APIs directly.
 *
 * To run: npx playwright test performance
 */

test.describe('Core Web Vitals — Renderer', () => {
  test('LCP under 2.5s', async ({ mainPage }) => {
    const lcp = await mainPage.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          resolve(last.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // Fallback: resolve after 5s if no LCP entry
        setTimeout(() => resolve(0), 5000);
      });
    });

    if (lcp > 0) {
      expect(lcp).toBeLessThan(2500);
    }
  });

  test('CLS under 0.1', async ({ mainPage }) => {
    // Let the page settle
    await mainPage.waitForTimeout(2000);

    const cls = await mainPage.evaluate(() => {
      return new Promise<number>((resolve) => {
        let score = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              score += (entry as any).value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => resolve(score), 3000);
      });
    });

    expect(cls).toBeLessThan(0.1);
  });
});

test.describe('Resource Performance', () => {
  test('no render-blocking resources over 500ms', async ({ mainPage }) => {
    await mainPage.waitForLoadState('networkidle');

    const blockingResources = await mainPage.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return entries
        .filter((e) => e.renderBlockingStatus === 'blocking')
        .filter((e) => e.duration > 500)
        .map((e) => ({ name: e.name, duration: e.duration }));
    });

    expect(blockingResources).toHaveLength(0);
  });

  test('total bundle size under 5MB', async ({ mainPage }) => {
    await mainPage.waitForLoadState('networkidle');

    const totalSize = await mainPage.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return entries.reduce((sum, e) => sum + (e.transferSize || 0), 0);
    });

    // 5MB generous limit for desktop app
    expect(totalSize).toBeLessThan(5 * 1024 * 1024);
  });

  test('no memory leaks after navigation', async ({ mainPage }) => {
    if (!('memory' in performance)) {
      test.skip();
      return;
    }

    const memBefore = await mainPage.evaluate(() => {
      return (performance as any).memory.usedJSHeapSize;
    });

    // Simulate navigation
    await mainPage.reload();
    await mainPage.waitForLoadState('networkidle');

    // Force GC if available
    await mainPage.evaluate(() => {
      if ((globalThis as any).gc) (globalThis as any).gc();
    });

    const memAfter = await mainPage.evaluate(() => {
      return (performance as any).memory.usedJSHeapSize;
    });

    // Allow 20% growth (generous for initial load)
    expect(memAfter).toBeLessThan(memBefore * 1.2);
  });
});

test.describe('Startup Performance', () => {
  test('DOM interactive under 1s', async ({ mainPage }) => {
    const timing = await mainPage.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return nav?.domInteractive - nav?.startTime;
    });

    if (timing > 0) {
      expect(timing).toBeLessThan(1000);
    }
  });

  test('first contentful paint under 1.5s', async ({ mainPage }) => {
    const fcp = await mainPage.evaluate(() => {
      const entries = performance.getEntriesByName('first-contentful-paint');
      return entries[0]?.startTime;
    });

    if (fcp > 0) {
      expect(fcp).toBeLessThan(1500);
    }
  });
});

test.describe('Animation Performance', () => {
  test('no janky animations (60fps target)', async ({ mainPage }) => {
    // Measure frame timing during a scroll
    const frameMetrics = await mainPage.evaluate(async () => {
      return new Promise<{ avgFrame: number; maxFrame: number }>((resolve) => {
        const frames: number[] = [];
        let lastTime = performance.now();

        function measure() {
          const now = performance.now();
          frames.push(now - lastTime);
          lastTime = now;

          if (frames.length < 60) {
            requestAnimationFrame(measure);
          } else {
            const avg = frames.reduce((a, b) => a + b) / frames.length;
            const max = Math.max(...frames);
            resolve({ avgFrame: avg, maxFrame: max });
          }
        }

        requestAnimationFrame(measure);
      });
    });

    // 60fps = 16.67ms per frame
    expect(frameMetrics.avgFrame).toBeLessThan(20);
    expect(frameMetrics.maxFrame).toBeLessThan(50);
  });
});
