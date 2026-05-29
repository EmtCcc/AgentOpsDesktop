import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KNOWN_CLIS, scanForClis, detectAndRegister } from '../src/main/cli-scanner.js';

describe('cli-scanner', () => {
  describe('KNOWN_CLIS', () => {
    it('defines exactly 5 known CLIs', () => {
      expect(KNOWN_CLIS).toHaveLength(5);
    });

    it('each CLI has id, cmd, name, description', () => {
      for (const cli of KNOWN_CLIS) {
        expect(cli).toHaveProperty('id');
        expect(cli).toHaveProperty('cmd');
        expect(cli).toHaveProperty('name');
        expect(cli).toHaveProperty('description');
      }
    });

    it('covers claude, codex, gemini, opencode, cursor-agent', () => {
      const ids = KNOWN_CLIS.map((c) => c.id);
      expect(ids).toEqual(expect.arrayContaining(['claude', 'codex', 'gemini', 'opencode', 'cursor-agent']));
    });
  });

  describe('scanForClis', () => {
    it('returns only detected CLIs', async () => {
      const whichFn = vi.fn((cmd) => {
        const map = { claude: '/usr/local/bin/claude', gemini: '/usr/bin/gemini' };
        return Promise.resolve(map[cmd] || null);
      });
      const result = await scanForClis(whichFn);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual(['claude', 'gemini']);
      expect(result[0].execPath).toBe('/usr/local/bin/claude');
      expect(result[1].execPath).toBe('/usr/bin/gemini');
    });

    it('returns empty array when no CLIs found', async () => {
      const whichFn = vi.fn(() => Promise.resolve(null));
      const result = await scanForClis(whichFn);
      expect(result).toHaveLength(0);
    });

    it('returns all 5 when all are installed', async () => {
      const whichFn = vi.fn((cmd) => Promise.resolve(`/usr/local/bin/${cmd}`));
      const result = await scanForClis(whichFn);
      expect(result).toHaveLength(5);
    });

    it('calls whichFn for each known CLI', async () => {
      const whichFn = vi.fn(() => Promise.resolve(null));
      await scanForClis(whichFn);
      expect(whichFn).toHaveBeenCalledTimes(5);
      for (const cli of KNOWN_CLIS) {
        expect(whichFn).toHaveBeenCalledWith(cli.cmd);
      }
    });
  });

  describe('detectAndRegister', () => {
    function makeAdapterRepo(existing = []) {
      const store = new Map(existing.map((e) => [e.type, e]));
      return {
        getByType: vi.fn((type) => store.get(type) || null),
        create: vi.fn((adapter) => {
          store.set(adapter.type, adapter);
          return adapter;
        }),
      };
    }

    it('registers detected CLIs that do not exist yet', async () => {
      const whichFn = vi.fn((cmd) => {
        const map = { claude: '/usr/local/bin/claude', codex: '/usr/local/bin/codex' };
        return Promise.resolve(map[cmd] || null);
      });
      const repo = makeAdapterRepo();
      const result = await detectAndRegister(repo, { whichFn });

      expect(result.detected).toEqual(['cli-claude', 'cli-codex']);
      expect(result.registered).toEqual(['cli-claude', 'cli-codex']);
      expect(result.skipped).toEqual([]);
      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cli-claude', name: 'Claude Code', enabled: true }),
      );
    });

    it('does not overwrite existing configs', async () => {
      const whichFn = vi.fn((cmd) => {
        const map = { claude: '/usr/local/bin/claude', gemini: '/usr/local/bin/gemini' };
        return Promise.resolve(map[cmd] || null);
      });
      const repo = makeAdapterRepo([{ type: 'cli-claude', id: 'existing-id' }]);
      const result = await detectAndRegister(repo, { whichFn });

      expect(result.registered).toEqual(['cli-gemini']);
      expect(result.skipped).toEqual(['cli-claude']);
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(repo.getByType).toHaveBeenCalledWith('cli-claude');
    });

    it('handles empty detection gracefully', async () => {
      const whichFn = vi.fn(() => Promise.resolve(null));
      const repo = makeAdapterRepo();
      const result = await detectAndRegister(repo, { whichFn });

      expect(result.detected).toEqual([]);
      expect(result.registered).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('supports dryRun mode', async () => {
      const whichFn = vi.fn((cmd) => {
        return cmd === 'claude' ? Promise.resolve('/usr/local/bin/claude') : Promise.resolve(null);
      });
      const repo = makeAdapterRepo();
      const result = await detectAndRegister(repo, { whichFn, dryRun: true });

      expect(result.registered).toEqual(['cli-claude']);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('stores execPath and description in config', async () => {
      const whichFn = vi.fn((cmd) => {
        return cmd === 'claude' ? Promise.resolve('/usr/local/bin/claude') : Promise.resolve(null);
      });
      const repo = makeAdapterRepo();
      await detectAndRegister(repo, { whichFn });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'cli-claude',
        name: 'Claude Code',
        classPath: null,
        config: { execPath: '/usr/local/bin/claude', description: 'Anthropic Claude CLI' },
        enabled: true,
      }));
    });
  });
});
