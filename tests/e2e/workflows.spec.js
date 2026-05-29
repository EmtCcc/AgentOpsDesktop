const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Workflows — Page Structure', () => {
  test('page header shows Workflows title', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__title')).toHaveText('Workflows');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.page-header__desc')).toHaveText('Pipeline orchestration');
  });
});

test.describe('Workflows — Empty State', () => {
  test('empty state is visible', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');

    const emptyState = page.locator('#workflow-empty');
    await expect(emptyState).toBeVisible();
  });

  test('empty state shows title', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');

    const title = page.locator('.empty-state__title');
    await expect(title).toHaveText('No workflows configured');
  });

  test('empty state shows description', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');

    const desc = page.locator('.empty-state__desc');
    await expect(desc).toHaveText('Create a workflow to orchestrate multi-agent pipelines');
  });

  test('Create workflow button is visible', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('#btn-create-workflow');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Create workflow');
  });

  test('Learn more button is visible', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');

    const btn = page.locator('.empty-state__actions .btn--secondary');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Learn more');
  });
});
