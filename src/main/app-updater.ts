import type { AppUpdateSnapshot, AppUpdateState } from '@shared/types';
import process from 'node:process';
import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

type Listener = (snapshot: AppUpdateSnapshot) => void;

export class AppUpdater {
  #listeners = new Set<Listener>();
  #snapshot: AppUpdateSnapshot = { state: 'idle' };

  constructor() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('checking-for-update', () => this.#setState('checking'));
    autoUpdater.on('update-available', () => this.#setState('downloading'));
    autoUpdater.on('update-not-available', () => this.#setState('idle'));
    autoUpdater.on('download-progress', progress => this.#setState('downloading', progress.percent));
    autoUpdater.on('update-downloaded', () => this.#setState('ready'));
    autoUpdater.on('error', () => this.#setState('idle'));
  }

  snapshot(): AppUpdateSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  start(): void {
    if (!app.isPackaged || process.env.SNAP)
      return;
    void autoUpdater.checkForUpdates().catch(() => this.#setState('idle'));
  }

  async install(hasActiveSession: boolean): Promise<void> {
    if (this.#snapshot.state !== 'ready')
      return;

    if (process.platform === 'darwin' && hasActiveSession) {
      const { response } = await dialog.showMessageBox({
        buttons: ['Update', 'Cancel'],
        cancelId: 1,
        defaultId: 0,
        detail: `${app.getName()} will quit to install the update, which will interrupt active local sessions on this machine.`,
        message: `Update ${app.getName()} now?`,
        type: 'warning',
      });
      if (response !== 0)
        return;
    }

    this.#setState('installing');
    autoUpdater.quitAndInstall();
  }

  #setState(state: AppUpdateState, downloadProgressPercent?: number): void {
    this.#snapshot = {
      ...(downloadProgressPercent == null ? {} : { downloadProgressPercent: Math.round(downloadProgressPercent) }),
      state,
    };
    for (const listener of this.#listeners)
      listener(this.#snapshot);
  }
}
