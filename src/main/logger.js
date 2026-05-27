'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const LOG_LEVEL = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

let logDir;
try {
  logDir = path.join(app.getPath('userData'), 'logs');
} catch {
  logDir = path.join(process.cwd(), 'logs');
}

const logFile = path.join(logDir, `app-${new Date().toISOString().slice(0, 10)}.jsonl`);

try {
  fs.mkdirSync(logDir, { recursive: true });
} catch {
  // best effort
}

const stream = fs.createWriteStream(logFile, { flags: 'a' });

function write(entry) {
  const line = JSON.stringify(entry) + '\n';
  stream.write(line);
  if (process.argv.includes('--dev')) {
    const fn = entry.level === 'error' || entry.level === 'fatal' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
    console[fn](`[${entry.level.toUpperCase()}] ${entry.msg}`, entry.err?.stack ?? '');
  }
}

function log(level, msg, extra = {}) {
  if (LEVELS[level] < LOG_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    pid: process.pid,
    ...extra,
  };
  write(entry);
}

module.exports = {
  debug: (msg, extra) => log('debug', msg, extra),
  info: (msg, extra) => log('info', msg, extra),
  warn: (msg, extra) => log('warn', msg, extra),
  error: (msg, extra) => log('error', msg, extra),
  fatal: (msg, extra) => log('fatal', msg, extra),
  logDir,
  logFile,
};
