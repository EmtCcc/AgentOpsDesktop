const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Logs — Page Structure', () => {
  test('page header shows Logs title', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__title')).toHaveText('Logs');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__desc')).toHaveText('Real-time agent log viewer');
  });
});

test.describe('Logs — Toolbar', () => {
  test('search input is visible', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const search = page.locator('#logs-search');
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('placeholder', 'Search logs...');
  });

  test('agent filter dropdown is visible', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const filter = page.locator('#logs-filter-agent');
    await expect(filter).toBeVisible();

    const options = filter.locator('option');
    expect(await options.count()).toBe(4); // All agents + 3 specific
  });

  test('level filter dropdown is visible', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const filter = page.locator('#logs-filter-level');
    await expect(filter).toBeVisible();

    const options = filter.locator('option');
    const values = await options.evaluateAll((els) => els.map((e) => e.value));
    expect(values).toEqual(['', 'debug', 'info', 'warning', 'error']);
  });

  test('refresh button is visible', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('#btn-logs-refresh');
    await expect(btn).toBeVisible();
  });

  test('clear button is visible', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('#btn-logs-clear');
    await expect(btn).toBeVisible();
  });
});

test.describe('Logs — Log Viewer', () => {
  test('log viewer is visible', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const viewer = page.locator('#log-viewer');
    await expect(viewer).toBeVisible();
  });

  test('log viewer has log role and aria-live', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const viewer = page.locator('#log-viewer');
    await expect(viewer).toHaveAttribute('role', 'log');
    await expect(viewer).toHaveAttribute('aria-live', 'polite');
  });

  test('log entries are displayed', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const entries = page.locator('.log-entry');
    const count = await entries.count();
    expect(count).toBe(5);
  });

  test('log entries show different levels', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const entries = page.locator('.log-entry');
    const levels = await entries.evaluateAll((els) => els.map((e) => e.dataset.level));
    expect(levels).toContain('info');
    expect(levels).toContain('warning');
    expect(levels).toContain('error');
    expect(levels).toContain('debug');
  });

  test('log entries show agent names', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const agents = page.locator('.log-entry__agent');
    const texts = await agents.allTextContents();
    expect(texts).toContain('Claude Code');
    expect(texts).toContain('Codex Agent');
    expect(texts).toContain('Gemini CLI');
  });

  test('log entries show timestamps', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const times = page.locator('.log-entry__time');
    const count = await times.count();
    expect(count).toBe(5);

    // Each should have a time format
    for (let i = 0; i < count; i++) {
      const text = await times.nth(i).textContent();
      expect(text).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    }
  });

  test('search input has accessible label', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');

    const search = page.locator('#logs-search');
    await expect(search).toHaveAttribute('aria-label', 'Search logs');
  });
});
