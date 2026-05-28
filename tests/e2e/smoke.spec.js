const { test, expect } = require('./fixtures/app.fixture');

/**
 * Deployment smoke tests for AgentOps Desktop renderer.
 *
 * Verifies the app renders without critical errors: essential elements
 * are present, CSS loads, JS executes, and no console errors occur.
 * Run after build to catch renderer regressions before release.
 */

test.describe('Smoke - App Shell', () => {
  test('page loads and has correct title', async ({ mainPage }) => {
    await expect(mainPage).toHaveTitle(/AgentOps/);
  });

  test('header renders with logo text', async ({ mainPage }) => {
    const header = mainPage.locator('.header__title');
    await expect(header).toHaveText('AgentOps');
  });

  test('sidebar renders with navigation items', async ({ mainPage }) => {
    const sidebar = mainPage.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    const items = mainPage.locator('.sidebar__item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('footer renders with version', async ({ mainPage }) => {
    const footer = mainPage.locator('[data-testid="footer"]');
    await expect(footer).toBeVisible();

    const version = mainPage.locator('.footer__right');
    await expect(version).toContainText('v0.1.0');
  });

  test('main content area is visible', async ({ mainPage }) => {
    const main = mainPage.locator('[data-testid="main-content"]');
    await expect(main).toBeVisible();
  });
});

test.describe('Smoke - CSS', () => {
  test('background color token is defined', async ({ mainPage }) => {
    const bg = await mainPage.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-bg-primary')
        .trim();
    });
    expect(bg).toBeTruthy();
  });

  test('no broken stylesheet links', async ({ mainPage }) => {
    const sheets = await mainPage.evaluate(() => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      return Array.from(links).map((l) => ({
        href: l.getAttribute('href'),
        loaded: l.sheet !== null,
      }));
    });

    for (const s of sheets) {
      expect(s.loaded, `Stylesheet ${s.href} failed to load`).toBe(true);
    }
  });
});

test.describe('Smoke - JS', () => {
  test('no uncaught console errors', async ({ mainPage }) => {
    const errors = [];
    mainPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await mainPage.reload();
    await mainPage.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
