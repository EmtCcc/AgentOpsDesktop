const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Settings — Page Structure', () => {
  test('page header shows Settings title', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__title')).toHaveText('Settings');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__desc')).toHaveText('Application configuration');
  });
});

test.describe('Settings — General Section', () => {
  test('General section is visible', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    const section = page.locator('.settings-section').nth(0);
    await expect(section.locator('.settings-section__title')).toHaveText('General');
  });

  test('shows app version', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    const version = page.locator('[data-testid="app-version"]');
    await expect(version).toBeVisible();
    await expect(version).toHaveText('v0.1.0');
  });

  test('shows platform', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    const platform = page.locator('[data-testid="platform"]');
    await expect(platform).toBeVisible();
    await expect(platform).toHaveText('darwin');
  });
});

test.describe('Settings — Agents Section', () => {
  test('Agents section is visible', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    const section = page.locator('.settings-section').nth(1);
    await expect(section.locator('.settings-section__title')).toHaveText('Agents');
  });

  test('max parallel agents input is visible', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    const input = page.locator('#setting-max-agents');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'number');
    await expect(input).toHaveValue('5');
  });

  test('task timeout input is visible', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    const input = page.locator('#setting-task-timeout');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'number');
    await expect(input).toHaveValue('300');
  });
});

test.describe('Settings — Logs Section', () => {
  test('Logs section is visible', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    const section = page.locator('.settings-section').nth(2);
    await expect(section.locator('.settings-section__title')).toHaveText('Logs');
  });

  test('log retention input is visible', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');

    const input = page.locator('#setting-log-retention');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'number');
    await expect(input).toHaveValue('7');
  });
});
