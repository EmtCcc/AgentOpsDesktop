#!/usr/bin/env node
'use strict';

/**
 * Link checker for AgentOps Desktop.
 *
 * Validates:
 *  1. Internal links (docs-site markdown cross-references, config nav/sidebar) resolve to real files
 *  2. External links are reachable (skipped when no network)
 *  3. Redirect map entries return expected status codes
 *  4. SPA route consistency (every route component file exists, every alias maps correctly)
 *
 * Usage: node scripts/check-links.js
 * Exit: 0 = all checks pass, 1 = failures found, 2 = fatal error
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '..', 'docs-site');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(__dirname, '..', 'src');
const RENDERER_DIR = path.resolve(SRC_DIR, 'renderer');
const TIMEOUT_MS = 10000;
const CONCURRENCY = 5;

// Old URL -> expected redirect target (populate when legacy URLs exist)
const REDIRECT_MAP = {};

const results = {
  internal: { total: 0, ok: 0, broken: [] },
  external: { total: 0, ok: 0, broken: [], unreachable: false },
  redirects: { total: 0, ok: 0, broken: [] },
  spaRoutes: { total: 0, ok: 0, broken: [] },
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

async function checkExternalUrl(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'User-Agent': 'AgentOpsDocs-LinkChecker/1.0' },
    });
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      return { ok: true, status: res.status, redirect: location };
    }
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  }
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
          results.external.broken.push({ url, source: src.source, line: src.line, error: result.error || `HTTP ${result.status}`, networkError: !!result.networkError });
        }
      }
    }
  }
}

async function probeNetwork() {
  // Try multiple probes — network may be intermittent
  for (const url of ['https://example.com', 'https://httpbin.org/status/200']) {
    try {
      const result = await checkExternalUrl(url, 0); // no retries for probe
      if (result.ok) return true;
    } catch { /* continue */ }
  }
  return false;
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

/**
 * Check SPA route consistency: verify every route component file exists
 * and every alias maps to a valid canonical path.
 */
function checkSPARoutes() {
  console.log('--- SPA Route Consistency ---\n');

  // Parse routes.ts
  const routesPath = path.join(RENDERER_DIR, 'routes.ts');
  if (!fs.existsSync(routesPath)) {
    console.log('  SKIP: routes.ts not found\n');
    return;
  }

  const routesContent = fs.readFileSync(routesPath, 'utf8');

  // Extract route entries: { path, component, aliases }
  const routeEntryRegex = /\{[^}]*path:\s*'([^']+)'[^}]*component:\s*'([^']+)'[^}]*aliases:\s*\[([^\]]*)\][^}]*\}/gs;
  let m;
  const routes = [];
  while ((m = routeEntryRegex.exec(routesContent)) !== null) {
    const routePath = m[1];
    const component = m[2];
    const aliasesRaw = m[3];
    const aliases = [...aliasesRaw.matchAll(/'([^']+)'/g)].map(a => a[1]);
    routes.push({ path: routePath, component, aliases });
  }

  // Collect all known component files
  const pagesDir = path.join(RENDERER_DIR, 'pages');
  const componentFiles = new Set();
  if (fs.existsSync(pagesDir)) {
    for (const f of fs.readdirSync(pagesDir)) {
      componentFiles.add(f.replace(/\.(jsx?|tsx?)$/, ''));
    }
  }
  // Also check app.js for inline components
  const appJsPath = path.join(RENDERER_DIR, 'app.js');
  if (fs.existsSync(appJsPath)) {
    const appContent = fs.readFileSync(appJsPath, 'utf8');
    // Scan for mount*Page function definitions
    const mountRe = /function\s+mount(\w+Page)\b/g;
    let mm;
    while ((mm = mountRe.exec(appContent)) !== null) {
      componentFiles.add(mm[1]);
    }
    // Scan for render* functions and map to *Page component names
    // e.g. renderDashboard -> DashboardPage, renderAgents -> AgentsPage
    const renderRe = /function\s+render(\w+)\s*\(/g;
    while ((mm = renderRe.exec(appContent)) !== null) {
      const name = mm[1];
      if (name === 'Page') continue; // skip generic renderPage
      componentFiles.add(name + 'Page');
    }
  }

  // Check each route
  for (const route of routes) {
    results.spaRoutes.total++;
    const exists = componentFiles.has(route.component);
    if (exists) {
      results.spaRoutes.ok++;
    } else {
      results.spaRoutes.broken.push({ path: route.path, component: route.component, issue: 'component file not found' });
      console.log(`  BROKEN: ${route.path} -> component '${route.component}' not found in pages/ or app.js`);
    }

    // Validate aliases don't collide with other canonical paths
    for (const alias of route.aliases) {
      const collision = routes.find(r => r.path === alias && r.path !== route.path);
      if (collision) {
        results.spaRoutes.broken.push({ path: route.path, alias, issue: `alias collides with canonical path of ${collision.path}` });
        console.log(`  COLLISION: alias '${alias}' of ${route.path} collides with canonical path ${collision.path}`);
      }
    }
  }

  console.log(`  Routes: ${results.spaRoutes.total}, OK: ${results.spaRoutes.ok}, Broken: ${results.spaRoutes.broken.length}\n`);
}

/**
 * Validate redirect map: every redirect target must be a valid canonical route,
 * and gone paths must not conflict with existing routes.
 */
function checkRedirectMap() {
  console.log('--- Redirect Map Validation ---\n');

  const redirectsPath = path.join(RENDERER_DIR, 'redirects.json');
  if (!fs.existsSync(redirectsPath)) {
    console.log('  SKIP: redirects.json not found\n');
    return;
  }

  const data = JSON.parse(fs.readFileSync(redirectsPath, 'utf8'));
  const redirects = data.redirects || {};
  const gone = data.gone || [];

  // Parse canonical routes from routes.ts
  const routesPath = path.join(RENDERER_DIR, 'routes.ts');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  const canonicalPaths = new Set();
  const routePathRe = /path:\s*'([^']+)'/g;
  let m;
  while ((m = routePathRe.exec(routesContent)) !== null) {
    canonicalPaths.add(m[1]);
  }

  let broken = 0;

  // Check redirect targets
  for (const [oldPath, target] of Object.entries(redirects)) {
    results.redirects.total++;
    // Extract base path from target (strip query params)
    const basePath = target.split('?')[0];
    // Strip param segments for matching (e.g. /agents/:agentId -> /agents/:agentId)
    if (canonicalPaths.has(basePath)) {
      results.redirects.ok++;
    } else {
      // Check if it's a parametric match (target has :params)
      const targetBase = basePath.replace(/\/:[^/]+/g, '');
      const match = [...canonicalPaths].some(cp => cp.replace(/\/:[^/]+/g, '') === targetBase);
      if (match) {
        results.redirects.ok++;
      } else {
        results.redirects.broken.push({ from: oldPath, expected: target, issue: 'target not a canonical route' });
        console.log(`  BROKEN redirect: ${oldPath} -> ${target} (target not in routes.ts)`);
        broken++;
      }
    }
  }

  // Check gone paths don't conflict with canonical routes
  for (const gonePath of gone) {
    if (canonicalPaths.has(gonePath)) {
      results.redirects.broken.push({ from: gonePath, issue: 'gone path conflicts with canonical route' });
      console.log(`  CONFLICT: ${gonePath} is both a gone path and a canonical route`);
      broken++;
    }
  }

  // Check redirects.json is consistent with routes.ts aliases
  const routesTsAliases = new Set();
  const aliasRe = /aliases:\s*\[([^\]]*)\]/g;
  while ((m = aliasRe.exec(routesContent)) !== null) {
    for (const a of m[1].matchAll(/'([^']+)'/g)) {
      routesTsAliases.add(a[1]);
    }
  }

  // Find aliases in routes.ts not in redirects.json
  for (const alias of routesTsAliases) {
    if (!redirects[alias]) {
      console.log(`  MISSING: alias '${alias}' from routes.ts not in redirects.json`);
      broken++;
    }
  }

  // Find redirects in redirects.json not in routes.ts aliases
  for (const oldPath of Object.keys(redirects)) {
    if (!oldPath.includes(':') && !routesTsAliases.has(oldPath)) {
      console.log(`  EXTRA: redirect '${oldPath}' in redirects.json but not in routes.ts aliases`);
    }
  }

  const total = Object.keys(redirects).length;
  console.log(`  Redirects: ${total}, Valid: ${total - broken}, Issues: ${broken}`);
  console.log(`  Gone paths: ${gone.length} (${gone.filter(g => canonicalPaths.has(g)).length} conflicting)\n`);
}

/**
 * Extract external URLs from the app source code (not docs) and check them.
 */
async function checkAppExternalLinks(hasNetwork) {
  console.log('--- App Source External URLs ---\n');

  const sourceExts = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css'];
  const sourceFiles = [];

  function collectSources(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.vitepress' || entry.name === 'dist') continue;
        collectSources(full);
      } else if (sourceExts.some(ext => entry.name.endsWith(ext))) {
        sourceFiles.push(full);
      }
    }
  }

  collectSources(SRC_DIR);
  // Also include docs-site config
  const vpConfig = path.join(DOCS_DIR, '.vitepress', 'config.ts');
  if (fs.existsSync(vpConfig)) sourceFiles.push(vpConfig);

  const urlRegex = /https?:\/\/[^\s"'`)}\]>]+/g;
  const externalUrls = new Map(); // url -> [{source, line}]

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(PROJECT_ROOT, filePath);
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      let url = match[0].replace(/[.,;:!?)]+$/, ''); // strip trailing punctuation
      // Skip data: URLs, SVGs, localhost, XML namespaces, template params
      if (url.startsWith('data:') || url.includes('localhost') || url.includes('127.0.0.1')) continue;
      if (url.includes('w3.org/2000') || url.includes('w3.org/2001') || url.includes('schemas.')) continue;
      if (/\/:[a-z]/.test(url)) continue; // template params like :path, :id
      if (!externalUrls.has(url)) externalUrls.set(url, []);
      const line = content.substring(0, match.index).split('\n').length;
      externalUrls.get(url).push({ source: relPath, line });
    }
  }

  const uniqueUrls = [...externalUrls.keys()];
  console.log(`  Found ${uniqueUrls.length} unique external URLs in source code.\n`);

  if (!hasNetwork) {
    console.log('  SKIPPED: No network access.\n');
    return;
  }

  let okCount = 0;
  const broken = [];

  for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
    const batch = uniqueUrls.slice(i, i + CONCURRENCY);
    const checks = await Promise.all(batch.map(async (url) => {
      const result = await checkExternalUrl(url);
      return { url, result };
    }));
    for (const { url, result } of checks) {
      if (result.ok) {
        okCount++;
      } else {
        const sources = externalUrls.get(url);
        for (const src of sources) {
          broken.push({ url, source: src.source, line: src.line, error: result.error || `HTTP ${result.status}`, networkError: !!result.networkError });
          const label = result.networkError ? 'UNREACHABLE' : 'BROKEN';
          console.log(`  ${label}: ${url} — ${result.error || `HTTP ${result.status}`} (in ${src.source}:${src.line})`);
        }
      }
    }
  }

  console.log(`  Total: ${uniqueUrls.length}, OK: ${okCount}, Broken: ${broken.length}\n`);

  // Merge into results.external
  results.external.total += uniqueUrls.length;
  results.external.ok += okCount;
  results.external.broken.push(...broken);
}

async function main() {
  console.log('=== AgentOps Link Checker ===\n');

  // 1. SPA route consistency
  checkSPARoutes();

  // 1b. Redirect map validation
  checkRedirectMap();

  // 2. Collect docs-site markdown files
  const docsSiteFiles = collectMarkdownFiles(DOCS_DIR);
  const configPath = path.join(DOCS_DIR, '.vitepress', 'config.ts');
  if (fs.existsSync(configPath)) {
    docsSiteFiles.push(configPath);
  }

  // 3. Collect project-level markdown files
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
  console.log('--- External Links (docs) ---');
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

  // Check app source external URLs
  await checkAppExternalLinks(hasNetwork);

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
  // Only treat HTTP-level failures as real external failures; network errors are environment-specific warnings
  const externalHardFail = results.external.broken.some(b => !b.networkError);
  const externalNetErrors = results.external.broken.filter(b => b.networkError);
  const externalFail = externalHardFail && !results.external.unreachable;
  const redirectFail = results.redirects.broken.length > 0;
  const spaFail = results.spaRoutes.broken.length > 0;
  const allOk = !internalFail && !externalFail && !redirectFail && !spaFail;

  console.log(`SPA routes:      ${results.spaRoutes.ok}/${results.spaRoutes.total} OK`);
  console.log(`Internal links:  ${results.internal.ok}/${results.internal.total} OK`);
  console.log(`External links:  ${results.external.ok}/${results.external.total} OK${results.external.unreachable ? ' (skipped — no network)' : ''}`);
  if (externalNetErrors.length > 0) {
    console.log(`  (${externalNetErrors.length} network-unreachable — verify in CI)`);
  }
  console.log(`Redirect checks: ${results.redirects.ok}/${results.redirects.total} OK`);
  console.log(`\nOverall: ${allOk ? 'PASS' : 'FAIL'}`);

  if (results.external.unreachable) {
    console.log('\nNOTE: External link reachability was skipped (no network). Run in CI for full validation.');
  } else if (externalNetErrors.length > 0 && !externalHardFail) {
    console.log('\nNOTE: Some external URLs were unreachable due to network restrictions. Verify in CI.');
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
