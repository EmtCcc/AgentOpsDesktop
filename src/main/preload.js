const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentOps', {
  platform: process.platform,
});
