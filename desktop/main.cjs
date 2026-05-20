const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
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

function readMobileEnv() {
  const envPath = path.join(__dirname, '..', 'mobile', '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.match(/^\s*(?:\$env:)?([^#=]+?)\s*=\s*['"]?(.*?)['"]?\s*$/))
    .filter(Boolean)
    .map(match => [match[1].trim(), match[2].trim()]));
}

function controllerConfig() {
  const fileEnv = readMobileEnv();
  return {
    supabaseUrl: process.env.UNIEQUB_SUPABASE_URL || fileEnv.UNIEQUB_SUPABASE_URL,
    anonKey: process.env.UNIEQUB_SUPABASE_ANON_KEY || fileEnv.UNIEQUB_SUPABASE_ANON_KEY,
    controllerSecret: process.env.UNIEQUB_CONTROLLER_SECRET || fileEnv.UNIEQUB_CONTROLLER_SECRET || 'local-dev-controller',
  };
}

async function invokeFunction(functionName, body, headers = {}) {
  const config = controllerConfig();
  if (!config.supabaseUrl || !config.anonKey) {
    throw new Error('Supabase URL/key are missing. Set UNIEQUB_SUPABASE_URL and UNIEQUB_SUPABASE_ANON_KEY.');
  }
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text };
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || payload?.message || `Function ${functionName} failed with ${response.status}.`);
  }
  return payload?.data ?? payload;
}

async function loginAdmin(input) {
  const data = await invokeFunction('register-login', {
    action: 'login',
    login: {
      phoneNumber: input.phoneNumber,
      password: input.password,
      roleHint: 'Admin',
    },
  });
  return data;
}

async function invokeSimulation(body) {
  const config = controllerConfig();
  return invokeFunction('simulation-controller', {
    ...body,
    controllerSecret: config.controllerSecret,
  }, {
    'x-uniequb-controller-secret': config.controllerSecret,
  });
}

ipcMain.handle('adb:listDevices', async () => adb.listSimulationDevices());
ipcMain.handle('adb:launchApp', async (_event, deviceId) => adb.launchApp(deviceId));
ipcMain.handle('adb:sendCommand', async (_event, input) => {
  const secret = process.env.UNIEQUB_CONTROLLER_SECRET || 'local-dev-controller';
  const envelope = signing.signCommand(input.command, secret);
  await adb.sendCommand(input.deviceId, envelope);
  return envelope;
});
ipcMain.handle('backend:loginAdmin', async (_event, input) => loginAdmin(input));
ipcMain.handle('backend:getSnapshot', async (_event, input) => invokeSimulation({ action: 'getSnapshot', token: input.token }));
ipcMain.handle('backend:runCommand', async (_event, input) => invokeSimulation({ action: 'runCommand', token: input.token, command: input.command }));

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
