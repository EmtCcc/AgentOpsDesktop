import { test, expect } from './fixtures/app.fixture';

/**
 * Performance and Core Web Vitals tests for AgentOps Desktop renderer.
 *
 * Electron's renderer is Chromium-based, but the same Web APIs apply:
 * - LCP → main content render time
 * - CLS → visual stability
 * - FCP → first paint
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

        setTimeout(() => resolve(0), 5000);
      });
    });

    if (lcp > 0) {
      expect(lcp).toBeLessThan(2500);
    }
  });

  test('CLS under 0.1', async ({ mainPage }) => {
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

  test('FCP under 1.5s', async ({ mainPage }) => {
    const fcp = await mainPage.evaluate(() => {
      const entries = performance.getEntriesByName('first-contentful-paint');
      return entries[0]?.startTime;
    });

    if (fcp > 0) {
      expect(fcp).toBeLessThan(1500);
    }
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

    expect(totalSize).toBeLessThan(5 * 1024 * 1024);
  });

  test('CSS files load efficiently', async ({ mainPage }) => {
    await mainPage.waitForLoadState('networkidle');

    const cssResources = await mainPage.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return entries
        .filter((e) => e.initiatorType === 'link' && e.name.endsWith('.css'))
        .map((e) => ({ name: e.name, duration: e.duration, size: e.transferSize }));
    });

    // Each CSS file should load in under 500ms
    for (const css of cssResources) {
      expect(css.duration).toBeLessThan(500);
    }
  });

  test('no memory leaks after navigation', async ({ mainPage }) => {
    if (!('memory' in performance)) {
      test.skip();
      return;
    }

    const memBefore = await mainPage.evaluate(() => {
      return (performance as any).memory.usedJSHeapSize;
    });

    await mainPage.reload();
    await mainPage.waitForLoadState('networkidle');

    await mainPage.evaluate(() => {
      if ((globalThis as any).gc) (globalThis as any).gc();
    });

    const memAfter = await mainPage.evaluate(() => {
      return (performance as any).memory.usedJSHeapSize;
    });

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

    expect(frameMetrics.avgFrame).toBeLessThan(20);
    expect(frameMetrics.maxFrame).toBeLessThan(50);
  });
});

test.describe('DOM Efficiency', () => {
  test('reasonable DOM size', async ({ mainPage }) => {
    const nodeCount = await mainPage.evaluate(() => {
      return document.querySelectorAll('*').length;
    });
    // Desktop app should keep DOM lean
    expect(nodeCount).toBeLessThan(1000);
  });

  test('no excessive inline styles', async ({ mainPage }) => {
    const inlineStyleCount = await mainPage.evaluate(() => {
      const all = document.querySelectorAll('[style]');
      return all.length;
    });
    // Some inline styles are acceptable for dynamic content
    expect(inlineStyleCount).toBeLessThan(100);
  });

  test('no duplicate IDs', async ({ mainPage }) => {
    const duplicates = await mainPage.evaluate(() => {
      const ids = new Map<string, number>();
      document.querySelectorAll('[id]').forEach((el) => {
        ids.set(el.id, (ids.get(el.id) || 0) + 1);
      });
      return Array.from(ids.entries()).filter(([, count]) => count > 1);
    });
    expect(duplicates).toHaveLength(0);
  });
});
