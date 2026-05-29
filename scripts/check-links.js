#!/usr/bin/env node
'use strict';

/**
 * Link checker for AgentOps docs-site.
 *
 * Validates:
 *  1. Internal links (markdown cross-references, config nav/sidebar) resolve to real files
 *  2. External links are reachable (skipped when no network)
 *  3. Redirect map entries return expected status codes
 *
 * Usage: node scripts/check-links.js
 * Exit: 0 = all checks pass, 1 = failures found, 2 = fatal error
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DOCS_DIR = path.resolve(__dirname, '..', 'docs-site');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TIMEOUT_MS = 10000;
const CONCURRENCY = 5;

// Old URL -> expected redirect target (populate when legacy URLs exist)
const REDIRECT_MAP = {};

const results = {
  internal: { total: 0, ok: 0, broken: [] },
  external: { total: 0, ok: 0, broken: [], unreachable: false },
  redirects: { total: 0, ok: 0, broken: [] },
};

function collectMarkdownFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.vitepress') {
      files.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function extractLinks(filePath, content) {
  const links = [];
  const relativePath = path.relative(PROJECT_ROOT, filePath);

  // Markdown links: [text](url)
  const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdLinkRegex.exec(content)) !== null) {
    const url = match[2].split('#')[0].split('?')[0];
    if (!url) continue;
    links.push({ url, line: content.substring(0, match.index).split('\n').length, source: relativePath });
  }

  // HTML href: href="url"
  const hrefRegex = /href=["']([^"']+)["']/g;
  while ((match = hrefRegex.exec(content)) !== null) {
    const url = match[1].split('#')[0].split('?')[0];
    if (!url) continue;
    links.push({ url, line: content.substring(0, match.index).split('\n').length, source: relativePath });
  }

  // YAML/config link properties
  const linkInConfig = /link:\s*['"]?([^'")\s,]+)/g;
  while ((match = linkInConfig.exec(content)) !== null) {
    const url = match[1].split('#')[0].split('?')[0];
    if (!url) continue;
    links.push({ url, line: content.substring(0, match.index).split('\n').length, source: relativePath });
  }

  return links;
}

function resolveInternalLink(url, sourceFile) {
  let cleanUrl = url.startsWith('/') ? url.slice(1) : url;
  cleanUrl = cleanUrl.replace(/\/$/, '');

  const mdPath = path.join(DOCS_DIR, cleanUrl + '.md');
  if (fs.existsSync(mdPath)) return { ok: true, resolved: mdPath };

  const indexPath = path.join(DOCS_DIR, cleanUrl, 'index.md');
  if (fs.existsSync(indexPath)) return { ok: true, resolved: indexPath };

  const directPath = path.join(DOCS_DIR, cleanUrl);
  if (fs.existsSync(directPath)) return { ok: true, resolved: directPath };

  const sourceDir = path.dirname(path.join(DOCS_DIR, sourceFile));
  const relativePath = path.resolve(sourceDir, url);
  if (fs.existsSync(relativePath)) return { ok: true, resolved: relativePath };

  return { ok: false };
}

function checkExternalUrl(url) {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout: TIMEOUT_MS, headers: { 'User-Agent': 'AgentOpsDocs-LinkChecker/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve({ ok: true, status: res.statusCode, redirect: res.headers.location });
        res.resume();
        return;
      }
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
      res.resume();
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

async function checkExternalLinks(links) {
  const unique = new Map();
  for (const link of links) {
    if (!unique.has(link.url)) unique.set(link.url, []);
    unique.get(link.url).push(link);
  }

  const urls = [...unique.keys()];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const checks = await Promise.all(batch.map(async (url) => {
      const result = await checkExternalUrl(url);
      return { url, result, sources: unique.get(url) };
    }));
    for (const { url, result, sources } of checks) {
      results.external.total++;
      if (result.ok) {
        results.external.ok++;
      } else {
        for (const src of sources) {
          results.external.broken.push({ url, source: src.source, line: src.line, error: result.error || `HTTP ${result.status}` });
        }
      }
    }
  }
}

async function probeNetwork() {
  try {
    const result = await checkExternalUrl('https://example.com');
    return result.ok === true;
  } catch {
    return false;
  }
}

function collectProjectMarkdownFiles() {
  const extraFiles = [];
  const readmePath = path.join(PROJECT_ROOT, 'README.md');
  if (fs.existsSync(readmePath)) extraFiles.push(readmePath);
  const docsReadmePath = path.join(PROJECT_ROOT, 'docs', 'README.md');
  if (fs.existsSync(docsReadmePath)) extraFiles.push(docsReadmePath);
  return extraFiles;
}

function resolveProjectLink(url, sourceFile) {
  const sourceDir = path.dirname(sourceFile);
  const resolved = path.resolve(sourceDir, url);
  if (fs.existsSync(resolved)) return { ok: true, resolved };
  return { ok: false };
}

async function main() {
  console.log('=== AgentOps Docs Link Checker ===\n');

  // Collect docs-site markdown files
  const docsSiteFiles = collectMarkdownFiles(DOCS_DIR);
  const configPath = path.join(DOCS_DIR, '.vitepress', 'config.ts');
  if (fs.existsSync(configPath)) {
    docsSiteFiles.push(configPath);
  }

  // Collect project-level markdown files
  const projectFiles = collectProjectMarkdownFiles();
  const allFiles = [...docsSiteFiles, ...projectFiles];

  console.log(`Found ${docsSiteFiles.length} docs-site files, ${projectFiles.length} project files.\n`);

  const allInternalLinks = [];
  const allExternalLinks = [];

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const isProjectFile = !filePath.startsWith(DOCS_DIR);
    const links = extractLinks(filePath, content);

    for (const link of links) {
      if (link.url.startsWith('http://') || link.url.startsWith('https://')) {
        allExternalLinks.push(link);
      } else if (link.url.startsWith('/') || link.url.startsWith('./') || link.url.startsWith('../') || !link.url.includes(':')) {
        allInternalLinks.push({ ...link, isProjectFile, absPath: filePath });
      }
    }
  }

  // Check internal links
  console.log('--- Internal Links ---');
  for (const link of allInternalLinks) {
    results.internal.total++;
    let result;
    if (link.isProjectFile) {
      result = resolveProjectLink(link.url, link.absPath);
    } else {
      result = resolveInternalLink(link.url, link.source);
    }
    if (result.ok) {
      results.internal.ok++;
    } else {
      results.internal.broken.push({ url: link.url, source: link.source, line: link.line });
      console.log(`  BROKEN: ${link.url} (in ${link.source}:${link.line})`);
    }
  }
  console.log(`  Total: ${results.internal.total}, OK: ${results.internal.ok}, Broken: ${results.internal.broken.length}\n`);

  // Probe network before checking external links
  console.log('--- External Links ---');
  const hasNetwork = await probeNetwork();
  if (!hasNetwork) {
    results.external.unreachable = true;
    const uniqueUrls = [...new Set(allExternalLinks.map(l => l.url))];
    results.external.total = uniqueUrls.length;
    results.external.ok = 0;
    console.log(`  SKIPPED: No network access (${uniqueUrls.length} unique URLs to verify)\n`);
    for (const url of uniqueUrls) {
      const sources = allExternalLinks.filter(l => l.url === url);
      for (const src of sources) {
        results.external.broken.push({ url, source: src.source, line: src.line, error: 'no network — verify in CI' });
      }
    }
  } else {
    await checkExternalLinks(allExternalLinks);
    for (const b of results.external.broken) {
      console.log(`  BROKEN: ${b.url} — ${b.error} (in ${b.source}:${b.line})`);
    }
    console.log(`  Total: ${results.external.total}, OK: ${results.external.ok}, Broken: ${results.external.broken.length}\n`);
  }

  // Check redirect map
  console.log('--- Redirect Map ---');
  const redirectEntries = Object.entries(REDIRECT_MAP);
  if (redirectEntries.length === 0) {
    console.log('  No old URL redirect entries configured.\n');
  } else if (!hasNetwork) {
    console.log(`  SKIPPED: ${redirectEntries.length} entries (no network)\n`);
  } else {
    for (const [oldUrl, expectedNew] of redirectEntries) {
      results.redirects.total++;
      const result = await checkExternalUrl(oldUrl);
      if (result.ok && result.redirect && result.redirect.includes(expectedNew)) {
        results.redirects.ok++;
        console.log(`  OK: ${oldUrl} -> ${result.redirect}`);
      } else {
        results.redirects.broken.push({ from: oldUrl, expected: expectedNew, result });
        console.log(`  BROKEN: ${oldUrl} -> expected ${expectedNew}, got ${result.status || result.error}`);
      }
    }
    console.log(`  Total: ${results.redirects.total}, OK: ${results.redirects.ok}, Broken: ${results.redirects.broken.length}\n`);
  }

  // Verify VitePress config consistency: every sidebar/nav link has a matching .md file
  console.log('--- Config Consistency ---');
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const configLinks = [];
    const linkRe = /link:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = linkRe.exec(configContent)) !== null) {
      configLinks.push(m[1]);
    }
    const internalConfigLinks = configLinks.filter(l => !l.startsWith('http://') && !l.startsWith('https://'));
    let configBroken = 0;
    for (const link of internalConfigLinks) {
      const resolved = resolveInternalLink(link, '.vitepress/config.ts');
      if (!resolved.ok) {
        configBroken++;
        console.log(`  BROKEN config link: ${link}`);
      }
    }
    if (configBroken === 0) {
      console.log(`  All ${internalConfigLinks.length} internal config links resolve.\n`);
    }
  }

  // Summary
  console.log('=== Summary ===');
  const internalFail = results.internal.broken.length > 0;
  const externalFail = results.external.broken.length > 0 && !results.external.unreachable;
  const redirectFail = results.redirects.broken.length > 0;
  const allOk = !internalFail && !externalFail && !redirectFail;

  console.log(`Internal links:  ${results.internal.ok}/${results.internal.total} OK`);
  console.log(`External links:  ${results.external.ok}/${results.external.total} OK${results.external.unreachable ? ' (skipped — no network)' : ''}`);
  console.log(`Redirect checks: ${results.redirects.ok}/${results.redirects.total} OK`);
  console.log(`\nOverall: ${allOk ? 'PASS' : 'FAIL'}`);

  if (results.external.unreachable) {
    console.log('\nNOTE: External link reachability was skipped (no network). Run in CI for full validation.');
  }

  const reportPath = path.resolve(PROJECT_ROOT, 'link-check-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed report: ${reportPath}`);

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
