const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

// Snapshot tests run on a fixed viewport to ensure deterministic screenshots.
// Use --update-snapshots to regenerate baselines after intentional UI changes.

// ---------------------------------------------------------------------------
// Design System Harness — full app shell + component gallery
// ---------------------------------------------------------------------------
test.describe('Snapshot — Design System', () => {
  test('full page', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('design-system-full.png', {
      fullPage: true,
    });
  });

  test('header', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="header"]')).toHaveScreenshot(
      'design-system-header.png',
    );
  });

  test('sidebar', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="sidebar"]')).toHaveScreenshot(
      'design-system-sidebar.png',
    );
  });

  test('dashboard stats', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('[aria-label="Dashboard statistics"]'),
    ).toHaveScreenshot('design-system-stats.png');
  });

  test('buttons', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.btn').first().locator('..'),
    ).toHaveScreenshot('design-system-buttons.png');
  });

  test('status dots', async ({ page }) => {
    await page.goto(harness('design-system-harness.html'));
    await page.waitForLoadState('networkidle');
    // The status dots are at the bottom of main content
    const main = page.locator('[data-testid="main-content"]');
    await expect(main).toHaveScreenshot('design-system-main.png', {
      fullPage: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Agents Page
// ---------------------------------------------------------------------------
test.describe('Snapshot — Agents', () => {
  test('full page', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('agents-full.png', {
      fullPage: true,
    });
  });

  test('agent cards', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#agent-list')).toHaveScreenshot(
      'agents-cards.png',
    );
  });

  test('add agent modal', async ({ page }) => {
    await page.goto(harness('agents-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-add-agent');
    await expect(page.locator('#modal-overlay')).toHaveScreenshot(
      'agents-modal.png',
    );
  });
});

// ---------------------------------------------------------------------------
// Tasks Page — Kanban board
// ---------------------------------------------------------------------------
test.describe('Snapshot — Tasks', () => {
  test('full page', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('tasks-full.png', {
      fullPage: true,
    });
  });

  test('kanban board', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#task-board')).toHaveScreenshot(
      'tasks-kanban.png',
    );
  });

  test('new task modal', async ({ page }) => {
    await page.goto(harness('tasks-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-add-task');
    await expect(page.locator('#task-modal-overlay')).toHaveScreenshot(
      'tasks-modal.png',
    );
  });
});

// ---------------------------------------------------------------------------
// Logs Page — log viewer with toolbar
// ---------------------------------------------------------------------------
test.describe('Snapshot — Logs', () => {
  test('full page', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('logs-full.png', {
      fullPage: true,
    });
  });

  test('log viewer', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#log-viewer')).toHaveScreenshot(
      'logs-viewer.png',
    );
  });

  test('toolbar', async ({ page }) => {
    await page.goto(harness('logs-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.logs-toolbar')).toHaveScreenshot(
      'logs-toolbar.png',
    );
  });
});

// ---------------------------------------------------------------------------
// Settings Page — form sections
// ---------------------------------------------------------------------------
test.describe('Snapshot — Settings', () => {
  test('full page', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('settings-full.png', {
      fullPage: true,
    });
  });

  test('general section', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.settings-section').first(),
    ).toHaveScreenshot('settings-general.png');
  });

  test('agents section', async ({ page }) => {
    await page.goto(harness('settings-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.settings-section').nth(1),
    ).toHaveScreenshot('settings-agents.png');
  });
});

// ---------------------------------------------------------------------------
// Squads Page
// ---------------------------------------------------------------------------
test.describe('Snapshot — Squads', () => {
  test('full page', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('squads-full.png', {
      fullPage: true,
    });
  });

  test('squad cards', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#squad-list')).toHaveScreenshot(
      'squads-cards.png',
    );
  });

  test('new squad modal', async ({ page }) => {
    await page.goto(harness('squads-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-add-squad');
    await expect(page.locator('#squad-modal-overlay')).toHaveScreenshot(
      'squads-modal.png',
    );
  });
});

// ---------------------------------------------------------------------------
// Workflows Page — empty state
// ---------------------------------------------------------------------------
test.describe('Snapshot — Workflows', () => {
  test('full page', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('workflows-full.png', {
      fullPage: true,
    });
  });

  test('empty state', async ({ page }) => {
    await page.goto(harness('workflows-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#workflow-empty')).toHaveScreenshot(
      'workflows-empty-state.png',
    );
  });
});
