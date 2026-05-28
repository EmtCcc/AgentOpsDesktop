'use strict';

const { autoUpdater } = require('electron-updater');
const logger = require('./logger');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function init(mainWindow) {
  autoUpdater.on('checking-for-update', () => {
    logger.info('updater.checking');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('updater.available', { version: info.version });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', { version: info.version });
    }
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('updater.not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    logger.debug('updater.progress', { percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('updater.downloaded', { version: info.version });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:downloaded', { version: info.version });
    }
  });

  autoUpdater.on('error', (err) => {
    logger.error('updater.error', { err: { message: err.message, stack: err.stack } });
  });
}

async function checkForUpdates() {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    logger.error('updater.check-failed', { err: { message: err.message } });
  }
}

async function downloadUpdate() {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    logger.error('updater.download-failed', { err: { message: err.message } });
  }
}

function quitAndInstall() {
  autoUpdater.quitAndInstall(false, true);
}

module.exports = { init, checkForUpdates, downloadUpdate, quitAndInstall };
