'use strict';

const { spawn } = require('child_process');

/**
 * Well-known CLI agents to detect on PATH.
 * Each entry maps a logical name to the executable command.
 */
const KNOWN_CLIS = [
  { id: 'claude',        cmd: 'claude',        name: 'Claude Code',      description: 'Anthropic Claude CLI' },
  { id: 'codex',         cmd: 'codex',         name: 'Codex CLI',        description: 'OpenAI Codex CLI' },
  { id: 'gemini',        cmd: 'gemini',        name: 'Gemini CLI',       description: 'Google Gemini CLI' },
  { id: 'opencode',      cmd: 'opencode',      name: 'OpenCode',         description: 'OpenCode CLI agent' },
  { id: 'cursor-agent',  cmd: 'cursor-agent',  name: 'Cursor Agent',     description: 'Cursor agent CLI' },
];

/**
 * Resolve a command to its full path via `which`.
 * Returns the resolved path string or null.
 */
function which(cmd) {
  return new Promise((resolve) => {
    const proc = spawn('which', [cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.on('close', (code) => {
      resolve(code === 0 ? stdout.trim() : null);
    });
    proc.on('error', () => resolve(null));
  });
}

/**
 * Scan PATH for all known CLI agents.
 * @param {function} [whichFn] — override for testing (default: built-in `which`)
 * @returns {Promise<Array<{ id, cmd, name, description, execPath }>>}
 */
async function scanForClis(whichFn = which) {
  const results = await Promise.all(
    KNOWN_CLIS.map(async (cli) => {
      const execPath = await whichFn(cli.cmd);
      return execPath ? { ...cli, execPath } : null;
    }),
  );
  return results.filter(Boolean);
}

/**
 * Persist detected CLIs into adapter_configs.
 * Each detected CLI becomes a `generic-cli` adapter with type `cli-{id}`.
 * Existing configs (matching type) are NOT overwritten.
 *
 * @param {import('./repositories/adapter.repository').AdapterRepository} adapterRepo
 * @param {{ dryRun?: boolean, whichFn?: function }} [opts]
 * @returns {Promise<{ detected: string[], registered: string[], skipped: string[] }>}
 */
async function detectAndRegister(adapterRepo, opts = {}) {
  const detected = await scanForClis(opts.whichFn);
  const registered = [];
  const skipped = [];
  const detectedIds = [];

  for (const cli of detected) {
    const type = `cli-${cli.id}`;
    detectedIds.push(type);

    const existing = adapterRepo.getByType(type);
    if (existing) {
      skipped.push(type);
      continue;
    }

    if (opts.dryRun) {
      registered.push(type);
      continue;
    }

    adapterRepo.create({
      type,
      name: cli.name,
      classPath: null,
      config: { execPath: cli.execPath, description: cli.description },
      enabled: true,
    });
    registered.push(type);
  }

  return { detected: detectedIds, registered, skipped };
}

module.exports = { KNOWN_CLIS, which, scanForClis, detectAndRegister };
