import type { AttachmentFailure, AttachmentMetadata } from '../main/attachments';
import type { PiSessionSnapshot, PiSessionSummary, PiUsageStats, TranscriptUpdate } from '../main/pi-runtime';
import type { ModelPickerScope, ProviderId, ProvidersSnapshot, WorkspaceSnapshot } from '../shared/types';
import process from 'node:process';
import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

// Custom APIs for renderer
const api = {
  windowControls: {
    getIsFullscreen: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WindowIsFullScreen),
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
      const listener = (_: Electron.IpcRendererEvent, isFullscreen: boolean) => callback(isFullscreen);
      ipcRenderer.on(IPC_CHANNELS.WindowFullScreenChanged, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WindowFullScreenChanged, listener);
    },
    getIsOpaqueSurface: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WindowIsOpaqueSurface),
    setThemeSource: (theme: 'system' | 'light' | 'dark'): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WindowSetThemeSource, theme),
    onOpaqueSurfaceChange: (callback: (opaque: boolean) => void) => {
      const listener = (_: Electron.IpcRendererEvent, opaque: boolean) => callback(opaque);
      ipcRenderer.on(IPC_CHANNELS.WindowOpaqueSurfaceChanged, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WindowOpaqueSurfaceChanged, listener);
    },
  },
  composer: {
    addDroppedAttachments: (paths: string[]): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> => ipcRenderer.invoke(IPC_CHANNELS.ComposerAddAttachments, paths),
    addPastedImage: (name: string, data: string): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> => ipcRenderer.invoke(IPC_CHANNELS.ComposerAddPastedImage, name, data),
    editLastUserMessage: (text?: string): Promise<string | undefined> => ipcRenderer.invoke(IPC_CHANNELS.ComposerEditLastUserMessage, text),
    forkAssistantMessage: (entryId: string): Promise<PiSessionSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.ComposerForkAssistantMessage, entryId),
    newConversation: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.ComposerNewConversation),
    removeAttachment: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.ComposerRemoveAttachment, id),
    send: (prompt: string, attachmentIds: string[]): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.ComposerSend, prompt, attachmentIds),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.ComposerStop),
    onUpdate: (callback: (update: TranscriptUpdate) => void) => {
      const listener = (_: Electron.IpcRendererEvent, update: TranscriptUpdate) => callback(update);
      ipcRenderer.on(IPC_CHANNELS.ComposerUpdate, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.ComposerUpdate, listener);
    },
  },
  providers: {
    get: (): Promise<ProvidersSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.ProvidersGet),
    loginChatGPT: (): Promise<ProvidersSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.ProvidersChatGptLogin),
    onChanged: (callback: (snapshot: ProvidersSnapshot) => void) => {
      const listener = (_: Electron.IpcRendererEvent, snapshot: ProvidersSnapshot) => callback(snapshot);
      ipcRenderer.on(IPC_CHANNELS.ProvidersChanged, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.ProvidersChanged, listener);
    },
    remove: (providerId: ProviderId): Promise<ProvidersSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.ProvidersRemove, providerId),
    saveApiKey: (providerId: ProviderId, apiKey: string): Promise<ProvidersSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.ProvidersApiKeySave, providerId, apiKey),
    setDefaultModel: (providerId: ProviderId, modelId: string): Promise<ProvidersSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.ProvidersDefaultModelSet, providerId, modelId),
    setModelPickerScope: (scope: ModelPickerScope): Promise<ProvidersSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.ProvidersScopeSet, scope),
    setPrimaryProvider: (providerId: ProviderId): Promise<ProvidersSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.ProvidersPrimarySet, providerId),
  },
  sessions: {
    getUsageStats: (workspacePath: string): Promise<PiUsageStats> => ipcRenderer.invoke(IPC_CHANNELS.SessionsGetUsageStats, workspacePath),
    list: (workspacePath: string): Promise<PiSessionSummary[]> => ipcRenderer.invoke(IPC_CHANNELS.SessionsList, workspacePath),
    open: (workspacePath: string, sessionPath: string): Promise<{ session: PiSessionSnapshot; workspace: WorkspaceSnapshot }> => ipcRenderer.invoke(IPC_CHANNELS.SessionsOpen, workspacePath, sessionPath),
    setPinned: (workspacePath: string, sessionPath: string, pinned: boolean, beforeSessionPath?: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.SessionsSetPinned, workspacePath, sessionPath, pinned, beforeSessionPath),
  },
  workspaces: {
    clear: (): Promise<WorkspaceSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesClear),
    get: (): Promise<WorkspaceSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesGet),
    getGitBranch: (path: string): Promise<string | undefined> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesGetGitBranch, path),
    pickDirectory: (): Promise<string | undefined> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesPickDirectory),
    openDirectory: (path: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesOpenDirectory, path),
    create: (name: string, path: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesCreate, name, path),
    update: (path: string, name: string, nextPath: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesUpdate, path, name, nextPath),
    select: (path: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesSelect, path),
    setPinned: (workspacePath: string, pinned: boolean, beforeWorkspacePath?: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.WorkspacesSetPinned, workspacePath, pinned, beforeWorkspacePath),
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
