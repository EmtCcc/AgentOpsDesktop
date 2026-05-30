#!/usr/bin/env node
// Fix electron path.txt trailing newline that causes ENOENT on spawn
// pnpm sometimes adds a trailing newline when writing path.txt,
// but electron's index.js reads it without trimming.
const fs = require('fs');
const path = require('path');

const electronDir = path.dirname(require.resolve('electron/package.json'));
const pathFile = path.join(electronDir, 'path.txt');

try {
  const content = fs.readFileSync(pathFile, 'utf-8');
  if (content.endsWith('\n')) {
    fs.writeFileSync(pathFile, content.trimEnd());
    console.log('Fixed electron path.txt (removed trailing newline)');
  }
} catch (e) {
  // electron not installed yet, skip
}
