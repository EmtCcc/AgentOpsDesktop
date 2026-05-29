#!/usr/bin/env node
'use strict';

/**
 * Mock CLI binary for adapter testing.
 *
 * Usage:
 *   mock-cli.js --health          → exit 0, print "ok"
 *   mock-cli.js --fail            → exit 1, print "mock failure"
 *   mock-cli.js --hang            → stay alive until SIGTERM
 *   mock-cli.js --timeout N       → exit after N ms
 *   mock-cli.js [args...]         → exit 0, echo args
 *   mock-cli.js (no args)         → exit 0, print "mock-cli ready"
 */

const args = process.argv.slice(2);

// --health: simulate a healthy process
if (args.includes('--health')) {
  process.stdout.write('ok\n');
  process.exit(0);
}

// --fail: simulate failure
if (args.includes('--fail')) {
  process.stderr.write('mock failure\n');
  process.exit(1);
}

// --hang: stay alive until killed (for spawn/kill tests)
if (args.includes('--hang')) {
  // Keep the process alive; respond to SIGTERM gracefully
  process.on('SIGTERM', () => process.exit(0));
  setInterval(() => {}, 60_000);
  return;
}

// --timeout N: stay alive for N ms then exit
const timeoutIdx = args.indexOf('--timeout');
if (timeoutIdx !== -1) {
  const ms = parseInt(args[timeoutIdx + 1], 10) || 1000;
  setTimeout(() => process.exit(0), ms);
  return;
}

// Default: echo args
if (args.length > 0) {
  process.stdout.write(args.join(' ') + '\n');
} else {
  process.stdout.write('mock-cli ready\n');
}
process.exit(0);
