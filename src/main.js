const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createEngine } = require('./voting/index');
const { parseQualtricsCSV } = require('./utils/csvParser');

const engine = createEngine();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, applications stay active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for communication between main and renderer processes
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('voting:get-methods', () => {
  return engine.getAvailableMethods();
});

ipcMain.handle('voting:run-election', (event, config) => {
  try {
    const result = engine.runElection(config);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('voting:validate-ballots', (event, { method, candidates, ballots }) => {
  try {
    const votingMethod = engine.methods.get(method);
    if (!votingMethod) {
      return { valid: false, errors: [`Unknown method: ${method}`] };
    }
    return votingMethod.validate(candidates, ballots);
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
});

ipcMain.handle('voting:parse-csv', (event, csvContent) => {
  try {
    return parseQualtricsCSV(csvContent);
  } catch (error) {
    return { success: false, positions: null, error: error.message };
  }
});
