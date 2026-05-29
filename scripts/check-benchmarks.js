#!/usr/bin/env node
'use strict';

/**
 * Performance Benchmark Regression Checker
 *
 * Compares current benchmark results against a baseline.
 * Parses vitest bench text output (table format).
 * Fails (exit 1) if any benchmark regresses beyond the threshold.
 *
 * Usage: node scripts/check-benchmarks.js [--threshold 20] [--baseline benchmarks/baseline.json] [--results benchmarks/results.txt]
 *
 * Exit codes:
 *   0 - All benchmarks within threshold
 *   1 - Regression detected
 *   2 - Missing files / parse error
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const THRESHOLD_PCT = parseFloat(getArg('threshold', '20'));
const BASELINE_PATH = path.resolve(getArg('baseline', 'benchmarks/baseline.json'));
const RESULTS_PATH = path.resolve(getArg('results', 'benchmarks/results.txt'));
const UPDATE_BASELINE = args.includes('--update');

// ── Parse vitest bench text table ──
// Format: "   · benchmark name   123,456.78  0.0022  15.35  0.0050  ..."

function parseBenchText(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Results file not found: ${filePath}`);
    process.exit(2);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const benchmarks = {};

  // Match lines starting with "·" (bullet) — these are benchmark result rows
  const lineRegex = /·\s+(.+?)\s{2,}([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/;
  // Also match "· name  hz  min  max  mean  p75  p99  p995  p999  ±rme  samples"

  for (const line of text.split('\n')) {
    const match = line.match(lineRegex);
    if (match) {
      const name = match[1].trim();
      const hz = parseFloat(match[2].replace(/,/g, ''));
      const min = parseFloat(match[3].replace(/,/g, ''));
      const max = parseFloat(match[4].replace(/,/g, ''));
      const mean = parseFloat(match[5].replace(/,/g, ''));
      benchmarks[name] = { hz, min, max, mean };
    }
  }

  return benchmarks;
}

// ── Parse JSON (if available) ──

function parseResultsJSON(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const benchmarks = {};
    const testResults = raw.testResults || raw.files || [];
    for (const file of testResults) {
      const tasks = file.assertionResults || file.tasks || [];
      for (const task of tasks) {
        const name = task.fullName || task.name || '';
        const stats = task.benchmark || task.stats || {};
        const mean = stats.mean || stats.p50 || task.mean || 0;
        const hz = stats.hz || task.hz || 0;
        if (name) {
          benchmarks[name] = { mean: mean * 1000, hz };
        }
      }
    }
    return benchmarks;
  } catch {
    return null;
  }
}

// ── Auto-detect format ──

function parseResults(filePath) {
  // Try JSON first
  const json = parseResultsJSON(filePath);
  if (json && Object.keys(json).length > 0) return json;

  // Fall back to text parsing
  return parseBenchText(filePath);
}

// ── Compare ──

function compareBaseline(baseline, current, thresholdPct) {
  const regressions = [];
  const improvements = [];
  const newBenchmarks = [];
  const missing = [];

  for (const [name, base] of Object.entries(baseline)) {
    if (!current[name]) {
      missing.push(name);
      continue;
    }
    const cur = current[name];
    if (!base.mean || base.mean === 0) continue;
    const deltaPct = ((cur.mean - base.mean) / base.mean) * 100;

    if (deltaPct > thresholdPct) {
      regressions.push({ name, base: base.mean, current: cur.mean, deltaPct });
    } else if (deltaPct < -10) {
      improvements.push({ name, base: base.mean, current: cur.mean, deltaPct });
    }
  }

  for (const name of Object.keys(current)) {
    if (!baseline[name]) {
      newBenchmarks.push(name);
    }
  }

  return { regressions, improvements, newBenchmarks, missing };
}

// ── Main ──

function main() {
  // --update: unconditionally regenerate baseline from current results
  if (UPDATE_BASELINE) {
    if (!fs.existsSync(RESULTS_PATH)) {
      console.error(`Results file not found: ${RESULTS_PATH}`);
      process.exit(2);
    }
    const dir = path.dirname(BASELINE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    const parsed = parseResults(RESULTS_PATH);
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(parsed, null, 2));
    console.log(`Baseline updated with ${Object.keys(parsed).length} benchmarks.`);
    process.exit(0);
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    console.log(`No baseline found at ${BASELINE_PATH}. Creating from current results...`);
    if (fs.existsSync(RESULTS_PATH)) {
      const dir = path.dirname(BASELINE_PATH);
      fs.mkdirSync(dir, { recursive: true });
      const parsed = parseResults(RESULTS_PATH);
      fs.writeFileSync(BASELINE_PATH, JSON.stringify(parsed, null, 2));
      console.log('Baseline created. Run benchmarks again to detect regressions.');
    } else {
      console.log('No results file found either. Run benchmarks first:');
      console.log('  npm run test:benchmark');
    }
    process.exit(0);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const current = parseResults(RESULTS_PATH);

  if (Object.keys(current).length === 0) {
    console.error('No benchmark results parsed from output.');
    process.exit(2);
  }

  const { regressions, improvements, newBenchmarks, missing } = compareBaseline(baseline, current, THRESHOLD_PCT);

  // ── Report ──

  console.log('\n═══ Benchmark Regression Report ═══\n');
  console.log(`Threshold: ${THRESHOLD_PCT}% slower = regression\n`);

  if (regressions.length === 0) {
    console.log('No regressions detected.\n');
  } else {
    console.log(`REGRESSIONS (${regressions.length}):\n`);
    for (const r of regressions) {
      const baseStr = r.base < 1 ? `${(r.base * 1000).toFixed(1)}µs` : `${r.base.toFixed(2)}ms`;
      const curStr = r.current < 1 ? `${(r.current * 1000).toFixed(1)}µs` : `${r.current.toFixed(2)}ms`;
      console.log(`  FAIL  ${r.name}`);
      console.log(`        baseline: ${baseStr} -> current: ${curStr} (+${r.deltaPct.toFixed(1)}%)`);
    }
    console.log('');
  }

  if (improvements.length > 0) {
    console.log(`IMPROVEMENTS (${improvements.length}):\n`);
    for (const i of improvements) {
      console.log(`  PASS  ${i.name} (${i.deltaPct.toFixed(1)}% faster)`);
    }
    console.log('');
  }

  if (newBenchmarks.length > 0) {
    console.log(`NEW BENCHMARKS (${newBenchmarks.length}):\n`);
    for (const n of newBenchmarks) {
      const cur = current[n];
      console.log(`  NEW   ${n} (${cur.mean.toFixed(2)}ms)`);
    }
    console.log('');
  }

  if (missing.length > 0) {
    console.log(`MISSING FROM RESULTS (${missing.length}):\n`);
    for (const m of missing) {
      console.log(`  SKIP  ${m}`);
    }
    console.log('');
  }

  // ── GitHub Actions Summary ──
  if (process.env.GITHUB_STEP_SUMMARY) {
    let summary = '## Performance Benchmark Results\n\n';
    summary += `| Status | Benchmark | Baseline | Current | Change |\n`;
    summary += `|--------|-----------|----------|---------|--------|\n`;

    for (const r of regressions) {
      summary += `| :x: | ${r.name} | ${r.base.toFixed(2)}ms | ${r.current.toFixed(2)}ms | +${r.deltaPct.toFixed(1)}% |\n`;
    }
    for (const i of improvements) {
      summary += `| :white_check_mark: | ${i.name} | ${i.base.toFixed(2)}ms | ${i.current.toFixed(2)}ms | ${i.deltaPct.toFixed(1)}% |\n`;
    }
    for (const n of newBenchmarks) {
      const cur = current[n];
      summary += `| :new: | ${n} | — | ${cur.mean.toFixed(2)}ms | — |\n`;
    }

    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  }

  // ── Exit ──
  if (regressions.length > 0) {
    console.log(`\nResult: ${regressions.length} regression(s) exceed ${THRESHOLD_PCT}% threshold.`);
    process.exit(1);
  }

  console.log('Result: All benchmarks within threshold.');
  process.exit(0);
}

main();
