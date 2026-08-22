import process from 'node:process';
import { contextBridge, ipcRenderer } from 'electron';
import { createPiAppAPI } from './pi-app-api';

const piApp = createPiAppAPI({
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
  },
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
});

// Expose only the app-owned preload API to the renderer.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('piApp', piApp);
  }
  catch (error) {
    console.error(error);
  }
}
else {
  // @ts-expect-error 暂时忽略
  window.piApp = piApp;
}
