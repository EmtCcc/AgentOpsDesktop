const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Squads — Page Structure', () => {
  test('page header shows Squads title', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__title')).toHaveText('Squads');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__desc')).toHaveText('Organize agents into teams');
  });

  test('New Squad button is visible', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('#btn-add-squad');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText(/New Squad/);
  });
});

test.describe('Squads — Squad Cards', () => {
  test('displays squad cards', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.squad-card');
    const count = await cards.count();
    expect(count).toBe(2);
  });

  test('squad cards show names', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    const names = page.locator('.squad-card__name');
    await expect(names.nth(0)).toHaveText('Backend Team');
    await expect(names.nth(1)).toHaveText('Frontend Team');
  });

  test('squad cards show descriptions', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    const descs = page.locator('.squad-card__desc');
    await expect(descs.nth(0)).toHaveText('Handles API development and database operations');
  });

  test('squad cards show member count', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    const members = page.locator('.squad-card__members');
    await expect(members.nth(0)).toHaveText('2 members');
    await expect(members.nth(1)).toHaveText('1 member');
  });

  test('squad cards show leader', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    const leaders = page.locator('.squad-card__leader');
    await expect(leaders.nth(0)).toHaveText('Leader: Claude Code');
    await expect(leaders.nth(1)).toHaveText('Leader: Codex Agent');
  });

  test('squad cards have action buttons', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    const startBtns = page.locator('[data-action="start"]');
    const stopBtns = page.locator('[data-action="stop"]');
    const statusBtns = page.locator('[data-action="status"]');
    const deleteBtns = page.locator('[data-action="delete"]');

    expect(await startBtns.count()).toBe(2);
    expect(await stopBtns.count()).toBe(2);
    expect(await statusBtns.count()).toBe(2);
    expect(await deleteBtns.count()).toBe(2);
  });
});

test.describe('Squads — New Squad Modal', () => {
  test('clicking New Squad opens modal', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    const overlay = page.locator('#squad-modal-overlay');
    await expect(overlay).toBeHidden();

    await page.click('#btn-add-squad');
    await expect(overlay).toBeVisible();
  });

  test('modal has form fields', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-squad');

    await expect(page.locator('#squad-name')).toBeVisible();
    await expect(page.locator('#squad-desc')).toBeVisible();
    await expect(page.locator('#squad-leader')).toBeVisible();
    await expect(page.locator('#squad-member-checkboxes')).toBeVisible();
  });

  test('member checkboxes are present', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-squad');

    const checkboxes = page.locator('#squad-member-checkboxes input[type="checkbox"]');
    expect(await checkboxes.count()).toBe(3);
  });

  test('cancel closes modal', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-squad');
    const overlay = page.locator('#squad-modal-overlay');
    await expect(overlay).toBeVisible();

    await page.click('#squad-modal-cancel-btn');
    await expect(overlay).toBeHidden();
  });

  test('modal has accessible dialog role', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-squad');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-label', 'New Squad');
  });
});
