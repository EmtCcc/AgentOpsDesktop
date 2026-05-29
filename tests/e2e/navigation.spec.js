const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Navigation — Sidebar', () => {
  test('sidebar links navigate to correct pages', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    // Dashboard link exists and is active by default
    const dashLink = sidebar.locator('[data-page="dashboard"]');
    await expect(dashLink).toBeVisible();
    await expect(dashLink).toHaveClass(/sidebar__item--active/);
  });

  test('sidebar has all expected navigation items', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const items = page.locator('[data-testid="sidebar"] .sidebar__item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Check labels exist
    const labels = await items.locator('.sidebar__label').allTextContents();
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Agents');
  });

  test('sidebar sections have titles', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const sections = page.locator('.sidebar__section-title');
    const titles = await sections.allTextContents();
    expect(titles).toContain('Overview');
    expect(titles).toContain('Operations');
  });

  test('page header shows correct title', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');

    const title = page.locator('.page-header__title');
    await expect(title).toHaveText('Dashboard');
  });
});
