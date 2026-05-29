import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for AgentOps Desktop renderer testing.
 *
 * Electron's renderer process is Chromium-based, but we test the renderer's
 * HTML/CSS across Chromium, Firefox, and WebKit to catch layout regressions
 * early — especially relevant if the renderer is ever ported to a web client.
 *
 * For Electron-specific E2E tests, use `electronPlaywright` or launch the
 * app via `electron .` and connect Playwright to the debug port.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'snapshot',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'off',
        video: 'off',
        trace: 'off',
      },
      testMatch: /.*snapshot\.spec\.js/,
    },
  ],
});
