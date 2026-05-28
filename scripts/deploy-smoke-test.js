#!/usr/bin/env node

/**
 * Post-deployment smoke test for AgentOps Desktop.
 *
 * Validates that the GitHub release was created successfully and contains
 * the expected artifacts for all platforms. Run after the deploy workflow
 * publishes to catch release regressions.
 *
 * Usage: node scripts/deploy-smoke-test.js [--tag v0.1.0]
 * Requires: GH_TOKEN environment variable (or gh CLI authenticated)
 */

const { execSync } = require('child_process');

const REPO = 'agentops/AgentOpsDesktop';

// Expected artifacts per platform
const EXPECTED_ARTIFACTS = {
  mac: [
    { pattern: /AgentOps-.*\.dmg$/, label: 'macOS DMG' },
    { pattern: /AgentOps-.*-mac\.zip$/, label: 'macOS ZIP' },
    { pattern: /latest-mac\.yml$/, label: 'macOS update manifest' },
  ],
  linux: [
    { pattern: /AgentOps-.*\.AppImage$/, label: 'Linux AppImage' },
    { pattern: /AgentOps-.*\.deb$/, label: 'Linux DEB' },
    { pattern: /latest-linux\.yml$/, label: 'Linux update manifest' },
  ],
  windows: [
    { pattern: /AgentOps-.*\.exe$/, label: 'Windows installer' },
    { pattern: /AgentOps-.*-win\.zip$/, label: 'Windows ZIP' },
    { pattern: /latest\.yml$/, label: 'Windows update manifest' },
  ],
};

function getTag() {
  const arg = process.argv.indexOf('--tag');
  if (arg !== -1 && process.argv[arg + 1]) {
    return process.argv[arg + 1];
  }
  // Try to get latest release tag
  try {
    return execSync(`gh release view --repo ${REPO} --json tagName -q .tagName`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getReleaseAssets(tag) {
  try {
    const json = execSync(
      `gh release view "${tag}" --repo ${REPO} --json assets -q '.assets[].name'`,
      { encoding: 'utf8' }
    );
    return json.trim().split('\n').filter(Boolean);
  } catch (err) {
    console.error(`  ✗ Failed to fetch release ${tag}: ${err.message}`);
    return null;
  }
}

function check(label, ok, detail) {
  const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} ${label}`);
  if (!ok && detail) console.log(`    ${detail}`);
  return ok;
}

console.log('\nDeployment Smoke Test\n');

const tag = getTag();
if (!tag) {
  console.error('✗ Could not determine release tag. Pass --tag <version> or authenticate gh CLI.');
  process.exit(1);
}

console.log(`Checking release: ${tag}\n`);

const assets = getReleaseAssets(tag);
if (!assets) {
  console.error('✗ Could not fetch release assets.');
  process.exit(1);
}

console.log(`Found ${assets.length} asset(s) in release.\n`);

let failures = 0;

// Check each platform's expected artifacts
for (const [platform, expected] of Object.entries(EXPECTED_ARTIFACTS)) {
  console.log(`[${platform.toUpperCase()}]`);

  for (const { pattern, label } of expected) {
    const found = assets.some((name) => pattern.test(name));
    if (!check(label, found, `Expected asset matching ${pattern}`)) {
      failures++;
    }
  }
  console.log('');
}

// Check that update manifests have non-zero size (basic sanity)
const manifestAssets = assets.filter((a) => a.endsWith('.yml') && a.includes('latest'));
if (manifestAssets.length > 0) {
  console.log('[MANIFESTS]');
  for (const manifest of manifestAssets) {
    try {
      // Download and check manifest is valid YAML with a version field
      const content = execSync(
        `gh release download "${tag}" --repo ${REPO} --pattern "${manifest}" --output -`,
        { encoding: 'utf8', maxBuffer: 1024 * 1024 }
      );
      const hasVersion = content.includes('version:');
      check(`${manifest} has version field`, hasVersion);
      if (!hasVersion) failures++;
    } catch (err) {
      check(`${manifest} downloadable`, false, err.message);
      failures++;
    }
  }
  console.log('');
}

// Summary
if (failures > 0) {
  console.log(`\x1b[31m${failures} deployment smoke check(s) failed.\x1b[0m\n`);
  process.exit(1);
} else {
  console.log('\x1b[32mAll deployment smoke checks passed.\x1b[0m\n');
}
