const { test, expect } = require('@playwright/test');
const path = require('path');

const harness = (name) => `file://${path.resolve(__dirname, name)}`;

test.describe('Squad Load Balancing — Page Structure', () => {
  test('page header shows title', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__title')).toHaveText('Squad Load Balancing');
  });

  test('page header shows description', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-header__desc')).toHaveText('Task distribution across agent pool');
  });

  test('Auto-Assign and Reset buttons are visible', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#btn-assign-all')).toBeVisible();
    await expect(page.locator('#btn-reset')).toBeVisible();
  });

  test('overload threshold is displayed', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#threshold')).toHaveText('3');
  });
});

test.describe('Squad Load Balancing — Agent Pool', () => {
  test('displays all agents', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    const cards = page.locator('.agent-card');
    expect(await cards.count()).toBe(4);
  });

  test('agent cards show names and roles', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-agent-id="agent-1"] .agent-card__name')).toHaveText('Claude Code');
    await expect(page.locator('[data-agent-id="agent-1"] .agent-card__role')).toHaveText('engineer');
    await expect(page.locator('[data-agent-id="agent-3"] .agent-card__role')).toHaveText('designer');
  });

  test('idle agent shows green status dot', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-agent-id="agent-1"] .agent-card__status')).toHaveClass(/idle/);
  });

  test('busy agent shows yellow status dot', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-agent-id="agent-3"] .agent-card__status')).toHaveClass(/busy/);
  });

  test('overloaded agent shows red status dot', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-agent-id="agent-4"] .agent-card__status')).toHaveClass(/overloaded/);
  });

  test('workload bars reflect current load', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-agent-id="agent-1"] .workload-count')).toHaveText('0/3');
    await expect(page.locator('[data-agent-id="agent-4"] .workload-count')).toHaveText('3/3');
  });
});

test.describe('Squad Load Balancing — Task Queue', () => {
  test('displays unassigned tasks', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    const tasks = page.locator('.task-item');
    expect(await tasks.count()).toBe(5);
  });

  test('tasks show role tags', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    const firstTaskRole = page.locator('[data-task-id="task-1"] .task-item__role');
    await expect(firstTaskRole).toHaveText('engineer');
  });

  test('tasks initially show as unassigned', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    const assignees = page.locator('.task-item__assignee');
    const count = await assignees.count();
    for (let i = 0; i < count; i++) {
      await expect(assignees.nth(i)).toHaveText('Unassigned');
    }
  });
});

test.describe('Squad Load Balancing — Strategy Selection', () => {
  test('default strategy is lowest-workload', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-strategy="lowest-workload"]')).toHaveClass(/btn--active/);
  });

  test('clicking strategy button changes active strategy', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('[data-strategy="round-robin"]');
    await expect(page.locator('[data-strategy="round-robin"]')).toHaveClass(/btn--active/);
    await expect(page.locator('[data-strategy="lowest-workload"]')).not.toHaveClass(/btn--active/);
  });

  test('all three strategies are available', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-strategy="lowest-workload"]')).toBeVisible();
    await expect(page.locator('[data-strategy="round-robin"]')).toBeVisible();
    await expect(page.locator('[data-strategy="role-first"]')).toBeVisible();
  });
});

test.describe('Squad Load Balancing — Auto-Assign', () => {
  test('auto-assign distributes tasks to available agents', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-assign-all');

    // All tasks should be assigned
    const unassigned = page.locator('.task-item__assignee:text("Unassigned")');
    expect(await unassigned.count()).toBe(0);
  });

  test('auto-assign skips overloaded agents', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-assign-all');

    // Agent-4 (overloaded) should not get new tasks
    const agent4Card = page.locator('[data-agent-id="agent-4"]');
    const workload = await agent4Card.getAttribute('data-workload');
    expect(parseInt(workload)).toBeLessThanOrEqual(3); // Should not exceed threshold
  });

  test('auto-assign prefers lowest workload agent', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-assign-all');

    // Agent-1 starts at 0 workload, should get tasks first
    const agent1Workload = parseInt(await page.locator('[data-agent-id="agent-1"]').getAttribute('data-workload'));
    const agent2Workload = parseInt(await page.locator('[data-agent-id="agent-2"]').getAttribute('data-workload'));
    // Agent-1 should have received at least as many tasks as agent-2 (started lower)
    expect(agent1Workload).toBeGreaterThanOrEqual(agent2Workload - 1);
  });

  test('auto-assign updates workload bars', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    const before = await page.locator('[data-agent-id="agent-1"] .workload-count').textContent();
    await page.click('#btn-assign-all');
    const after = await page.locator('[data-agent-id="agent-1"] .workload-count').textContent();
    expect(after).not.toBe(before);
  });

  test('auto-assign updates distribution chart', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-assign-all');
    // At least one agent should have a non-zero count
    const counts = page.locator('.distribution-bar__count');
    const values = await counts.evaluateAll(els => els.map(e => parseInt(e.textContent)));
    expect(values.some(v => v > 0)).toBe(true);
  });
});

test.describe('Squad Load Balancing — Role-First Strategy', () => {
  test('role-first assigns engineer tasks to engineer agents', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('[data-strategy="role-first"]');
    await page.click('#btn-assign-all');

    // Engineer tasks should go to engineer agents
    const task1Assignee = await page.locator('[data-task-id="task-1"] .task-item__assignee').textContent();
    expect(task1Assignee).toContain('Assigned');
    // task-1 is engineer role, should go to Claude Code or Codex Agent (engineers)
    expect(task1Assignee).toMatch(/Claude Code|Codex Agent/);
  });

  test('role-first assigns designer tasks to designer agents', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('[data-strategy="role-first"]');
    await page.click('#btn-assign-all');

    const task3Assignee = await page.locator('[data-task-id="task-3"] .task-item__assignee').textContent();
    // task-3 is designer role, should go to Gemini CLI (designer)
    expect(task3Assignee).toContain('Gemini CLI');
  });
});

test.describe('Squad Load Balancing — Reset', () => {
  test('reset clears all assignments', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-assign-all');
    await page.click('#btn-reset');

    const unassigned = page.locator('.task-item__assignee:text("Unassigned")');
    expect(await unassigned.count()).toBe(5);
  });

  test('reset restores agent workloads', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-assign-all');
    await page.click('#btn-reset');

    await expect(page.locator('[data-agent-id="agent-1"] .workload-count')).toHaveText('0/3');
    await expect(page.locator('[data-agent-id="agent-2"] .workload-count')).toHaveText('1/3');
  });

  test('reset clears distribution chart', async ({ page }) => {
    await page.goto(harness('squad-loadbalance-harness.html'));
    await page.waitForLoadState('networkidle');
    await page.click('#btn-assign-all');
    await page.click('#btn-reset');

    const counts = page.locator('.distribution-bar__count');
    const values = await counts.evaluateAll(els => els.map(e => parseInt(e.textContent)));
    expect(values.every(v => v === 0)).toBe(true);
  });
});
