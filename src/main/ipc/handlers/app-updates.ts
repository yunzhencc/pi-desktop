import type { AppUpdater } from '../../app-updater';
import type { PiRuntime } from '../../pi-runtime';
import { IPC_CHANNELS } from '@shared/ipc-channels';
import { BrowserWindow } from 'electron';
import { registerHandler } from '../registry';

interface AppUpdateHandlerDependencies {
  appUpdater: AppUpdater;
  piRuntime: PiRuntime;
}

export function registerAppUpdateHandlers({ appUpdater, piRuntime }: AppUpdateHandlerDependencies): void {
  registerHandler(IPC_CHANNELS.AppUpdatesGet, () => appUpdater.snapshot());
  registerHandler(IPC_CHANNELS.AppUpdatesInstall, () => appUpdater.install(piRuntime.hasActiveSession()));
  appUpdater.subscribe((snapshot) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send(IPC_CHANNELS.AppUpdatesChanged, snapshot);
  });
}
