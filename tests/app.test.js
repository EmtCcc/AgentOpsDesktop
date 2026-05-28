import { describe, it, expect } from 'vitest';

describe('package.json', () => {
  const pkg = require('../package.json');

  it('has correct app metadata', () => {
    expect(pkg.name).toBe('agentops-desktop');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.main).toBe('dist/main/index.js');
    expect(pkg.private).toBe(true);
  });

  it('has required scripts', () => {
    expect(pkg.scripts.start).toBeDefined();
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
  });

  it('has electron as devDependency', () => {
    expect(pkg.devDependencies.electron).toBeDefined();
  });

  it('has electron-builder config', () => {
    expect(pkg.build).toBeDefined();
    expect(pkg.build.appId).toBe('com.agentops.desktop');
    expect(pkg.build.productName).toBe('AgentOps');
  });

  it('has electron-updater for auto-update', () => {
    expect(pkg.dependencies['electron-updater']).toBeDefined();
  });

  it('publishes to GitHub releases', () => {
    expect(pkg.build.publish.provider).toBe('github');
  });
});

describe('source structure', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '..');

  it('has main process entry', () => {
    expect(fs.existsSync(path.join(root, 'src/main/index.js'))).toBe(true);
  });

  it('has preload script', () => {
    expect(fs.existsSync(path.join(root, 'src/main/preload.js'))).toBe(true);
  });

  it('has renderer HTML', () => {
    expect(fs.existsSync(path.join(root, 'src/renderer/index.html'))).toBe(true);
  });

  it('has CI workflow', () => {
    expect(fs.existsSync(path.join(root, '.github/workflows/ci.yml'))).toBe(true);
  });

  it('has macOS entitlements', () => {
    expect(fs.existsSync(path.join(root, 'build/entitlements.mac.plist'))).toBe(true);
  });
});
