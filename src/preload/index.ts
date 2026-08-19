import type { AttachmentFailure, AttachmentMetadata } from '../main/attachments';
import type { DeepSeekModel, DeepSeekSettingsSnapshot } from '../main/deepseek-settings';
import type { PiSessionSnapshot, PiSessionSummary, TranscriptUpdate } from '../main/pi-runtime';
import type { WorkspaceSnapshot } from '../main/workspaces';
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
    getDeepSeek: (): Promise<DeepSeekSettingsSnapshot> => ipcRenderer.invoke('providers:deepseek:get'),
    saveDeepSeek: (apiKey: string, model: DeepSeekModel): Promise<DeepSeekSettingsSnapshot> => ipcRenderer.invoke('providers:deepseek:save', apiKey, model),
  },
  sessions: {
    list: (workspacePath: string): Promise<PiSessionSummary[]> => ipcRenderer.invoke('sessions:list', workspacePath),
    open: (workspacePath: string, sessionPath: string): Promise<{ session: PiSessionSnapshot; workspace: WorkspaceSnapshot }> => ipcRenderer.invoke('sessions:open', workspacePath, sessionPath),
  },
  workspaces: {
    clear: (): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:clear'),
    get: (): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:get'),
    getGitBranch: (path: string): Promise<string | undefined> => ipcRenderer.invoke('workspaces:get-git-branch', path),
    pickDirectory: (): Promise<string | undefined> => ipcRenderer.invoke('workspaces:pick-directory'),
    create: (name: string, path: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:create', name, path),
    select: (path: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('workspaces:select', path),
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
