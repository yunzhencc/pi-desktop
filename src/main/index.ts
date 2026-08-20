import type { DeepSeekModel } from './deepseek-settings';
import { join } from 'node:path';
import process from 'node:process';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, safeStorage, screen, shell } from 'electron';
import icon from '../../resources/icon.png?asset';
import { AttachmentStore } from './attachments';
import { createComposerHandlers } from './composer-ipc';
import { DeepSeekSettings } from './deepseek-settings';
import { PiRuntime } from './pi-runtime';
import {
  getPrimaryWindowBounds,
  PRIMARY_WINDOW_MINIMUM_SIZE,
  readPrimaryWindowState,
  writePrimaryWindowState,
} from './window-state';
import { getWorkspaceGitBranch, WorkspaceRegistry } from './workspaces';

let isPrimaryWindowOpaque = false;
let syncPrimaryWindowBackdrop: (() => void) | undefined;
const attachmentStore = new AttachmentStore();
const piRuntime = new PiRuntime(attachmentStore, { agentDir: join(app.getPath('userData'), 'pi-agent') });
let deepseekSettings: DeepSeekSettings;
let workspaceRegistry: WorkspaceRegistry;

function getPrimaryWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

function getDeepSeekSettingsPath(): string {
  return join(app.getPath('userData'), 'providers', 'deepseek.json');
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
      mainWindow.webContents.send('window-opaque-surface-changed', opaque);
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
      mainWindow.webContents.send('window-opaque-surface-changed', isPrimaryWindowOpaque);
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
    mainWindow.webContents.send('window-fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window-fullscreen-changed', false);
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
  deepseekSettings = new DeepSeekSettings(getDeepSeekSettingsPath(), safeStorage);
  const loadDeepSeek = async () => {
    if (!deepseekSettings.configuration())
      piRuntime.configureDeepSeek(await deepseekSettings.load());
  };
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

  // IPC test
  // eslint-disable-next-line no-console
  ipcMain.on('ping', () => console.log('pong'));
  ipcMain.handle('window:is-full-screen', event => BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false);
  ipcMain.handle('window:is-opaque-surface', () => isPrimaryWindowOpaque);
  ipcMain.handle('window:set-theme-source', (_event, themeSource: unknown) => {
    if (themeSource !== 'system' && themeSource !== 'light' && themeSource !== 'dark')
      throw new TypeError('Invalid theme source');

    nativeTheme.themeSource = themeSource;
    syncPrimaryWindowBackdrop?.();
  });
  ipcMain.handle('providers:deepseek:get', async () => {
    await loadDeepSeek();
    return deepseekSettings.snapshot();
  });
  ipcMain.handle('providers:deepseek:save', async (_event, apiKey: unknown, model: unknown) => {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('系统密钥存储不可用，无法保存 DeepSeek API Key');
    if (typeof apiKey !== 'string' || (model !== 'deepseek-v4-flash' && model !== 'deepseek-v4-pro'))
      throw new TypeError('无效的 DeepSeek 配置');

    const snapshot = await deepseekSettings.save(apiKey, model as DeepSeekModel);
    piRuntime.configureDeepSeek(deepseekSettings.configuration());
    return snapshot;
  });
  const selectWorkspace = async (path: string) => {
    const snapshot = await workspaceRegistry.select(path);
    piRuntime.setWorkspace(snapshot.selectedWorkspacePath!);
    return snapshot;
  };
  ipcMain.handle('workspaces:get', () => workspaceRegistry.snapshot());
  ipcMain.handle('workspaces:set-pinned', (_event, workspacePath: unknown, pinned: unknown, beforeWorkspacePath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim() || typeof pinned !== 'boolean' || (beforeWorkspacePath !== undefined && typeof beforeWorkspacePath !== 'string'))
      throw new TypeError('无效的项目置顶请求');
    return workspaceRegistry.setWorkspacePinned(workspacePath, pinned, beforeWorkspacePath);
  });
  ipcMain.handle('workspaces:clear', async () => {
    const snapshot = await workspaceRegistry.clear();
    piRuntime.clearWorkspace();
    return snapshot;
  });
  ipcMain.handle('workspaces:get-git-branch', (_event, path: unknown) => {
    if (typeof path !== 'string' || !path.trim())
      throw new TypeError('无效的工作区路径');
    return getWorkspaceGitBranch(path);
  });
  ipcMain.handle('sessions:list', (_event, workspacePath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim())
      throw new TypeError('无效的工作区路径');
    return piRuntime.listWorkspaceSessions(workspacePath);
  });
  ipcMain.handle('sessions:open', async (_event, workspacePath: unknown, sessionPath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim() || typeof sessionPath !== 'string' || !sessionPath.trim())
      throw new TypeError('无效的会话');
    const sessions = await piRuntime.listWorkspaceSessions(workspacePath);
    if (!sessions.some(session => session.path === sessionPath))
      throw new TypeError('会话不属于该工作区');
    const snapshot = await selectWorkspace(workspacePath);
    return { session: await piRuntime.openSession(sessionPath), workspace: snapshot };
  });
  ipcMain.handle('sessions:set-pinned', async (_event, workspacePath: unknown, sessionPath: unknown, pinned: unknown, beforeSessionPath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim() || typeof sessionPath !== 'string' || !sessionPath.trim() || typeof pinned !== 'boolean' || (beforeSessionPath !== undefined && typeof beforeSessionPath !== 'string'))
      throw new TypeError('无效的会话置顶请求');
    const sessions = await piRuntime.listWorkspaceSessions(workspacePath);
    if (!sessions.some(session => session.path === sessionPath) || (beforeSessionPath !== undefined && !sessions.some(session => session.path === beforeSessionPath)))
      throw new TypeError('会话不属于该工作区');
    return workspaceRegistry.setSessionPinned(sessionPath, pinned, beforeSessionPath);
  });
  ipcMain.handle('workspaces:pick-directory', async (event) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender) ?? undefined, {
      properties: ['openDirectory'],
      title: '选择源文件夹',
    });
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle('workspaces:open-directory', async (_event, path: unknown) => {
    if (typeof path !== 'string' || !path.trim())
      throw new TypeError('无效的工作区路径');
    const error = await shell.openPath(path);
    if (error)
      throw new Error(error);
  });
  ipcMain.handle('workspaces:create', async (_event, name: unknown, path: unknown) => {
    if (typeof name !== 'string' || typeof path !== 'string' || !path.trim())
      throw new TypeError('无效的项目');
    const snapshot = await workspaceRegistry.create(path, name);
    piRuntime.setWorkspace(snapshot.selectedWorkspacePath!);
    return snapshot;
  });
  ipcMain.handle('workspaces:update', async (_event, path: unknown, name: unknown, nextPath: unknown) => {
    if (typeof path !== 'string' || !path.trim() || typeof name !== 'string' || typeof nextPath !== 'string' || !nextPath.trim())
      throw new TypeError('无效的项目');
    const snapshot = await workspaceRegistry.update(path, nextPath, name);
    if (snapshot.selectedWorkspacePath === nextPath)
      piRuntime.setWorkspace(nextPath);
    return snapshot;
  });
  ipcMain.handle('workspaces:select', (_event, path: unknown) => {
    if (typeof path !== 'string' || !path.trim())
      throw new TypeError('无效的工作区路径');
    return selectWorkspace(path);
  });
  nativeTheme.on('updated', () => syncPrimaryWindowBackdrop?.());

  const composer = createComposerHandlers(
    attachmentStore,
    async (prompt, attachmentIds) => {
      await loadDeepSeek();
      return piRuntime.send(prompt, attachmentIds);
    },
    () => piRuntime.startNewConversation(),
  );
  ipcMain.handle('composer:add-attachments', (_event, paths: unknown) => {
    if (!Array.isArray(paths) || !paths.every(path => typeof path === 'string'))
      throw new TypeError('Invalid attachment paths');
    return composer.addAttachments(paths);
  });
  ipcMain.handle('composer:add-pasted-image', (_event, name: unknown, data: unknown) => {
    if (typeof name !== 'string' || typeof data !== 'string')
      throw new TypeError('Invalid pasted image');
    return composer.addPastedImage(name, data);
  });
  ipcMain.handle('composer:remove-attachment', (_event, id: unknown) => {
    if (typeof id !== 'string')
      throw new TypeError('Invalid attachment ID');
    composer.removeAttachment(id);
  });
  ipcMain.handle('composer:send', (_event, prompt: unknown, attachmentIds: unknown) => {
    if (typeof prompt !== 'string' || !Array.isArray(attachmentIds) || !attachmentIds.every(id => typeof id === 'string'))
      throw new TypeError('Invalid composer input');
    return composer.send(prompt, attachmentIds);
  });
  ipcMain.handle('composer:edit-last-user-message', (_event, message: unknown) => {
    if (message !== undefined && typeof message !== 'string')
      throw new TypeError('Invalid edited message');
    return piRuntime.editLastUserMessage(message);
  });
  ipcMain.handle('composer:fork-assistant-message', (_event, entryId: unknown) => {
    if (typeof entryId !== 'string' || !entryId)
      throw new TypeError('无效的回复');
    return piRuntime.forkAssistantMessage(entryId);
  });
  ipcMain.handle('composer:new-conversation', () => composer.startNewConversation());
  ipcMain.handle('composer:stop', () => piRuntime.abort());
  piRuntime.subscribe((update) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('composer:update', update);
  });

  createWindow();

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
