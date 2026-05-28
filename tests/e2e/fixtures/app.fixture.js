const { test: base, expect } = require('@playwright/test');
const path = require('path');

const HARNESS_PATH = path.resolve(__dirname, '..', 'design-system-harness.html');
const APP_URL = process.env.APP_URL || `file://${HARNESS_PATH}`;

const test = base.extend({
  appUrl: [async ({}, use) => {
    await use(APP_URL);
  }, { scope: 'test' }],

  mainPage: async ({ page, appUrl }, use) => {
    await page.goto(appUrl);
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});

module.exports = { test, expect };
