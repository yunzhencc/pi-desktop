import type { AttachmentFailure, AttachmentMetadata } from '../main/attachments';
import type { PiSessionSnapshot, PiSessionSummary, PiUsageStats, TranscriptUpdate } from '../main/pi-runtime';
import type { ModelPickerScope, ProviderId, ProvidersSnapshot, WorkspaceSnapshot } from '../shared/types';
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
  composer: {
    addDroppedAttachments: (paths: string[]): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> => ipcRenderer.invoke('composer:add-attachments', paths),
    addPastedImage: (name: string, data: string): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> => ipcRenderer.invoke('composer:add-pasted-image', name, data),
    editLastUserMessage: (text?: string): Promise<string | undefined> => ipcRenderer.invoke('composer:edit-last-user-message', text),
    forkAssistantMessage: (entryId: string): Promise<PiSessionSnapshot> => ipcRenderer.invoke('composer:fork-assistant-message', entryId),
    newConversation: (): Promise<void> => ipcRenderer.invoke('composer:new-conversation'),
    removeAttachment: (id: string): Promise<void> => ipcRenderer.invoke('composer:remove-attachment', id),
    send: (prompt: string, attachmentIds: string[]): Promise<void> => ipcRenderer.invoke('composer:send', prompt, attachmentIds),
    stop: (): Promise<void> => ipcRenderer.invoke('composer:stop'),
    onUpdate: (callback: (update: TranscriptUpdate) => void) => {
      const listener = (_: Electron.IpcRendererEvent, update: TranscriptUpdate) => callback(update);
      ipcRenderer.on('composer:update', listener);
      return () => ipcRenderer.removeListener('composer:update', listener);
    },
  },
  providers: {
    get: (): Promise<ProvidersSnapshot> => ipcRenderer.invoke('providers:get'),
    loginChatGPT: (): Promise<ProvidersSnapshot> => ipcRenderer.invoke('providers:chatgpt:login'),
    onChanged: (callback: (snapshot: ProvidersSnapshot) => void) => {
      const listener = (_: Electron.IpcRendererEvent, snapshot: ProvidersSnapshot) => callback(snapshot);
      ipcRenderer.on('providers:changed', listener);
      return () => ipcRenderer.removeListener('providers:changed', listener);
    },
    remove: (providerId: ProviderId): Promise<ProvidersSnapshot> => ipcRenderer.invoke('providers:remove', providerId),
    saveApiKey: (providerId: ProviderId, apiKey: string): Promise<ProvidersSnapshot> => ipcRenderer.invoke('providers:api-key:save', providerId, apiKey),
    setDefaultModel: (providerId: ProviderId, modelId: string): Promise<ProvidersSnapshot> => ipcRenderer.invoke('providers:default-model:set', providerId, modelId),
    setModelPickerScope: (scope: ModelPickerScope): Promise<ProvidersSnapshot> => ipcRenderer.invoke('providers:scope:set', scope),
    setPrimaryProvider: (providerId: ProviderId): Promise<ProvidersSnapshot> => ipcRenderer.invoke('providers:primary:set', providerId),
  },
  sessions: {
    getUsageStats: (workspacePath: string): Promise<PiUsageStats> => ipcRenderer.invoke('sessions:get-usage-stats', workspacePath),
    list: (workspacePath: string): Promise<PiSessionSummary[]> => ipcRenderer.invoke('sessions:list', workspacePath),
    open: (workspacePath: string, sessionPath: string): Promise<{ session: PiSessionSnapshot; workspace: WorkspaceSnapshot }> => ipcRenderer.invoke('sessions:open', workspacePath, sessionPath),
    setPinned: (workspacePath: string, sessionPath: string, pinned: boolean, beforeSessionPath?: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('sessions:set-pinned', workspacePath, sessionPath, pinned, beforeSessionPath),
  },
  workspaces: {
    clear: (): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:clear'),
    get: (): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:get'),
    getGitBranch: (path: string): Promise<string | undefined> => ipcRenderer.invoke('workspaces:get-git-branch', path),
    pickDirectory: (): Promise<string | undefined> => ipcRenderer.invoke('workspaces:pick-directory'),
    openDirectory: (path: string): Promise<void> => ipcRenderer.invoke('workspaces:open-directory', path),
    create: (name: string, path: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:create', name, path),
    update: (path: string, name: string, nextPath: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:update', path, name, nextPath),
    select: (path: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:select', path),
    setPinned: (workspacePath: string, pinned: boolean, beforeWorkspacePath?: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:set-pinned', workspacePath, pinned, beforeWorkspacePath),
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
