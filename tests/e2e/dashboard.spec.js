const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Dashboard — Stats', () => {
  test('shows agent count stat', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const stat = page.locator('[data-testid="stat-agents"]');
    await expect(stat).toBeVisible();
    await expect(stat).toHaveText('3');
  });

  test('shows task count stat', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const stat = page.locator('[data-testid="stat-tasks"]');
    await expect(stat).toBeVisible();
    await expect(stat).toHaveText('5');
  });

  test('stats region has aria-label', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const region = page.locator('[role="region"][aria-label="Dashboard statistics"]');
    await expect(region).toBeVisible();
  });
});

test.describe('Dashboard — Activity Feed', () => {
  test('activity feed is visible', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const feed = page.locator('[data-testid="activity-feed"]');
    await expect(feed).toBeVisible();
  });

  test('activity feed has items', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const items = page.locator('.activity-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Dashboard — Log Output', () => {
  test('log output block is visible', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const logOutput = page.locator('[data-testid="log-output"]');
    await expect(logOutput).toBeVisible();
  });

  test('log output uses monospace font', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const logOutput = page.locator('[data-testid="log-output"]');
    const fontFamily = await logOutput.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toContain('JetBrains Mono');
  });
});

test.describe('Dashboard — Action Buttons', () => {
  test('New Task button is visible', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('button', { hasText: 'New Task' });
    await expect(btn).toBeVisible();
  });

  test('Settings button is visible', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('button', { hasText: 'Settings' });
    await expect(btn).toBeVisible();
  });

  test('Stop All button is visible and danger-styled', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('button', { hasText: 'Stop All' });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass(/btn--danger/);
  });
});
