const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uniequbController', {
  listDevices: () => ipcRenderer.invoke('adb:listDevices'),
  launchApp: deviceId => ipcRenderer.invoke('adb:launchApp', deviceId),
  sendCommand: (deviceId, command) => ipcRenderer.invoke('adb:sendCommand', { deviceId, command }),
  loginAdmin: credentials => ipcRenderer.invoke('backend:loginAdmin', credentials),
  getSnapshot: token => ipcRenderer.invoke('backend:getSnapshot', { token }),
  runBackendCommand: (token, command) => ipcRenderer.invoke('backend:runCommand', { token, command }),
});
