'use strict';

module.exports = {
  app: {
    getPath: () => '/tmp/agentops-test',
    getName: () => 'AgentOps',
    getVersion: () => '0.1.0',
  },
  ipcMain: {
    on: () => {},
    handle: () => {},
  },
  BrowserWindow: class BrowserWindow {},
  dialog: {
    showMessageBox: () => Promise.resolve({ response: 0 }),
  },
  shell: {
    openExternal: () => Promise.resolve(),
  },
};
