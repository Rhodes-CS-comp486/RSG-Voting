try {
  const electron = require('electron');
  console.log('Electron loaded successfully');
  console.log('Type of electron:', typeof electron);
  console.log('Electron keys:', Object.keys(electron).slice(0, 10));
  console.log('Has app?:', 'app' in electron);

  if (electron.app) {
    electron.app.whenReady().then(() => {
      console.log('App is ready!');
      electron.app.quit();
    });
  } else {
    console.error('electron.app is undefined!');
    process.exit(1);
  }
} catch (error) {
  console.error('Error loading electron:', error);
  process.exit(1);
}
