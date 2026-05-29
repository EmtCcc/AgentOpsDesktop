const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Task Board — Page Structure', () => {
  test('page header shows Tasks title', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__title')).toHaveText('Tasks');
  });

  test('New Task button is visible', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('#btn-add-task');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText(/New Task/);
  });
});

test.describe('Task Board — Kanban Columns', () => {
  test('has all four kanban columns', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#col-pending')).toBeVisible();
    await expect(page.locator('#col-running')).toBeVisible();
    await expect(page.locator('#col-done')).toBeVisible();
    await expect(page.locator('#col-failed')).toBeVisible();
  });

  test('columns have correct titles', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    const titles = page.locator('.kanban__column-title');
    await expect(titles.nth(0)).toHaveText('Pending');
    await expect(titles.nth(1)).toHaveText('Running');
    await expect(titles.nth(2)).toHaveText('Done');
    await expect(titles.nth(3)).toHaveText('Failed');
  });

  test('columns have task counts', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    const counts = page.locator('.kanban__count');
    await expect(counts.nth(0)).toHaveText('2');
    await expect(counts.nth(1)).toHaveText('1');
    await expect(counts.nth(2)).toHaveText('1');
    await expect(counts.nth(3)).toHaveText('1');
  });

  test('kanban has region role with aria-label', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    const board = page.locator('#task-board');
    await expect(board).toHaveAttribute('role', 'region');
    await expect(board).toHaveAttribute('aria-label', 'Task board');
  });
});

test.describe('Task Board — Task Cards', () => {
  test('task cards have titles', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    const titles = page.locator('.kanban__card-title');
    const texts = await titles.allTextContents();
    expect(texts).toContain('Design database schema');
    expect(texts).toContain('Implement auth flow');
    expect(texts).toContain('Deploy to staging');
  });

  test('task cards use listitem role', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    const cards = page.locator('[role="listitem"]');
    const count = await cards.count();
    expect(count).toBe(5);
  });

  test('failed task card has failed styling', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    const failedCard = page.locator('.kanban__card--failed');
    await expect(failedCard).toBeVisible();
    await expect(failedCard).toHaveAttribute('data-task-id', 'task-5');
  });
});

test.describe('Task Board — New Task Modal', () => {
  test('clicking New Task opens modal', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    const overlay = page.locator('#task-modal-overlay');
    await expect(overlay).toBeHidden();

    await page.click('#btn-add-task');
    await expect(overlay).toBeVisible();
  });

  test('modal has form fields', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-task');

    await expect(page.locator('#task-title')).toBeVisible();
    await expect(page.locator('#task-desc')).toBeVisible();
    await expect(page.locator('#task-agent')).toBeVisible();
    await expect(page.locator('#task-goal')).toBeVisible();
  });

  test('cancel closes modal', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');

    await page.click('#btn-add-task');
    const overlay = page.locator('#task-modal-overlay');
    await expect(overlay).toBeVisible();

    await page.click('#task-modal-cancel-btn');
    await expect(overlay).toBeHidden();
  });
});
