const { test, expect } = require('./fixtures/app.fixture');

/**
 * Cross-browser compatibility tests for AgentOps Desktop renderer.
 *
 * Tests verify that the design system renders consistently across
 * Chromium, Firefox, and WebKit engines using the real design tokens.
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
        primary: style.getPropertyValue('--color-primary').trim(),
        fontSans: style.getPropertyValue('--font-sans').trim(),
        space4: style.getPropertyValue('--space-4').trim(),
      };
    });

    // Light mode defaults (no dark mode override in test env)
    expect(vars.bgPrimary).toBe('#FFFFFF');
    expect(vars.textPrimary).toBe('#111827');
    expect(vars.primary).toBe('#6366F1');
    expect(vars.fontSans).toContain('Inter');
    expect(vars.space4).toBe('16px');
  });

  test('semantic color tokens are defined', async ({ mainPage }) => {
    const vars = await mainPage.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        success: style.getPropertyValue('--color-success').trim(),
        warning: style.getPropertyValue('--color-warning').trim(),
        danger: style.getPropertyValue('--color-danger').trim(),
        info: style.getPropertyValue('--color-info').trim(),
      };
    });

    expect(vars.success).toBe('#10B981');
    expect(vars.warning).toBe('#F59E0B');
    expect(vars.danger).toBe('#EF4444');
    expect(vars.info).toBe('#3B82F6');
  });

  test('status color tokens are defined', async ({ mainPage }) => {
    const vars = await mainPage.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        running: style.getPropertyValue('--status-running').trim(),
        idle: style.getPropertyValue('--status-idle').trim(),
        error: style.getPropertyValue('--status-error').trim(),
        spawning: style.getPropertyValue('--status-spawning').trim(),
      };
    });

    expect(vars.running).toBe('#10B981');
    expect(vars.idle).toBe('#6B7280');
    expect(vars.error).toBe('#EF4444');
    expect(vars.spawning).toBe('#F59E0B');
  });
});

test.describe('Design System — Layout Shell', () => {
  test('app shell has correct grid layout', async ({ mainPage }) => {
    const app = mainPage.locator('[data-testid="header"]').locator('..');
    const display = await app.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('grid');
  });

  test('header spans full width', async ({ mainPage }) => {
    const header = mainPage.locator('[data-testid="header"]');
    const headerBox = await header.boundingBox();
    const viewport = mainPage.viewportSize();
    expect(headerBox).toBeTruthy();
    if (headerBox && viewport) {
      expect(headerBox.width).toBe(viewport.width);
      expect(headerBox.height).toBe(64);
    }
  });

  test('sidebar has correct width', async ({ mainPage }) => {
    const sidebar = mainPage.locator('[data-testid="sidebar"]');
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).toBeTruthy();
    if (sidebarBox) {
      expect(sidebarBox.width).toBe(240);
    }
  });

  test('footer has correct height', async ({ mainPage }) => {
    const footer = mainPage.locator('[data-testid="footer"]');
    const footerBox = await footer.boundingBox();
    expect(footerBox).toBeTruthy();
    if (footerBox) {
      expect(footerBox.height).toBe(32);
    }
  });

  test('content area has minimum width', async ({ mainPage }) => {
    const content = mainPage.locator('[data-testid="main-content"]');
    const box = await content.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(320);
    }
  });
});

test.describe('Design System — Typography', () => {
  test('body text uses Inter font family', async ({ mainPage }) => {
    const fontFamily = await mainPage.evaluate(() => {
      return getComputedStyle(document.body).fontFamily;
    });
    expect(fontFamily).toContain('Inter');
  });

  test('monospace elements use JetBrains Mono', async ({ mainPage }) => {
    const code = mainPage.locator('[data-testid="log-output"]');
    const count = await code.count();
    if (count > 0) {
      const fontFamily = await code.first().evaluate(
        (el) => getComputedStyle(el).fontFamily
      );
      expect(fontFamily).toContain('JetBrains Mono');
    }
  });

  test('heading hierarchy is correct', async ({ mainPage }) => {
    const h1 = mainPage.locator('.page-header__title');
    if (await h1.count() > 0) {
      const fontSize = await h1.first().evaluate(
        (el) => getComputedStyle(el).fontSize
      );
      expect(fontSize).toBe('24px'); // --text-2xl
    }
  });
});

test.describe('Design System — Components', () => {
  test('buttons have correct height', async ({ mainPage }) => {
    const btn = mainPage.locator('[data-size="md"]').first();
    if (await btn.count() > 0) {
      const box = await btn.boundingBox();
      expect(box?.height).toBe(36);
    }
  });

  test('status indicators render with correct colors', async ({ mainPage }) => {
    const statuses = ['running', 'idle', 'error', 'spawning'];

    for (const status of statuses) {
      const indicator = mainPage.locator(`[data-status="${status}"]`);
      if (await indicator.count() > 0) {
        const bg = await indicator.first().evaluate(
          (el) => getComputedStyle(el).backgroundColor
        );
        expect(bg).toBeTruthy();
        // Should not be transparent
        expect(bg).not.toBe('rgba(0, 0, 0, 0)');
      }
    }
  });

  test('cards have border and rounded corners', async ({ mainPage }) => {
    const card = mainPage.locator('.card').first();
    if (await card.count() > 0) {
      const border = await card.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          radius: s.borderRadius,
          borderColor: s.borderColor,
        };
      });
      expect(border.radius).toBeTruthy();
      expect(border.borderColor).toBeTruthy();
    }
  });
});

test.describe('Viewport Responsiveness', () => {
  test('sidebar collapses below 1024px', async ({ mainPage }) => {
    await mainPage.setViewportSize({ width: 1024, height: 800 });
    await mainPage.waitForTimeout(300); // wait for CSS transition
    const sidebar = mainPage.locator('[data-testid="sidebar"]');
    const box = await sidebar.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      // Collapsed sidebar should be significantly narrower than expanded (240px)
      expect(box.width).toBeLessThan(120);
    }
  });

  test('no horizontal overflow at minimum width', async ({ mainPage }) => {
    await mainPage.setViewportSize({ width: 960, height: 800 });
    const hasOverflow = await mainPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('grid collapses at narrow viewport', async ({ mainPage }) => {
    await mainPage.setViewportSize({ width: 960, height: 800 });
    // 4-column grids should become 2-column
    const grid = mainPage.locator('.grid--4').first();
    if (await grid.count() > 0) {
      const columns = await grid.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns
      );
      // Should be 2 columns at this width
      const colCount = columns.split(' ').length;
      expect(colCount).toBeLessThanOrEqual(2);
    }
  });

  test('touch targets are at least 36px', async ({ mainPage }) => {
    const buttons = mainPage.locator('button, a.sidebar__item');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 20); i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }
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
    const hasLongAnimations = await mainPage.evaluate(() => {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const style = getComputedStyle(el);
        // With prefers-reduced-motion: reduce, durations should be near-zero (0.01ms)
        if (style.animationDuration && style.animationDuration !== '0s' && style.animationDuration !== '') {
          // Parse duration — should be effectively 0 (0.01ms = 0.00001s)
          const seconds = parseFloat(style.animationDuration);
          if (seconds > 0.01) return true;
        }
        if (style.transitionDuration && style.transitionDuration !== '0s' && style.transitionDuration !== '') {
          const seconds = parseFloat(style.transitionDuration);
          if (seconds > 0.01) return true;
        }
      }
      return false;
    });
    expect(hasLongAnimations).toBe(false);
  });

  test('interactive elements have aria labels where needed', async ({ mainPage }) => {
    const buttons = mainPage.locator('button:not([aria-label]):not([title])');
    const count = await buttons.count();
    // Most buttons should have accessible names via text content or aria
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      // Button should have some accessible name
      expect(text?.trim() || ariaLabel || title).toBeTruthy();
    }
  });
});
