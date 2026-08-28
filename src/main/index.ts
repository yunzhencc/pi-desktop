import { join } from 'node:path';
import process from 'node:process';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { IPC_CHANNELS } from '@shared/ipc-channels';
import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron';
import icon from '../../resources/icon.png?asset';
import { AppUpdater } from './app-updater';
import { AttachmentStore } from './attachments';
import { registerAllHandlers } from './ipc';
import { PiRuntime } from './pi-runtime';
import { ProviderSettings } from './provider-settings';
import {
  getPrimaryWindowBounds,
  PRIMARY_WINDOW_MINIMUM_SIZE,
  readPrimaryWindowState,
  writePrimaryWindowState,
} from './window-state';
import { WorkspaceRegistry } from './workspaces';

let isPrimaryWindowOpaque = false;
let syncPrimaryWindowBackdrop: (() => void) | undefined;
const attachmentStore = new AttachmentStore();
const appUpdater = new AppUpdater();
const piRuntime = new PiRuntime(attachmentStore);
let providerSettings: ProviderSettings;
let workspaceRegistry: WorkspaceRegistry;

function getPrimaryWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

function getWorkspacesPath(): string {
  return join(app.getPath('userData'), 'workspaces.json');
}

function createWindow(): void {
  const restoredBounds = getPrimaryWindowBounds(
    readPrimaryWindowState(getPrimaryWindowStatePath()),
    screen.getAllDisplays().map(display => display.workArea),
    process.platform,
    screen.getPrimaryDisplay().workArea,
  );
  const { isMaximized, ...windowBounds } = restoredBounds;

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: PRIMARY_WINDOW_MINIMUM_SIZE.width,
    minHeight: PRIMARY_WINDOW_MINIMUM_SIZE.height,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? {
          backgroundColor: '#00000000',
          titleBarStyle: 'hiddenInset',
          vibrancy: 'menu',
          trafficLightPosition: {
            x: 16,
            y: Math.round((46 - 14) / 2),
          },
        }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  if (process.platform === 'darwin') {
    const syncWindowBackdrop = () => {
      const opaque = !mainWindow.isFocused();
      isPrimaryWindowOpaque = opaque;
      mainWindow.setBackgroundColor(opaque
        ? nativeTheme.shouldUseDarkColors ? '#000000' : '#f9f9f9'
        : '#00000000');
      mainWindow.setVibrancy(opaque ? null : 'menu');
      mainWindow.webContents.send(IPC_CHANNELS.WindowOpaqueSurfaceChanged, opaque);
    };
    syncPrimaryWindowBackdrop = syncWindowBackdrop;
    const syncTrafficLightPosition = () => {
      mainWindow.setWindowButtonPosition({
        x: 16,
        y: Math.round((46 * mainWindow.webContents.getZoomFactor() - 14) / 2),
      });
    };
    mainWindow.webContents.on('did-finish-load', () => {
      syncTrafficLightPosition();
      mainWindow.webContents.send(IPC_CHANNELS.WindowOpaqueSurfaceChanged, isPrimaryWindowOpaque);
    });
    mainWindow.webContents.on('zoom-changed', syncTrafficLightPosition);
    mainWindow.on('focus', syncWindowBackdrop);
    mainWindow.on('blur', syncWindowBackdrop);
    mainWindow.on('show', syncWindowBackdrop);
    mainWindow.on('hide', syncWindowBackdrop);
    syncWindowBackdrop();
    mainWindow.on('closed', () => {
      if (syncPrimaryWindowBackdrop === syncWindowBackdrop)
        syncPrimaryWindowBackdrop = undefined;
    });
  }

  mainWindow.on('ready-to-show', () => {
    if (isMaximized)
      mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    const bounds = mainWindow.getNormalBounds();
    writePrimaryWindowState(getPrimaryWindowStatePath(), {
      ...bounds,
      width: Math.max(bounds.width, PRIMARY_WINDOW_MINIMUM_SIZE.width),
      height: Math.max(bounds.height, PRIMARY_WINDOW_MINIMUM_SIZE.height),
      isMaximized: mainWindow.isMaximized(),
    });
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send(IPC_CHANNELS.WindowFullScreenChanged, true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send(IPC_CHANNELS.WindowFullScreenChanged, false);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  }
  else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');
  providerSettings = new ProviderSettings(app.getPath('userData'), { openExternal: url => shell.openExternal(url).then(() => undefined) });
  workspaceRegistry = new WorkspaceRegistry(getWorkspacesPath());
  const workspaceSnapshot = await workspaceRegistry.load();
  if (workspaceSnapshot.selectedWorkspacePath)
    piRuntime.setWorkspace(workspaceSnapshot.selectedWorkspacePath);

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerAllHandlers({
    attachmentStore,
    appUpdater,
    getIsPrimaryWindowOpaque: () => isPrimaryWindowOpaque,
    piRuntime,
    providerSettings,
    syncPrimaryWindowBackdrop: () => syncPrimaryWindowBackdrop?.(),
    workspaceRegistry,
  });
  nativeTheme.on('updated', () => syncPrimaryWindowBackdrop?.());

  createWindow();
  appUpdater.start();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.once('before-quit', () => piRuntime.dispose());

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
