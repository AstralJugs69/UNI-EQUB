const { execFile } = require('node:child_process');
const os = require('node:os');

const APP_ID = 'com.uniequb';

function execAdb(args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(options.adbPath || 'adb', args, { timeout: options.timeoutMs || 8000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(String(stdout));
    });
  });
}

function parseAdbDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [id, state, ...rest] = line.split(/\s+/);
      const meta = Object.fromEntries(rest.map(part => {
        const index = part.indexOf(':');
        return index > 0 ? [part.slice(0, index), part.slice(index + 1)] : [part, true];
      }));
      return {
        id,
        transport: state,
        model: meta.model || null,
        product: meta.product || null,
        authorized: state === 'device',
      };
    });
}

async function hasAppInstalled(deviceId) {
  try {
    const output = await execAdb(['-s', deviceId, 'shell', 'pm', 'path', APP_ID]);
    return output.includes(`package:`);
  } catch {
    return false;
  }
}

async function isAppRunning(deviceId) {
  try {
    const output = await execAdb(['-s', deviceId, 'shell', 'pidof', APP_ID]);
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

async function listSimulationDevices() {
  const output = await execAdb(['devices', '-l']);
  const devices = parseAdbDevices(output);
  const enriched = await Promise.all(devices.map(async device => {
    const appInstalled = device.authorized ? await hasAppInstalled(device.id) : false;
    const appRunning = appInstalled ? await isAppRunning(device.id) : false;
    return { ...device, appInstalled, appRunning };
  }));
  return enriched.filter(device => device.appInstalled || !device.authorized);
}

async function launchApp(deviceId) {
  await execAdb(['-s', deviceId, 'shell', 'monkey', '-p', APP_ID, '1']);
  return true;
}

async function sendCommand(deviceId, envelope) {
  const encoded = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');
  await execAdb([
    '-s',
    deviceId,
    'shell',
    'am',
    'start',
    '-n',
    `${APP_ID}/.MainActivity`,
    '-a',
    `${APP_ID}.SIM_COMMAND`,
    '--es',
    'payload',
    encoded,
  ]);
  return true;
}

function defaultAdbHints() {
  const home = os.homedir();
  return [
    'adb',
    `${home}\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe`,
    `${home}/Library/Android/sdk/platform-tools/adb`,
    '/usr/local/bin/adb',
  ];
}

module.exports = {
  APP_ID,
  defaultAdbHints,
  execAdb,
  parseAdbDevices,
  listSimulationDevices,
  launchApp,
  sendCommand,
};
