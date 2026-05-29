/**
 * Phase 2 Round 1 回归测试 — CMPAAA-318 CLI 自动检测
 *
 * 覆盖：
 *   - PATH 扫描准确性
 *   - 二进制验证 (which mock)
 *   - detectAndRegister 注册逻辑
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KNOWN_CLIS, scanForClis, detectAndRegister } from '../../src/main/cli-scanner.js';

// ─── CLI Scanner ────────────────────────────────────────────────

describe('CLI Scanner (CMPAAA-318)', () => {
  describe('KNOWN_CLIS', () => {
    it('defines all expected CLI entries', () => {
      expect(KNOWN_CLIS).toHaveLength(5);
      const ids = KNOWN_CLIS.map((c) => c.id);
      expect(ids).toContain('claude');
      expect(ids).toContain('codex');
      expect(ids).toContain('gemini');
      expect(ids).toContain('opencode');
      expect(ids).toContain('cursor-agent');
    });

    it('each entry has required fields', () => {
      for (const cli of KNOWN_CLIS) {
        expect(cli).toHaveProperty('id');
        expect(cli).toHaveProperty('cmd');
        expect(cli).toHaveProperty('name');
        expect(cli).toHaveProperty('description');
      }
    });
  });

  describe('scanForClis', () => {
    it('returns detected CLIs with execPath', async () => {
      const mockWhich = vi.fn((cmd) => {
        if (cmd === 'claude') return Promise.resolve('/usr/local/bin/claude');
        if (cmd === 'codex') return Promise.resolve('/usr/local/bin/codex');
        return Promise.resolve(null);
      });

      const results = await scanForClis(mockWhich);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('claude');
      expect(results[0].execPath).toBe('/usr/local/bin/claude');
      expect(results[1].id).toBe('codex');
    });

    it('returns empty when no CLIs found', async () => {
      const mockWhich = vi.fn(() => Promise.resolve(null));
      const results = await scanForClis(mockWhich);
      expect(results).toHaveLength(0);
    });

    it('calls which for every known CLI', async () => {
      const mockWhich = vi.fn(() => Promise.resolve(null));
      await scanForClis(mockWhich);
      expect(mockWhich).toHaveBeenCalledTimes(KNOWN_CLIS.length);
    });

    it('filters out null results (CLI not found)', async () => {
      const mockWhich = vi.fn((cmd) => {
        return Promise.resolve(cmd === 'claude' ? '/bin/claude' : null);
      });
      const results = await scanForClis(mockWhich);
      expect(results).toHaveLength(1);
      expect(results[0].cmd).toBe('claude');
    });
  });

  describe('detectAndRegister', () => {
    let mockRepo;

    beforeEach(() => {
      mockRepo = {
        getByType: vi.fn(() => null),
        create: vi.fn(),
      };
    });

    it('registers detected CLIs as generic-cli adapters', async () => {
      const mockWhich = vi.fn((cmd) => {
        if (cmd === 'claude') return Promise.resolve('/bin/claude');
        return Promise.resolve(null);
      });

      const result = await detectAndRegister(mockRepo, { whichFn: mockWhich });
      expect(result.registered).toContain('cli-claude');
      expect(result.detected).toContain('cli-claude');
      expect(result.skipped).toHaveLength(0);
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'cli-claude',
        name: 'Claude Code',
        enabled: true,
        config: expect.objectContaining({
          execPath: '/bin/claude',
        }),
      }));
    });

    it('skips existing adapters', async () => {
      const mockWhich = vi.fn((cmd) => {
        if (cmd === 'claude') return Promise.resolve('/bin/claude');
        return Promise.resolve(null);
      });
      mockRepo.getByType.mockImplementation((type) => {
        if (type === 'cli-claude') return { type: 'cli-claude' };
        return null;
      });

      const result = await detectAndRegister(mockRepo, { whichFn: mockWhich });
      expect(result.skipped).toContain('cli-claude');
      expect(result.registered).toHaveLength(0);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('dryRun does not call create', async () => {
      const mockWhich = vi.fn((cmd) => {
        if (cmd === 'codex') return Promise.resolve('/bin/codex');
        return Promise.resolve(null);
      });

      const result = await detectAndRegister(mockRepo, { whichFn: mockWhich, dryRun: true });
      expect(result.registered).toContain('cli-codex');
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('returns all three lists: detected, registered, skipped', async () => {
      const mockWhich = vi.fn((cmd) => {
        if (cmd === 'claude') return Promise.resolve('/bin/claude');
        if (cmd === 'codex') return Promise.resolve('/bin/codex');
        return Promise.resolve(null);
      });
      mockRepo.getByType.mockImplementation((type) => {
        if (type === 'cli-claude') return { type: 'cli-claude' };
        return null;
      });

      const result = await detectAndRegister(mockRepo, { whichFn: mockWhich });
      expect(result.detected).toHaveLength(2);
      expect(result.skipped).toContain('cli-claude');
      expect(result.registered).toContain('cli-codex');
    });
  });
});
