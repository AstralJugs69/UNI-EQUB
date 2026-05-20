const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const adb = require('./src/main/adb.cjs');
const signing = require('./src/main/signing.cjs');

const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f5f8fc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

ipcMain.handle('adb:listDevices', async () => adb.listSimulationDevices());
ipcMain.handle('adb:launchApp', async (_event, deviceId) => adb.launchApp(deviceId));
ipcMain.handle('adb:sendCommand', async (_event, input) => {
  const secret = process.env.UNIEQUB_CONTROLLER_SECRET || 'local-dev-controller';
  const envelope = signing.signCommand(input.command, secret);
  await adb.sendCommand(input.deviceId, envelope);
  return envelope;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
