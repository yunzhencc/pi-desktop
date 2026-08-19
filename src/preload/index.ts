import process from 'node:process';
import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer } from 'electron';

// Custom APIs for renderer
const api = {
  windowControls: {
    getIsFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:is-full-screen'),
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
      const listener = (_: Electron.IpcRendererEvent, isFullscreen: boolean) => callback(isFullscreen);
      ipcRenderer.on('window-fullscreen-changed', listener);
      return () => ipcRenderer.removeListener('window-fullscreen-changed', listener);
    },
    getIsOpaqueSurface: (): Promise<boolean> => ipcRenderer.invoke('window:is-opaque-surface'),
    setThemeSource: (theme: 'system' | 'light' | 'dark'): Promise<void> => ipcRenderer.invoke('window:set-theme-source', theme),
    onOpaqueSurfaceChange: (callback: (opaque: boolean) => void) => {
      const listener = (_: Electron.IpcRendererEvent, opaque: boolean) => callback(opaque);
      ipcRenderer.on('window-opaque-surface-changed', listener);
      return () => ipcRenderer.removeListener('window-opaque-surface-changed', listener);
    },
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  }
  catch (error) {
    console.error(error);
  }
}
else {
  // @ts-expect-error 暂时忽略
  window.electron = electronAPI;
  // @ts-expect-error 暂时忽略
  window.api = api;
}
