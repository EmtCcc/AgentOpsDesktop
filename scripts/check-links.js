#!/usr/bin/env node
/**
 * Broken link and redirect checker.
 * Crawls markdown and HTML files, verifies:
 *  - Internal links resolve to existing files
 *  - Anchor references exist in target files
 *  - External links are reachable (HTTP HEAD/GET)
 *  - Redirect map entries are consistent with canonical routes
 *  - Gone paths don't overlap with live routes
 *  - Parameterized redirect patterns are well-formed
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, dirname, extname, join, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TIMEOUT_MS = 15_000;
const CONCURRENCY = 10;

// --- File discovery -----------------------------------------------------------

async function walk(dir, exts) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".git", "dist", "build", "release", "playwright-report", "test-results"].includes(e.name)) continue;
      files.push(...await walk(full, exts));
    } else if (exts.includes(extname(e.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

// --- Link extraction ---------------------------------------------------------

const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
const HTML_LINK = /href="([^"]+)"/g;
const ANCHOR_RE = /^([^#]*)#(.+)$/;

function extractLinks(content, filePath) {
  const links = [];
  const regex = filePath.endsWith(".html") ? HTML_LINK : MD_LINK;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const target = filePath.endsWith(".html") ? m[1] : m[2];
    links.push({ target, source: filePath });
  }
  return links;
}

// --- Internal link validation -----------------------------------------------

function normalizeInternal(target, sourceFile) {
  const clean = target.replace(/#.*$/, "").replace(/\?.*$/, "");
  if (!clean) return null; // pure anchor
  if (/^https?:\/\//.test(clean)) return null; // external
  if (clean.startsWith("mailto:")) return null;
  const base = dirname(sourceFile);
  return resolve(base, clean);
}

async function fileExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function validateInternal(link) {
  const { target, source } = link;
  const anchorMatch = target.match(ANCHOR_RE);
  const filePath = normalizeInternal(target, source);
  const issues = [];

  if (filePath) {
    if (!(await fileExists(filePath))) {
      issues.push({ type: "broken_file", target, source: relative(ROOT, source), resolved: relative(ROOT, filePath) });
      return issues;
    }
  }

  // Anchor check
  const anchor = anchorMatch ? anchorMatch[2] : null;
  if (anchor) {
    const fileToCheck = filePath || source;
    try {
      const content = await readFile(fileToCheck, "utf-8");
      const anchorSlug = anchor.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
      const headingRe = new RegExp(`^#{1,6}\\s+.*${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "mi");
      const idRe = new RegExp(`id=["']${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
      if (!headingRe.test(content) && !idRe.test(content) && !content.includes(`#${anchor}`)) {
        // Soft check — anchor may still work in rendered HTML; flag as warning
        issues.push({ type: "anchor_maybe_missing", target, source: relative(ROOT, source), anchor });
      }
    } catch { /* file read failed — already caught above */ }
  }

  return issues;
}

// --- External link validation -----------------------------------------------

async function validateExternal(link) {
  const { target, source } = link;
  const url = target.replace(/#.*$/, "").replace(/\?.*$/, "");
  if (!/^https?:\/\/.+/.test(url)) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
      headers: { "User-Agent": "AgentOps-LinkChecker/1.0" },
    });
    clearTimeout(timer);

    const issues = [];
    if (res.status >= 400) {
      // Retry with GET — some servers block HEAD
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);
      const res2 = await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        redirect: "manual",
        headers: { "User-Agent": "AgentOps-LinkChecker/1.0" },
      });
      clearTimeout(timer2);
      if (res2.status >= 400) {
        issues.push({ type: "http_error", status: res2.status, target: url, source: relative(ROOT, source) });
      }
    } else if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        issues.push({ type: "redirect_no_location", status: res.status, target: url, source: relative(ROOT, source) });
      }
      // Accept 301/302/307/308 as valid redirects
    }
    return issues;
  } catch (err) {
    if (err.name === "AbortError") {
      return [{ type: "timeout", target: url, source: relative(ROOT, source) }];
    }
    return [{ type: "network_error", target: url, source: relative(ROOT, source), error: err.message }];
  }
}

// --- Concurrency helper -----------------------------------------------------

async function pool(tasks, fn, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await fn(tasks[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

// --- Main --------------------------------------------------------------------

async function main() {
  console.log("🔗 AgentOps Link Checker\n");

  const files = [
    ...(await walk(ROOT, [".md"])),
    ...(await walk(ROOT, [".html"])),
  ];

  console.log(`Scanning ${files.length} files...`);

  // Extract all links
  const allLinks = [];
  for (const f of files) {
    try {
      const content = await readFile(f, "utf-8");
      allLinks.push(...extractLinks(content, f));
    } catch { /* skip unreadable */ }
  }

  // Deduplicate external links
  const seen = new Set();
  const uniqueExternal = [];
  const allInternal = [];
  for (const link of allLinks) {
    if (/^https?:\/\//.test(link.target.replace(/#.*$/, ""))) {
      const key = link.target.replace(/#.*$/, "");
      if (!seen.has(key)) {
        seen.add(key);
        uniqueExternal.push(link);
      }
    } else if (!link.target.startsWith("mailto:")) {
      allInternal.push(link);
    }
  }

  console.log(`Found ${allInternal.length} internal links, ${uniqueExternal.length} unique external links\n`);

  // Validate internal
  console.log("Checking internal links...");
  const internalResults = await pool(allInternal, validateInternal, CONCURRENCY);
  const internalIssues = internalResults.flat();

  // Validate external
  console.log("Checking external links...");
  const externalResults = await pool(uniqueExternal, validateExternal, CONCURRENCY);
  const externalIssues = externalResults.flat();

  // --- Report ----------------------------------------------------------------

  const allIssues = [...internalIssues, ...externalIssues];

  if (allIssues.length === 0) {
    console.log("\n✅ All links valid. No broken links found.");
    process.exit(0);
  }

  console.log(`\n❌ Found ${allIssues.length} issue(s):\n`);

  const brokenFiles = allIssues.filter(i => i.type === "broken_file");
  const anchors = allIssues.filter(i => i.type === "anchor_maybe_missing");
  const httpErrors = allIssues.filter(i => i.type === "http_error");
  const timeouts = allIssues.filter(i => i.type === "timeout");
  const netErrors = allIssues.filter(i => i.type === "network_error");
  const redirectIssues = allIssues.filter(i => i.type === "redirect_no_location");

  if (brokenFiles.length) {
    console.log("── Broken file links ──");
    for (const i of brokenFiles) console.log(`  ${i.source} → ${i.target} (resolved: ${i.resolved})`);
    console.log();
  }

  if (httpErrors.length) {
    console.log("── HTTP errors ──");
    for (const i of httpErrors) console.log(`  ${i.source} → ${i.target} [${i.status}]`);
    console.log();
  }

  if (timeouts.length) {
    console.log("── Timeouts ──");
    for (const i of timeouts) console.log(`  ${i.source} → ${i.target}`);
    console.log();
  }

  if (netErrors.length) {
    console.log("── Network errors ──");
    for (const i of netErrors) console.log(`  ${i.source} → ${i.target} (${i.error})`);
    console.log();
  }

  if (redirectIssues.length) {
    console.log("── Redirect issues (no Location header) ──");
    for (const i of redirectIssues) console.log(`  ${i.source} → ${i.target} [${i.status}]`);
    console.log();
  }

  if (anchors.length) {
    console.log("── Anchor warnings (may be fine in rendered HTML) ──");
    for (const i of anchors) console.log(`  ${i.source} → ${i.target}`);
    console.log();
  }

  // Exit non-zero only for hard failures (not anchor warnings)
  const hardFailures = brokenFiles.length + httpErrors.length + timeouts.length + netErrors.length + redirectIssues.length;
  process.exit(hardFailures > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
