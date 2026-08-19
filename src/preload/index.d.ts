import type { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      windowControls: {
        getIsFullscreen: () => Promise<boolean>;
        onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void;
        getIsOpaqueSurface: () => Promise<boolean>;
        onOpaqueSurfaceChange: (callback: (opaque: boolean) => void) => () => void;
      };
    };
  }
}

export {};
