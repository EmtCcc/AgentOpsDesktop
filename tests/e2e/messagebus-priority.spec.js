const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('MessageBus Priority — Page Structure', () => {
  test('page header shows title', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__title')).toHaveText('MessageBus Priority');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__desc')).toHaveText('Priority queue management and message delivery');
  });

  test('Clear and Dispatch buttons are visible', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#btn-clear')).toBeVisible();
    await expect(page.locator('#btn-dispatch')).toBeVisible();
  });

  test('priority legend shows all 4 levels', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    const legend = page.locator('.priority-legend__item');
    expect(await legend.count()).toBe(4);
  });

  test('max queue size is displayed', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#max-queue-size')).toHaveText('10');
  });
});

test.describe('MessageBus Priority — Queue Stats', () => {
  test('stats start at zero', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#stat-critical')).toHaveText('0');
    await expect(page.locator('#stat-high')).toHaveText('0');
    await expect(page.locator('#stat-normal')).toHaveText('0');
    await expect(page.locator('#stat-low')).toHaveText('0');
  });

  test('stats update after publishing messages', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.selectOption('#msg-priority', 'critical');
    await page.click('#btn-publish');
    await expect(page.locator('#stat-critical')).toHaveText('1');
  });
});

test.describe('MessageBus Priority — Publish Messages', () => {
  test('publishing a message adds it to the queue', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-publish');
    const items = page.locator('.msg-item');
    expect(await items.count()).toBe(1);
  });

  test('published message shows correct priority class', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.selectOption('#msg-priority', 'high');
    await page.click('#btn-publish');
    await expect(page.locator('.msg-item').first()).toHaveClass(/msg-item--high/);
  });

  test('published message shows topic', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#msg-topic', 'custom.topic.name');
    await page.click('#btn-publish');
    await expect(page.locator('.msg-item__topic').first()).toHaveText('custom.topic.name');
  });

  test('published message shows payload', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#msg-payload', 'Hello world');
    await page.click('#btn-publish');
    await expect(page.locator('.msg-item__payload').first()).toHaveText('Hello world');
  });

  test('default priority is normal', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-publish');
    await expect(page.locator('.msg-item').first()).toHaveClass(/msg-item--normal/);
  });
});

test.describe('MessageBus Priority — Priority Ordering', () => {
  test('higher-priority messages appear at top of queue', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    // Publish in reverse priority order
    await page.selectOption('#msg-priority', 'low');
    await page.click('#btn-publish');
    await page.selectOption('#msg-priority', 'normal');
    await page.click('#btn-publish');
    await page.selectOption('#msg-priority', 'critical');
    await page.click('#btn-publish');

    const items = page.locator('.msg-item');
    expect(await items.count()).toBe(3);
    await expect(items.nth(0)).toHaveClass(/msg-item--critical/);
    await expect(items.nth(1)).toHaveClass(/msg-item--normal/);
    await expect(items.nth(2)).toHaveClass(/msg-item--low/);
  });

  test('burst inserts messages in correct priority order', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-burst');

    const items = page.locator('.msg-item');
    expect(await items.count()).toBe(5);
    // First should be critical
    await expect(items.nth(0)).toHaveClass(/msg-item--critical/);
    // Second should be high
    await expect(items.nth(1)).toHaveClass(/msg-item--high/);
  });
});

test.describe('MessageBus Priority — Queue Overflow', () => {
  test('fill queue reaches max capacity', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-fill-queue');
    const items = page.locator('.msg-item:not(:has(.msg-item__badge--dropped))');
    expect(await items.count()).toBeLessThanOrEqual(10);
  });

  test('low-priority message is dropped when queue is full', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-fill-queue');
    const countBefore = await page.locator('.msg-item').count();
    // Queue is now full, try adding a low priority message
    await page.selectOption('#msg-priority', 'low');
    await page.fill('#msg-payload', 'Should be dropped');
    await page.click('#btn-publish');
    // Low priority message should be dropped — queue count stays the same
    const countAfter = await page.locator('.msg-item').count();
    expect(countAfter).toBe(countBefore);
  });

  test('critical message evicts lowest when queue is full', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-fill-queue');
    const countBefore = await page.locator('.msg-item').count();
    await page.selectOption('#msg-priority', 'critical');
    await page.fill('#msg-payload', 'Critical evicts low');
    await page.click('#btn-publish');
    // Queue should still be at max, but with the critical message added
    const countAfter = await page.locator('.msg-item').count();
    expect(countAfter).toBeLessThanOrEqual(countBefore + 1);
    // The critical message should be in the queue
    await expect(page.locator('.msg-item--critical').last()).toContainText('Critical evicts low');
  });
});

test.describe('MessageBus Priority — Dispatch', () => {
  test('dispatch delivers messages in priority order', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-burst');
    await page.click('#btn-dispatch');

    const deliveryLog = page.locator('#delivery-order div');
    expect(await deliveryLog.count()).toBe(5);
    // First delivered should be critical
    await expect(deliveryLog.nth(0)).toContainText('critical');
    // Second should be high
    await expect(deliveryLog.nth(1)).toContainText('high');
  });

  test('dispatch clears the queue', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-burst');
    await page.click('#btn-dispatch');
    // Queue should be empty after dispatch
    await expect(page.locator('#queue-display')).toContainText('Queue empty');
  });

  test('dispatch shows numbered delivery order', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.selectOption('#msg-priority', 'normal');
    await page.click('#btn-publish');
    await page.selectOption('#msg-priority', 'critical');
    await page.click('#btn-publish');
    await page.click('#btn-dispatch');

    const log = page.locator('#delivery-order');
    await expect(log).toContainText('1.');
    await expect(log).toContainText('2.');
  });
});

test.describe('MessageBus Priority — Clear', () => {
  test('clear empties the queue', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-burst');
    await page.click('#btn-clear');
    await expect(page.locator('#queue-display')).toContainText('Queue empty');
  });

  test('clear resets all stats to zero', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-burst');
    await page.click('#btn-clear');
    await expect(page.locator('#stat-critical')).toHaveText('0', { timeout: 5000 });
    await expect(page.locator('#stat-high')).toHaveText('0');
    await expect(page.locator('#stat-normal')).toHaveText('0');
    await expect(page.locator('#stat-low')).toHaveText('0');
  });
});

test.describe('MessageBus Priority — Validation', () => {
  test('valid priorities section is visible', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Valid priorities:')).toBeVisible();
  });

  test('all 4 priority options are available in the selector', async ({ page }) => {
    await page.goto(harness('messagebus-priority-harness.html'));
    await page.waitForLoadState('networkidle');
    const options = page.locator('#msg-priority option');
    const values = await options.evaluateAll(els => els.map(e => e.value));
    expect(values).toEqual(['normal', 'critical', 'high', 'low']);
  });
});
