const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Squad Dynamic Discovery — Page Structure', () => {
  test('page header shows title', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__title')).toHaveText('Squad Dynamic Discovery');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__desc')).toHaveText('Wildcard member slots and role-based resolution');
  });

  test('Resolve All button is visible', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#btn-resolve-all')).toBeVisible();
  });
});

test.describe('Squad Dynamic Discovery — Squad Configuration', () => {
  test('displays squad name and ID', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#squad-config')).toContainText('Backend Squad');
    await expect(page.locator('#squad-config')).toContainText('squad-001');
  });

  test('displays explicit members', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    const explicit = page.locator('[data-type="explicit"]');
    expect(await explicit.count()).toBe(1);
    await expect(explicit.first().locator('.member-row__agent')).toHaveText('Claude Code');
  });

  test('displays wildcard members with wildcard badge', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    const wildcards = page.locator('[data-type="wildcard"]');
    expect(await wildcards.count()).toBe(3);
    const badges = page.locator('.wildcard-badge');
    expect(await badges.count()).toBe(3);
  });

  test('wildcard members show agent as * (any)', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    const wildcardAgents = page.locator('[data-type="wildcard"] .member-row__agent');
    const count = await wildcardAgents.count();
    for (let i = 0; i < count; i++) {
      await expect(wildcardAgents.nth(i)).toContainText('* (any)');
    }
  });

  test('wildcard members have role tags', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    const engineerWildcards = page.locator('[data-type="wildcard"][data-wildcard-role="engineer"]');
    expect(await engineerWildcards.count()).toBe(2);
    const designerWildcards = page.locator('[data-type="wildcard"][data-wildcard-role="designer"]');
    expect(await designerWildcards.count()).toBe(1);
  });

  test('wildcard members start with pending status', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    const pendingStatuses = page.locator('[data-resolution="pending"]');
    expect(await pendingStatuses.count()).toBe(3);
  });

  test('explicit member shows resolved status', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    const explicit = page.locator('[data-type="explicit"]');
    await expect(explicit.locator('.member-row__status')).toContainText('Explicit member');
  });
});

test.describe('Squad Dynamic Discovery — Agent Registry', () => {
  test('displays available agents', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    const agents = page.locator('.agent-entry');
    expect(await agents.count()).toBe(5);
  });

  test('agents show name, role, and status', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-agent-id="agent-1"] .agent-entry__name')).toHaveText('Claude Code');
    await expect(page.locator('[data-agent-id="agent-1"] .agent-entry__role')).toHaveText('engineer');
  });

  test('idle agents have green status dot', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-agent-id="agent-1"] .agent-entry__status')).toHaveClass(/idle/);
    await expect(page.locator('[data-agent-id="agent-2"] .agent-entry__status')).toHaveClass(/idle/);
  });

  test('busy agents have yellow status dot', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-agent-id="agent-3"] .agent-entry__status')).toHaveClass(/busy/);
  });
});

test.describe('Squad Dynamic Discovery — Wildcard Resolution', () => {
  test('resolving assigns wildcard slots to matching agents', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-resolve-all');

    const resolved = page.locator('[data-resolution="resolved"]');
    expect(await resolved.count()).toBeGreaterThanOrEqual(1);
  });

  test('resolution excludes explicit squad members', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-resolve-all');

    // agent-1 (Claude Code) is explicit member, should not be assigned to wildcard
    const resolvedTo = page.locator('[data-resolved-to]');
    const texts = await resolvedTo.evaluateAll(els => els.map(e => e.textContent));
    const hasAgent1 = texts.some(t => t.includes('agent-1'));
    expect(hasAgent1).toBe(false);
  });

  test('resolution prefers lowest workload agent', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-resolve-all');

    // agent-2 (workload 0) should be preferred over agent-3 (workload 3) for engineer
    const firstResolved = page.locator('[data-type="wildcard"][data-wildcard-role="engineer"]').first().locator('[data-resolved-to]');
    const text = await firstResolved.textContent();
    expect(text).toContain('agent-2');
  });

  test('resolution skips overloaded agents', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-resolve-all');

    // agent-3 has workload 3 (at threshold), should be skipped
    const resolvedTo = page.locator('[data-resolved-to]');
    const texts = await resolvedTo.evaluateAll(els => els.map(e => e.textContent));
    const hasAgent3 = texts.some(t => t.includes('agent-3'));
    expect(hasAgent3).toBe(false);
  });

  test('resolution assigns different agents to different slots', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-resolve-all');

    // Two engineer wildcards should get two different agents
    const engineerResolved = page.locator('[data-type="wildcard"][data-wildcard-role="engineer"] [data-resolved-to]');
    const texts = await engineerResolved.evaluateAll(els => els.map(e => e.textContent).filter(t => t.length > 0));
    if (texts.length >= 2) {
      expect(texts[0]).not.toBe(texts[1]);
    }
  });

  test('successful resolution shows green result', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-resolve-all');
    const result = page.locator('#resolution-result');
    await expect(result).toBeVisible();
    await expect(result).toHaveClass(/resolution-result--/);
    await expect(result).toContainText('wildcard');
  });
});

test.describe('Squad Dynamic Discovery — Topic Wildcard Matching', () => {
  test('topic test section is visible', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.topic-test')).toBeVisible();
  });

  test('single wildcard * matches one segment', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#topic-subscription', 'agent.*.status');
    await page.fill('#topic-message', 'agent.worker.status');
    await page.click('#btn-test-topic');
    const result = page.locator('.topic-match').last();
    await expect(result).toContainText('MATCH');
    await expect(result.locator('.topic-match__result')).toHaveClass(/match/);
  });

  test('single wildcard * does not match multiple segments', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#topic-subscription', 'agent.*.status');
    await page.fill('#topic-message', 'agent.worker.sub.status');
    await page.click('#btn-test-topic');
    const result = page.locator('.topic-match').last();
    await expect(result).toContainText('NO MATCH');
  });

  test('multi-segment wildcard ** matches zero or more segments', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#topic-subscription', 'agent.**');
    await page.fill('#topic-message', 'agent.worker.status.update');
    await page.click('#btn-test-topic');
    const result = page.locator('.topic-match').last();
    await expect(result).toContainText('MATCH');
  });

  test('exact match works', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#topic-subscription', 'agent.status');
    await page.fill('#topic-message', 'agent.status');
    await page.click('#btn-test-topic');
    const result = page.locator('.topic-match').last();
    await expect(result).toContainText('MATCH');
  });

  test('non-matching topics show no match', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.fill('#topic-subscription', 'agent.status');
    await page.fill('#topic-message', 'task.complete');
    await page.click('#btn-test-topic');
    const result = page.locator('.topic-match').last();
    await expect(result).toContainText('NO MATCH');
    await expect(result.locator('.topic-match__result')).toHaveClass(/no-match/);
  });

  test('Run All Topic Tests executes predefined tests', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-run-topic-tests');
    const results = page.locator('.topic-match');
    expect(await results.count()).toBe(7);
  });

  test('all predefined topic tests pass', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-run-topic-tests');
    const passes = page.locator('[data-test-result="pass"]');
    expect(await passes.count()).toBe(7);
    const failures = page.locator('[data-test-result="fail"]');
    expect(await failures.count()).toBe(0);
  });

  test('topic test input fields have default values', async ({ page }) => {
    await page.goto(harness('squad-wildcard-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#topic-subscription')).toHaveValue('agent.*.status');
    await expect(page.locator('#topic-message')).toHaveValue('agent.worker.status');
  });
});
