import { IPC_CHANNELS } from '@shared/ipc-channels';
import { BrowserWindow, nativeTheme } from 'electron';
import { registerHandler, registerListener } from '../registry';

interface WindowControlHandlerDependencies {
  getIsPrimaryWindowOpaque: () => boolean;
  syncPrimaryWindowBackdrop: () => void;
}

export function registerWindowControlHandlers(deps: WindowControlHandlerDependencies): void {
  // IPC test
  // eslint-disable-next-line no-console
  registerListener(IPC_CHANNELS.Ping, () => console.log('pong'));
  registerHandler(IPC_CHANNELS.WindowIsFullScreen, event => BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false);
  registerHandler(IPC_CHANNELS.WindowIsOpaqueSurface, () => deps.getIsPrimaryWindowOpaque());
  registerHandler(IPC_CHANNELS.WindowSetThemeSource, (_event, themeSource: unknown) => {
    if (themeSource !== 'system' && themeSource !== 'light' && themeSource !== 'dark')
      throw new TypeError('Invalid theme source');

    nativeTheme.themeSource = themeSource;
    deps.syncPrimaryWindowBackdrop();
  });
}
