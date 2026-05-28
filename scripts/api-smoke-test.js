#!/usr/bin/env node

/**
 * API smoke test — starts the HTTP server and hits /health via real HTTP.
 *
 * Validates that the health endpoint responds correctly over the network,
 * not just via Hono's in-process app.request().
 *
 * Usage: node scripts/api-smoke-test.js
 */

const http = require('http');
const { createApp } = require('../src/main/api/app.js');

let exitCode = 0;

function check(label, ok, detail) {
  const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} ${label}`);
  if (!ok) {
    exitCode = 1;
    if (detail) console.log(`    ${detail}`);
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    }).on('error', reject);
  });
}

function startServer(app) {
  return new Promise((resolve) => {
    const { serve } = require('@hono/node-server');
    const srv = serve({ fetch: app.fetch, port: 0 }, (info) => {
      console.log(`  Server listening on port ${info.port}\n`);
      resolve(srv);
    });
  });
}

async function run() {
  console.log('\nAPI Smoke Test — /health endpoint\n');

  const mockRepos = {
    agents: {
      db: {
        prepare: () => ({ get: () => ({}) }),
      },
    },
  };
  const mockTokenManager = {
    createSession: () => ({ token: 't', role: 'admin', expiresAt: Date.now() + 3600000 }),
    validate: () => true,
    verifyToken: () => ({ role: 'admin' }),
    getSessionInfo: () => ({ role: 'admin', isValid: true }),
    destroySession: () => {},
  };

  const app = createApp({ repos: mockRepos, tokenManager: mockTokenManager });
  const server = await startServer(app);
  const port = server.address().port;

  try {
    const res = await httpGet(`http://127.0.0.1:${port}/health`);

    // Status code
    check('Returns HTTP 200', res.status === 200, `got ${res.status}`);

    // Content-Type
    const ct = res.headers['content-type'] || '';
    check('Content-Type is application/json', ct.includes('application/json'), `got ${ct}`);

    // Required fields
    check('Has status field', typeof res.body.status === 'string');
    check('Has version field', typeof res.body.version === 'string');
    check('Version matches semver', /^\d+\.\d+\.\d+/.test(res.body.version), `got ${res.body.version}`);
    check('Has ISO timestamp', new Date(res.body.ts).toISOString() === res.body.ts);
    check('Has uptimeMs (non-negative)', typeof res.body.uptimeMs === 'number' && res.body.uptimeMs >= 0);

    // Memory
    check('Has memory object', typeof res.body.memory === 'object');
    check('Memory has rss/heapUsed/heapTotal/external',
      ['rss', 'heapUsed', 'heapTotal', 'external'].every((k) => typeof res.body.memory[k] === 'number'));

    // System
    check('Has system object', typeof res.body.system === 'object');
    check('System has totalMem/freeMem/loadAvg/cpus',
      ['totalMem', 'freeMem', 'loadAvg', 'cpus'].every((k) => res.body.system[k] !== undefined));

    // IPC metrics
    check('Has ipc object', typeof res.body.ipc === 'object');
    check('IPC has calls/errors/avgLatencyMs',
      ['calls', 'errors', 'avgLatencyMs'].every((k) => typeof res.body.ipc[k] === 'number'));

    // Renderer
    check('Has renderer object', typeof res.body.renderer === 'object');

    // App
    check('Has app object', typeof res.body.app === 'object');

    // DB connectivity
    check('DB connectivity ok', res.body.db && res.body.db.ok === true);

    // Alerts
    check('Alerts is array', Array.isArray(res.body.alerts));
    check('Status is valid', ['ok', 'degraded', 'unhealthy'].includes(res.body.status));

    // Status/alerts consistency
    if (res.body.status === 'ok') {
      check('Status ok implies no alerts', res.body.alerts.length === 0);
    }

    // Uptime stats
    check('Has uptime object', typeof res.body.uptime === 'object');
    check('Uptime has uptimePercent', typeof res.body.uptime.uptimePercent === 'number');
    check('Uptime percent 0-100',
      res.body.uptime.uptimePercent >= 0 && res.body.uptime.uptimePercent <= 100);
    check('Uptime has breakdown', typeof res.body.uptime.breakdown === 'object');
    check('Breakdown has okMs/degradedMs/unhealthyMs',
      ['okMs', 'degradedMs', 'unhealthyMs'].every((k) => typeof res.body.uptime.breakdown[k] === 'number'));
    check('Uptime has transitions array', Array.isArray(res.body.uptime.transitions));

    console.log('');
  } catch (err) {
    check('HTTP request succeeded', false, err.message);
  } finally {
    server.close();
  }

  if (exitCode === 0) {
    console.log('\x1b[32mAll API smoke checks passed.\x1b[0m\n');
  } else {
    console.log(`\x1b[31mAPI smoke test failed.\x1b[0m\n`);
  }
  process.exit(exitCode);
}

run().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
