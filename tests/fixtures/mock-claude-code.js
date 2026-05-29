#!/usr/bin/env node
'use strict';

/**
 * Mock Claude Code CLI for adapter testing.
 *
 * Simulates `claude --output-format stream-json` output.
 *
 * Usage:
 *   mock-claude-code.js --version              → print version, exit 0
 *   mock-claude-code.js --health               → exit 0
 *   mock-claude-code.js --fail                 → exit 1
 *   mock-claude-code.js --hang                 → stay alive until SIGTERM
 *   mock-claude-code.js --stream [--session X] → emit stream-json events
 *   mock-claude-code.js --stream-error         → emit error event, exit 1
 *   mock-claude-code.js --echo-args [args...]  → echo parsed args as JSON
 */

const args = process.argv.slice(2);

// --version
if (args.includes('--version')) {
  process.stdout.write('mock-claude-code 1.0.0\n');
  process.exit(0);
}

// --health
if (args.includes('--health')) {
  process.exit(0);
}

// --fail
if (args.includes('--fail')) {
  process.stderr.write('mock failure\n');
  process.exit(1);
}

// --hang
if (args.includes('--hang')) {
  process.on('SIGTERM', () => process.exit(0));
  setInterval(() => {}, 60_000);
  return;
}

// --echo-args: dump parsed CLI args as JSON (for argument verification)
if (args.includes('--echo-args')) {
  const filtered = args.filter((a) => a !== '--echo-args');
  process.stdout.write(JSON.stringify({ args: filtered }) + '\n');
  process.exit(0);
}

// --stream-error: emit an error event then exit 1
if (args.includes('--stream-error')) {
  process.stdout.write(JSON.stringify({
    type: 'error',
    error: { type: 'overloaded', message: 'Rate limited' },
  }) + '\n');
  process.exit(1);
}

// --stream: emit realistic Claude Code stream-json events
if (args.includes('--stream')) {
  const sessionIdx = args.indexOf('--session');
  const sessionId = sessionIdx !== -1 ? args[sessionIdx + 1] : 'sess_mock_abc123';
  const modelIdx = args.indexOf('--model');
  const model = modelIdx !== -1 ? args[modelIdx + 1] : 'claude-sonnet-4-6';

  // Extract the prompt (last non-flag arg that isn't a flag value)
  const prompt = args.filter((a) => !a.startsWith('--') && a !== sessionId && a !== model)
    .pop() || 'default prompt';

  // 1. System init event
  process.stdout.write(JSON.stringify({
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    model,
    tools: ['Read', 'Write', 'Bash'],
    permissionMode: 'default',
  }) + '\n');

  // 2. Assistant message (content block)
  process.stdout.write(JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: `Processing: ${prompt}` },
      ],
    },
    cost_usd: 0.001,
  }) + '\n');

  // 3. Second assistant message
  process.stdout.write(JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Done.' },
      ],
    },
    cost_usd: 0.002,
  }) + '\n');

  // 4. Result event
  process.stdout.write(JSON.stringify({
    type: 'result',
    subtype: 'success',
    result: `Completed: ${prompt}`,
    session_id: sessionId,
    cost_usd: 0.003,
    duration_ms: 1500,
    num_turns: 2,
    total_cost_usd: 0.006,
  }) + '\n');

  process.exit(0);
}

// Default: print help
process.stdout.write('mock-claude-code: use --stream, --version, --health, --fail, --hang\n');
process.exit(0);
