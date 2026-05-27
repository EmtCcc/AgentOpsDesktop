import { test as base, type Page } from '@playwright/test';

/**
 * Shared fixtures for AgentOps Desktop E2E tests.
 *
 * Uses the design system harness HTML for cross-browser and performance
 * tests until the Electron app renderer is built. Once the app has a dev
 * server, set APP_URL=http://localhost:3000 to test the real renderer.
 */

const HARNESS_PATH = new URL('../design-system-harness.html', import.meta.url).pathname;
const APP_URL = process.env.APP_URL || `file://${HARNESS_PATH}`;

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
