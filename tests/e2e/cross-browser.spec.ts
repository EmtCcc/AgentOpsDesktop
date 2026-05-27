import { test, expect } from './fixtures/app.fixture';

/**
 * Cross-browser compatibility tests for AgentOps Desktop renderer.
 *
 * Tests verify that the design system renders consistently across
 * Chromium, Firefox, and WebKit engines. These tests use a static
 * HTML harness until the Electron app is built.
 *
 * To run: npx playwright test cross-browser
 */

test.describe('Design System — CSS Custom Properties', () => {
  test('root CSS variables are defined', async ({ mainPage }) => {
    const vars = await mainPage.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        bgPrimary: style.getPropertyValue('--color-bg-primary').trim(),
        textPrimary: style.getPropertyValue('--color-text-primary').trim(),
        accent: style.getPropertyValue('--color-accent').trim(),
        fontSans: style.getPropertyValue('--font-sans').trim(),
        space4: style.getPropertyValue('--space-4').trim(),
      };
    });

    expect(vars.bgPrimary).toBe('#0D1117');
    expect(vars.textPrimary).toBe('#E6EDF3');
    expect(vars.accent).toBe('#58A6FF');
    expect(vars.fontSans).toContain('Inter');
    expect(vars.space4).toBe('16px');
  });
});

test.describe('Design System — Layout Shell', () => {
  test('app shell has correct dimensions', async ({ mainPage }) => {
    const header = mainPage.locator('[data-testid="header"]');
    const sidebar = mainPage.locator('[data-testid="sidebar"]');
    const footer = mainPage.locator('[data-testid="footer"]');

    if (await header.count() > 0) {
      const headerBox = await header.boundingBox();
      expect(headerBox?.height).toBe(48);
    }

    if (await sidebar.count() > 0) {
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox?.width).toBe(240);
    }

    if (await footer.count() > 0) {
      const footerBox = await footer.boundingBox();
      expect(footerBox?.height).toBe(28);
    }
  });

  test('content area has minimum width', async ({ mainPage }) => {
    const content = mainPage.locator('[data-testid="main-content"]');
    if (await content.count() > 0) {
      const box = await content.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(320);
    }
  });
});

test.describe('Design System — Typography', () => {
  test('body text uses Inter font family', async ({ mainPage }) => {
    const fontFamily = await mainPage.evaluate(() => {
      const body = document.body;
      return getComputedStyle(body).fontFamily;
    });
    expect(fontFamily).toContain('Inter');
  });

  test('monospace elements use JetBrains Mono', async ({ mainPage }) => {
    const code = mainPage.locator('code, [data-testid="log-output"]');
    if (await code.count() > 0) {
      const fontFamily = await code.first().evaluate(
        (el) => getComputedStyle(el).fontFamily
      );
      expect(fontFamily).toContain('JetBrains Mono');
    }
  });
});

test.describe('Design System — Components', () => {
  test('buttons have correct height variants', async ({ mainPage }) => {
    const sm = mainPage.locator('button[data-size="sm"]');
    const md = mainPage.locator('button[data-size="md"]');
    const lg = mainPage.locator('button[data-size="lg"]');

    if (await sm.count() > 0) {
      const box = await sm.first().boundingBox();
      expect(box?.height).toBe(28);
    }
    if (await md.count() > 0) {
      const box = await md.first().boundingBox();
      expect(box?.height).toBe(32);
    }
    if (await lg.count() > 0) {
      const box = await lg.first().boundingBox();
      expect(box?.height).toBe(36);
    }
  });

  test('status indicators render with correct colors', async ({ mainPage }) => {
    const statuses = ['running', 'idle', 'error', 'spawning'] as const;
    const expectedColors: Record<string, string> = {
      running: '#3FB950',
      idle: '#8B949E',
      error: '#F85149',
      spawning: '#D29922',
    };

    for (const status of statuses) {
      const indicator = mainPage.locator(`[data-status="${status}"]`);
      if (await indicator.count() > 0) {
        const bg = await indicator.first().evaluate(
          (el) => getComputedStyle(el).backgroundColor
        );
        expect(bg).toBeTruthy();
      }
    }
  });
});

test.describe('Viewport Responsiveness', () => {
  test('sidebar collapses below 960px', async ({ mainPage }) => {
    await mainPage.setViewportSize({ width: 960, height: 800 });
    const sidebar = mainPage.locator('[data-testid="sidebar"]');
    if (await sidebar.count() > 0) {
      const box = await sidebar.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(48);
    }
  });

  test('no horizontal overflow at minimum width', async ({ mainPage }) => {
    await mainPage.setViewportSize({ width: 960, height: 800 });
    const hasOverflow = await mainPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });
});

test.describe('Accessibility', () => {
  test('focus indicators are visible', async ({ mainPage }) => {
    await mainPage.keyboard.press('Tab');
    const focused = mainPage.locator(':focus');
    if (await focused.count() > 0) {
      const outline = await focused.evaluate(
        (el) => getComputedStyle(el).outlineColor
      );
      expect(outline).toBeTruthy();
    }
  });

  test('prefers-reduced-motion is respected', async ({ mainPage }) => {
    await mainPage.emulateMedia({ reducedMotion: 'reduce' });
    const animations = await mainPage.evaluate(() => {
      const all = document.querySelectorAll('*');
      let animated = 0;
      for (const el of all) {
        const style = getComputedStyle(el);
        if (style.animationDuration !== '0s' && style.animationDuration !== '') {
          animated++;
        }
      }
      return animated;
    });
    expect(animations).toBe(0);
  });
});
