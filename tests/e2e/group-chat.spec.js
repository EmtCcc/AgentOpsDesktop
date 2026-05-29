const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Group Chat — Page Structure', () => {
  test('page header shows Group Chat title', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__title')).toHaveText('Group Chat');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__desc')).toHaveText('Multi-agent group conversations');
  });

  test('New Chat button is visible', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#btn-create-chat')).toBeVisible();
  });
});

test.describe('Group Chat — Session List', () => {
  test('displays existing chat sessions', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const sessions = page.locator('.chat-session');
    expect(await sessions.count()).toBe(2);
  });

  test('session shows title', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-session-id="session-1"] .chat-session__title')).toHaveText('Architecture Review');
  });

  test('session shows active status', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const status = page.locator('[data-session-id="session-1"] .chat-session__status');
    await expect(status).toHaveText('Active');
    await expect(status).toHaveAttribute('data-status', 'active');
  });

  test('session shows idle status', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const status = page.locator('[data-session-id="session-2"] .chat-session__status');
    await expect(status).toHaveText('Idle');
    await expect(status).toHaveAttribute('data-status', 'idle');
  });
});

test.describe('Group Chat — Participants', () => {
  test('displays participant list', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const participants = page.locator('[data-session-id="session-1"] .chat-participant');
    expect(await participants.count()).toBe(3);
  });

  test('participant has status dot', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const dots = page.locator('[data-session-id="session-1"] .chat-participant__dot');
    expect(await dots.count()).toBe(3);
    await expect(dots.nth(0)).toHaveClass(/speaking/);
    await expect(dots.nth(1)).toHaveClass(/listening/);
  });
});

test.describe('Group Chat — Messages', () => {
  test('displays system message on session creation', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const systemMsgs = page.locator('[data-session-id="session-1"] .chat-message--system');
    expect(await systemMsgs.count()).toBeGreaterThanOrEqual(1);
    await expect(systemMsgs.first()).toHaveText(/群聊.*已创建/);
  });

  test('displays agent messages with author names', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const agentMsgs = page.locator('[data-session-id="session-1"] .chat-message--agent');
    expect(await agentMsgs.count()).toBe(2);
    await expect(agentMsgs.nth(0).locator('.chat-message__author')).toHaveText('Claude Code');
    await expect(agentMsgs.nth(1).locator('.chat-message__author')).toHaveText('Codex Agent');
  });

  test('displays human messages', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const humanMsgs = page.locator('[data-session-id="session-1"] .chat-message--human');
    expect(await humanMsgs.count()).toBe(1);
    await expect(humanMsgs.first().locator('.chat-message__content')).toHaveText('What about the database layer?');
  });

  test('sending a message adds it to the chat', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const input = page.locator('#chat-input-1');
    await input.fill('Let me think about that...');
    await page.click('#btn-send-1');
    const humanMsgs = page.locator('[data-session-id="session-1"] .chat-message--human');
    expect(await humanMsgs.count()).toBe(2);
    await expect(humanMsgs.last().locator('.chat-message__content')).toHaveText('Let me think about that...');
  });

  test('empty message is not sent', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const countBefore = await page.locator('[data-session-id="session-1"] .chat-message').count();
    await page.click('#btn-send-1');
    const countAfter = await page.locator('[data-session-id="session-1"] .chat-message').count();
    expect(countAfter).toBe(countBefore);
  });
});

test.describe('Group Chat — Create Modal', () => {
  test('clicking New Chat opens modal', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const modal = page.locator('#create-chat-modal');
    await expect(modal).not.toHaveClass(/visible/);
    await page.click('#btn-create-chat');
    await expect(modal).toHaveClass(/visible/);
  });

  test('modal has accessible dialog role', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-create-chat');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-label', 'Create Group Chat');
  });

  test('modal has required form fields', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-create-chat');
    await expect(page.locator('#chat-title')).toBeVisible();
    await expect(page.locator('#turn-strategy')).toBeVisible();
    const checkboxes = page.locator('#participant-checkboxes input[type="checkbox"]');
    expect(await checkboxes.count()).toBe(3);
  });

  test('modal has correct strategy options', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-create-chat');
    const options = page.locator('#turn-strategy option');
    const values = await options.evaluateAll(els => els.map(e => e.value));
    expect(values).toEqual(['round-robin', 'human-assign']);
  });

  test('cancel closes modal', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-create-chat');
    const modal = page.locator('#create-chat-modal');
    await expect(modal).toHaveClass(/visible/);
    await page.click('#modal-cancel-btn');
    await expect(modal).not.toHaveClass(/visible/);
  });

  test('clicking backdrop closes modal', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-create-chat');
    const modal = page.locator('#create-chat-modal');
    await expect(modal).toHaveClass(/visible/);
    // Click the overlay backdrop area (outside the modal dialog)
    await page.evaluate(() => {
      const overlay = document.getElementById('create-chat-modal');
      overlay.click();
    });
    await expect(modal).not.toHaveClass(/visible/);
  });

  test('validation: title is required', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-create-chat');
    await page.click('#modal-create-btn');
    await expect(page.locator('#title-error')).toBeVisible();
  });

  test('validation: at least 2 participants required', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-create-chat');
    await page.fill('#chat-title', 'Test Chat');
    // Uncheck all but one
    const checkboxes = page.locator('#participant-checkboxes input:checked');
    const second = checkboxes.nth(1);
    await second.uncheck();
    await page.click('#modal-create-btn');
    await expect(page.locator('#participants-error')).toBeVisible();
  });

  test('successful creation adds new session to list', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const countBefore = await page.locator('.chat-session').count();
    await page.click('#btn-create-chat');
    await page.fill('#chat-title', 'New Discussion');
    await page.click('#modal-create-btn');
    const countAfter = await page.locator('.chat-session').count();
    expect(countAfter).toBe(countBefore + 1);
    await expect(page.locator('.chat-session').last().locator('.chat-session__title')).toHaveText('New Discussion');
  });
});

test.describe('Group Chat — Session Controls', () => {
  test('active session has pause and stop buttons', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const actions = page.locator('[data-session-id="session-1"] [data-action]');
    const types = await actions.evaluateAll(els => els.map(e => e.dataset.action));
    expect(types).toContain('pause');
    expect(types).toContain('stop');
  });

  test('idle session has start and delete buttons', async ({ page }) => {
    await page.goto(harness('group-chat-harness.html'));
    await page.waitForLoadState('networkidle');
    const actions = page.locator('[data-session-id="session-2"] [data-action]');
    const types = await actions.evaluateAll(els => els.map(e => e.dataset.action));
    expect(types).toContain('start');
    expect(types).toContain('delete');
  });
});
