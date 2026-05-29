const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Agents — Page Structure', () => {
  test('page header shows Agents title', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__title')).toHaveText('Agents');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__desc')).toHaveText('Manage your AI agent fleet');
  });

  test('Add Agent button is visible', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('#btn-add-agent');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText(/Add Agent/);
  });
});

test.describe('Agents — Agent Cards', () => {
  test('displays agent cards', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.agent-card');
    const count = await cards.count();
    expect(count).toBe(3);
  });

  test('agent cards show names', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    const names = page.locator('.agent-card__name');
    await expect(names.nth(0)).toHaveText('Claude Code');
    await expect(names.nth(1)).toHaveText('Codex Agent');
    await expect(names.nth(2)).toHaveText('Gemini CLI');
  });

  test('agent cards show status dots', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    const dots = page.locator('.status-dot');
    const count = await dots.count();
    expect(count).toBe(3);

    // Check status attributes
    await expect(dots.nth(0)).toHaveAttribute('data-status', 'running');
    await expect(dots.nth(1)).toHaveAttribute('data-status', 'idle');
    await expect(dots.nth(2)).toHaveAttribute('data-status', 'error');
  });

  test('agent cards have action buttons', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    const healthBtns = page.locator('[data-action="health-check"]');
    const deleteBtns = page.locator('[data-action="delete"]');
    expect(await healthBtns.count()).toBe(3);
    expect(await deleteBtns.count()).toBe(3);
  });
});

test.describe('Agents — Add Agent Modal', () => {
  test('clicking Add Agent opens modal', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    const overlay = page.locator('#modal-overlay');
    await expect(overlay).toBeHidden();

    await page.click('#btn-add-agent');
    await expect(overlay).toBeVisible();
  });

  test('modal has all form fields', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-agent');

    await expect(page.locator('#agent-name')).toBeVisible();
    await expect(page.locator('#agent-type')).toBeVisible();
    await expect(page.locator('#agent-path')).toBeVisible();
    await expect(page.locator('#agent-cwd')).toBeVisible();
  });

  test('modal has correct agent type options', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-agent');

    const options = page.locator('#agent-type option');
    const values = await options.evaluateAll((els) => els.map((e) => e.value));
    expect(values).toEqual(['claude-code', 'codex', 'gemini-cli', 'opencode', 'cursor', 'custom']);
  });

  test('cancel button closes modal', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-agent');
    const overlay = page.locator('#modal-overlay');
    await expect(overlay).toBeVisible();

    await page.click('#modal-cancel-btn');
    await expect(overlay).toBeHidden();
  });

  test('clicking overlay backdrop closes modal', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-agent');
    const overlay = page.locator('#modal-overlay');
    await expect(overlay).toBeVisible();

    // Click the overlay itself (not the modal content)
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).toBeHidden();
  });

  test('modal has accessible dialog role', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-agent');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-label', 'Add Agent');
  });
});
