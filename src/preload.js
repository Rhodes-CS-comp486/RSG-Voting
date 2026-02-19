const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getVotingMethods: () => ipcRenderer.invoke('voting:get-methods'),
  runElection: (config) => ipcRenderer.invoke('voting:run-election', config),
  validateBallots: (data) => ipcRenderer.invoke('voting:validate-ballots', data),
  parseCSV: (csvContent) => ipcRenderer.invoke('voting:parse-csv', csvContent),
});
