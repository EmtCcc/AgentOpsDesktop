const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Symlink Security — Page Structure', () => {
  test('page header shows Workspace Security title', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__title')).toHaveText('Workspace Security');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__desc')).toHaveText('Path sandboxing and symlink escape detection');
  });

  test('Run All Tests button is visible', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#btn-run-all')).toBeVisible();
  });

  test('workspace root path is displayed', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#workspace-root')).toContainText('ws-abc123');
  });
});

test.describe('Symlink Security — File Tree', () => {
  test('displays workspace file tree', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    const items = page.locator('.file-tree__item');
    expect(await items.count()).toBeGreaterThanOrEqual(5);
  });

  test('safe symlink is marked with symlink icon', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    const safeLink = page.locator('[data-file="safe-link"]');
    await expect(safeLink).toBeVisible();
    await expect(safeLink).toHaveAttribute('data-type', 'symlink');
  });

  test('malicious symlinks are marked as blocked', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    const evilLink = page.locator('[data-file="evil-link"]');
    await expect(evilLink).toHaveAttribute('data-type', 'symlink-blocked');
    const escapeLink = page.locator('[data-file="escape-link"]');
    await expect(escapeLink).toHaveAttribute('data-type', 'symlink-blocked');
  });

  test('directories are shown with folder icon', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    const srcDir = page.locator('[data-file="src/"]');
    await expect(srcDir.locator('.file-tree__icon--dir')).toBeVisible();
  });
});

test.describe('Symlink Security — Path Validation', () => {
  test('valid path within workspace is allowed', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', 'src/main.js');
    await page.click('#btn-test-path');
    const result = page.locator('#path-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('ALLOWED');
  });

  test('path traversal with ../ is denied', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', '../etc/passwd');
    await page.click('#btn-test-path');
    const result = page.locator('#path-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('DENIED');
    await expect(result).toContainText('escape');
  });

  test('deep path traversal is denied', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', '../../../etc/shadow');
    await page.click('#btn-test-path');
    const result = page.locator('#path-result');
    await expect(result).toContainText('DENIED');
  });

  test('malicious symlink path is denied', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', 'evil-link');
    await page.click('#btn-test-path');
    const result = page.locator('#path-result');
    await expect(result).toContainText('DENIED');
    await expect(result).toContainText('symlink escape');
  });

  test('safe symlink path is allowed', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', 'safe-link');
    await page.click('#btn-test-path');
    const result = page.locator('#path-result');
    await expect(result).toContainText('ALLOWED');
  });

  test('empty path resolves to root', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', '');
    await page.click('#btn-test-path');
    const result = page.locator('#path-result');
    await expect(result).toContainText('ALLOWED');
  });
});

test.describe('Symlink Security — Audit Log', () => {
  test('path validation entries appear in audit log', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', 'src/main.js');
    await page.click('#btn-test-path');
    const entries = page.locator('.audit-log__entry');
    expect(await entries.count()).toBe(1);
    await expect(entries.first()).toContainText('ALLOW');
  });

  test('denied entries show in red', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', '../etc/passwd');
    await page.click('#btn-test-path');
    await expect(page.locator('.audit-log__entry--deny')).toBeVisible();
  });

  test('allowed entries show in green', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#test-path', 'data.txt');
    await page.click('#btn-test-path');
    await expect(page.locator('.audit-log__entry--allow')).toBeVisible();
  });
});

test.describe('Symlink Security — Run All Tests', () => {
  test('all security tests pass', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-run-all');

    // All 5 tests should pass
    await expect(page.locator('[data-test="path-containment"] [data-result]')).toHaveAttribute('data-result', 'pass');
    await expect(page.locator('[data-test="symlink-escape"] [data-result]')).toHaveAttribute('data-result', 'pass');
    await expect(page.locator('[data-test="symlink-safe"] [data-result]')).toHaveAttribute('data-result', 'pass');
    await expect(page.locator('[data-test="nonexistent-write"] [data-result]')).toHaveAttribute('data-result', 'pass');
    await expect(page.locator('[data-test="null-byte"] [data-result]')).toHaveAttribute('data-result', 'pass');
  });

  test('run all populates audit log', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-run-all');
    const entries = page.locator('.audit-log__entry');
    expect(await entries.count()).toBe(5);
  });

  test('audit log shows mix of allow and deny', async ({ page }) => {
    await page.goto(harness('symlink-security-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-run-all');
    expect(await page.locator('.audit-log__entry--deny').count()).toBeGreaterThanOrEqual(1);
    expect(await page.locator('.audit-log__entry--allow').count()).toBeGreaterThanOrEqual(1);
  });
});
