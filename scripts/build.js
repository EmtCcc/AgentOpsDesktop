#!/usr/bin/env node

/**
 * Build script for AgentOps Desktop.
 *
 * Bundles the main process, preload script, and renderer into dist/
 * using esbuild. Static assets (HTML, CSS, JSON) are copied as-is.
 *
 * Usage:
 *   node scripts/build.js          # production build
 *   node scripts/build.js --watch   # watch mode (rebuilds on change)
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WATCH = process.argv.includes('--watch');

/** Clean dist/ */
function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
}

/** Copy static renderer assets to dist/renderer/ */
function copyRendererAssets() {
  const srcDir = path.join(ROOT, 'src', 'renderer');
  const outDir = path.join(DIST, 'renderer');

  fs.mkdirSync(outDir, { recursive: true });

  // Copy index.html
  fs.copyFileSync(path.join(srcDir, 'index.html'), path.join(outDir, 'index.html'));

  // Copy styles directory
  const stylesSrc = path.join(srcDir, 'styles');
  const stylesOut = path.join(outDir, 'styles');
  if (fs.existsSync(stylesSrc)) {
    fs.mkdirSync(stylesOut, { recursive: true });
    for (const file of fs.readdirSync(stylesSrc)) {
      fs.copyFileSync(path.join(stylesSrc, file), path.join(stylesOut, file));
    }
  }

  // Copy redirects.json
  const redirectsSrc = path.join(srcDir, 'redirects.json');
  if (fs.existsSync(redirectsSrc)) {
    fs.copyFileSync(redirectsSrc, path.join(outDir, 'redirects.json'));
  }
}

/** Main process bundle config */
const mainConfig = {
  entryPoints: [path.join(ROOT, 'src', 'main', 'index.js')],
  bundle: true,
  outfile: path.join(DIST, 'main', 'index.js'),
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external: [
    'electron',
    'better-sqlite3',
    'electron-updater',
  ],
};

/** Preload script bundle config */
const preloadConfig = {
  entryPoints: [path.join(ROOT, 'src', 'main', 'preload.js')],
  bundle: true,
  outfile: path.join(DIST, 'main', 'preload.js'),
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external: ['electron'],
};

/** Renderer bundle config */
const rendererConfig = {
  entryPoints: [path.join(ROOT, 'src', 'renderer', 'app.js')],
  bundle: true,
  outfile: path.join(DIST, 'renderer', 'app.js'),
  platform: 'browser',
  target: 'es2022',
  format: 'iife',
  sourcemap: true,
  jsx: 'automatic',
  jsxImportSource: 'react',
};

async function build() {
  clean();

  if (WATCH) {
    const [mainCtx, preloadCtx, rendererCtx] = await Promise.all([
      esbuild.context(mainConfig),
      esbuild.context(preloadConfig),
      esbuild.context(rendererConfig),
    ]);

    await Promise.all([
      mainCtx.watch(),
      preloadCtx.watch(),
      rendererCtx.watch(),
    ]);

    copyRendererAssets();
    console.log('Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(mainConfig),
      esbuild.build(preloadConfig),
      esbuild.build(rendererConfig),
    ]);

    copyRendererAssets();
    console.log('Build complete → dist/');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
