const { test: base, expect } = require('@playwright/test');
const path = require('path');

const HARNESS_DIR = path.resolve(__dirname, '..');

function harnessUrl(name) {
  return `file://${path.join(HARNESS_DIR, name)}`;
}

const test = base.extend({
  mainPage: async ({ page }, use) => {
    const harness = process.env.HARNESS || 'design-system-harness.html';
    await page.goto(harnessUrl(harness));
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});

module.exports = { test, expect, harnessUrl };
