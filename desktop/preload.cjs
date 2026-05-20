const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uniequbController', {
  listDevices: () => ipcRenderer.invoke('adb:listDevices'),
  launchApp: deviceId => ipcRenderer.invoke('adb:launchApp', deviceId),
  sendCommand: (deviceId, command) => ipcRenderer.invoke('adb:sendCommand', { deviceId, command }),
});
