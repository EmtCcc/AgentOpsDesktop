#!/usr/bin/env node

/**
 * Post-build smoke test for AgentOps Desktop.
 *
 * Validates the Electron .app bundle exists and has expected structure.
 * Run after `npm run build:dir` to catch packaging regressions early.
 *
 * Usage: node scripts/smoke-test.js [path-to-app]
 * Default: release/mac-arm64/AgentOps.app
 */

const fs = require('fs');
const path = require('path');

function findApp() {
  if (process.argv[2]) return process.argv[2];
  const releaseDir = path.join(__dirname, '..', 'release');
  // Auto-detect: release/mac-arm64/AgentOps.app or release/mac/AgentOps.app
  for (const sub of ['mac-arm64', 'mac']) {
    const p = path.join(releaseDir, sub, 'AgentOps.app');
    if (fs.existsSync(p)) return p;
  }
  // Fallback to default
  return path.join(releaseDir, 'mac-arm64', 'AgentOps.app');
}

const appPath = findApp();

let failures = 0;

function check(label, ok, detail) {
  const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} ${label}`);
  if (!ok) {
    failures++;
    if (detail) console.log(`    ${detail}`);
  }
}

function fileExists(p) {
  return fs.existsSync(p);
}

function fileSize(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function dirHasFiles(p, minCount = 1) {
  try {
    return fs.readdirSync(p).length >= minCount;
  } catch {
    return false;
  }
}

console.log(`\nSmoke testing: ${appPath}\n`);

// ── Bundle exists ──
check('App bundle exists', fileExists(appPath));

const contents = path.join(appPath, 'Contents');
const macos = path.join(contents, 'MacOS');
const resources = path.join(contents, 'Resources');

// ── Structure ──
check('Contents/ directory exists', fileExists(contents));
check('Contents/MacOS/ exists', fileExists(macos));
check('Contents/Resources/ exists', fileExists(resources));
check('Contents/Info.plist exists', fileExists(path.join(contents, 'Info.plist')));

// ── Info.plist content ──
const plistPath = path.join(contents, 'Info.plist');
if (fileExists(plistPath)) {
  const plist = fs.readFileSync(plistPath, 'utf8');
  check('Bundle ID is com.agentops.desktop', plist.includes('com.agentops.desktop'));
  check('Product name is AgentOps', plist.includes('AgentOps'));
}

// ── Executable ──
const execPath = path.join(macos, 'AgentOps');
check('Executable exists', fileExists(execPath));
if (fileExists(execPath)) {
  const size = fileSize(execPath);
  check('Executable size > 10KB', size > 10 * 1024, `actual: ${(size / 1024).toFixed(0)}KB`);
}

// ── Renderer assets ──
check(
  'Renderer index.html in Resources',
  fileExists(path.join(resources, 'app.asar')) ||
    fileExists(path.join(resources, 'app', 'src', 'renderer', 'index.html'))
);

// If unpacked app directory exists, check renderer directly
const unpackedRenderer = path.join(resources, 'app', 'src', 'renderer');
if (fileExists(unpackedRenderer)) {
  check('index.html exists', fileExists(path.join(unpackedRenderer, 'index.html')));
  check('app.js exists', fileExists(path.join(unpackedRenderer, 'app.js')));
  check('styles/ exists', dirHasFiles(path.join(unpackedRenderer, 'styles')));
}

// ── Asar check (packed builds) ──
const asarPath = path.join(resources, 'app.asar');
if (fileExists(asarPath)) {
  const size = fileSize(asarPath);
  check('app.asar size > 10KB', size > 10 * 1024, `actual: ${(size / 1024).toFixed(0)}KB`);
}

// ── Total bundle size sanity ──
function dirSize(p) {
  let total = 0;
  try {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(p, e.name);
      if (e.isDirectory()) total += dirSize(fp);
      else total += fs.statSync(fp).size;
    }
  } catch {}
  return total;
}

if (fileExists(appPath)) {
  const totalMB = dirSize(appPath) / (1024 * 1024);
  check(
    `Bundle size 50–500MB (${totalMB.toFixed(0)}MB)`,
    totalMB > 50 && totalMB < 500,
    totalMB <= 50 ? 'bundle suspiciously small' : 'bundle unexpectedly large'
  );
}

// ── Result ──
console.log('');
if (failures > 0) {
  console.log(`\x1b[31m${failures} smoke check(s) failed.\x1b[0m\n`);
  process.exit(1);
} else {
  console.log('\x1b[32mAll smoke checks passed.\x1b[0m\n');
}
