import { test as base, type Page } from '@playwright/test';

/**
 * Shared fixtures for AgentOps Desktop E2E tests.
 *
 * Once the Electron app has a renderer, update `appUrl` to point at the
 * dev server URL or the built renderer entry point.
 */

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

type AppFixtures = {
  appUrl: string;
  mainPage: Page;
};

export const test = base.extend<AppFixtures>({
  appUrl: async ({}, use) => {
    await use(APP_URL);
  },

  mainPage: async ({ page, appUrl }, use) => {
    await page.goto(appUrl);
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});

export { expect } from '@playwright/test';
