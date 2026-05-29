'use strict';

const { autoUpdater } = require('electron-updater');
const logger = require('./logger');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.disableDifferentialDownload = false;

let _mainWindow = null;
let _deferredVersion = null;
let _updateInfo = null;

function init(mainWindow) {
  _mainWindow = mainWindow;

  autoUpdater.on('checking-for-update', () => {
    logger.info('updater.checking');
    _send('update:checking');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('updater.available', { version: info.version });
    _updateInfo = { version: info.version, releaseDate: info.releaseDate, releaseNotes: info.releaseNotes };
    if (_deferredVersion === info.version) {
      logger.info('updater.skipped-deferred', { version: info.version });
      return;
    }
    _send('update:available', { version: info.version, releaseDate: info.releaseDate });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('updater.not-available');
    _send('update:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    logger.debug('updater.progress', { percent: progress.percent });
    _send('update:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('updater.downloaded', { version: info.version });
    _send('update:downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    logger.error('updater.error', { err: { message: err.message, stack: err.stack } });
    _send('update:error', { message: err.message });
  });
}

async function checkForUpdates() {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    logger.error('updater.check-failed', { err: { message: err.message } });
    _send('update:error', { message: err.message });
  }
}

async function downloadUpdate() {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    logger.error('updater.download-failed', { err: { message: err.message } });
    _send('update:error', { message: err.message });
  }
}

function quitAndInstall() {
  autoUpdater.quitAndInstall(false, true);
}

function deferVersion(version) {
  _deferredVersion = version;
  logger.info('updater.deferred', { version });
}

function clearDefer() {
  _deferredVersion = null;
}

function getUpdateInfo() {
  return _updateInfo;
}

function isDeferred(version) {
  return _deferredVersion === version;
}

function _send(channel, data) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    try {
      _mainWindow.webContents.send(channel, data);
    } catch { /* window closed */ }
  }
}

module.exports = { init, checkForUpdates, downloadUpdate, quitAndInstall, deferVersion, clearDefer, getUpdateInfo, isDeferred };
