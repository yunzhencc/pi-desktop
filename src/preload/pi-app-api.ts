import type {
  AppUpdateSnapshot,
  AttachmentFailure,
  AttachmentMetadata,
  ModelPickerScope,
  PiSessionSnapshot,
  PiSessionSummary,
  PiUsageStats,
  ProviderId,
  ProvidersSnapshot,
  TranscriptUpdate,
  WorkspaceSnapshot,
} from '../shared/types';
import { webUtils } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

type IpcListener = (event: unknown, ...args: unknown[]) => void;

export interface PiAppIpc {
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
  on: (channel: string, listener: IpcListener) => void;
  removeListener: (channel: string, listener: IpcListener) => void;
}

function onValue<T>(ipc: PiAppIpc, channel: string, callback: (value: T) => void) {
  const listener: IpcListener = (_, value) => callback(value as T);
  ipc.on(channel, listener);
  return () => ipc.removeListener(channel, listener);
}

export function createPiAppAPI(ipc: PiAppIpc) {
  return {
    appUpdates: {
      get: (): Promise<AppUpdateSnapshot> => ipc.invoke(IPC_CHANNELS.AppUpdatesGet),
      install: (): Promise<void> => ipc.invoke(IPC_CHANNELS.AppUpdatesInstall),
      onChanged: (callback: (snapshot: AppUpdateSnapshot) => void) => onValue(ipc, IPC_CHANNELS.AppUpdatesChanged, callback),
    },
    windowControls: {
      getIsFullscreen: (): Promise<boolean> => ipc.invoke(IPC_CHANNELS.WindowIsFullScreen),
      onFullscreenChange: (callback: (isFullscreen: boolean) => void) => onValue(ipc, IPC_CHANNELS.WindowFullScreenChanged, callback),
      getIsOpaqueSurface: (): Promise<boolean> => ipc.invoke(IPC_CHANNELS.WindowIsOpaqueSurface),
      setThemeSource: (theme: 'system' | 'light' | 'dark'): Promise<void> => ipc.invoke(IPC_CHANNELS.WindowSetThemeSource, theme),
      onOpaqueSurfaceChange: (callback: (opaque: boolean) => void) => onValue(ipc, IPC_CHANNELS.WindowOpaqueSurfaceChanged, callback),
    },
    composer: {
      addDroppedAttachments: (paths: string[]): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> => ipc.invoke(IPC_CHANNELS.ComposerAddAttachments, paths),
      addClipboardFiles: (files: File[]): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> => ipc.invoke(
        IPC_CHANNELS.ComposerAddAttachments,
        files.map(file => webUtils.getPathForFile(file)).filter(Boolean),
      ),
      addClipboardAttachments: (): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> => ipc.invoke(IPC_CHANNELS.ComposerAddClipboardAttachments),
      addPastedImage: (name: string, data: string): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> => ipc.invoke(IPC_CHANNELS.ComposerAddPastedImage, name, data),
      editLastUserMessage: (text?: string): Promise<string | undefined> => ipc.invoke(IPC_CHANNELS.ComposerEditLastUserMessage, text),
      forkAssistantMessage: (entryId: string): Promise<PiSessionSnapshot> => ipc.invoke(IPC_CHANNELS.ComposerForkAssistantMessage, entryId),
      newConversation: (): Promise<void> => ipc.invoke(IPC_CHANNELS.ComposerNewConversation),
      revealAttachment: (id: string): Promise<void> => ipc.invoke(IPC_CHANNELS.ComposerRevealAttachment, id),
      removeAttachment: (id: string): Promise<void> => ipc.invoke(IPC_CHANNELS.ComposerRemoveAttachment, id),
      send: (prompt: string, attachmentIds: string[]): Promise<void> => ipc.invoke(IPC_CHANNELS.ComposerSend, prompt, attachmentIds),
      setUserMessageBookmarked: (entryId: string, bookmarked: boolean): Promise<string[]> => ipc.invoke(IPC_CHANNELS.ComposerSetUserMessageBookmarked, entryId, bookmarked),
      stop: (): Promise<void> => ipc.invoke(IPC_CHANNELS.ComposerStop),
      onUpdate: (callback: (update: TranscriptUpdate) => void) => onValue(ipc, IPC_CHANNELS.ComposerUpdate, callback),
    },
    providers: {
      get: (): Promise<ProvidersSnapshot> => ipc.invoke(IPC_CHANNELS.ProvidersGet),
      loginChatGPT: (): Promise<ProvidersSnapshot> => ipc.invoke(IPC_CHANNELS.ProvidersChatGptLogin),
      onChanged: (callback: (snapshot: ProvidersSnapshot) => void) => onValue(ipc, IPC_CHANNELS.ProvidersChanged, callback),
      remove: (providerId: ProviderId): Promise<ProvidersSnapshot> => ipc.invoke(IPC_CHANNELS.ProvidersRemove, providerId),
      saveApiKey: (providerId: ProviderId, apiKey: string): Promise<ProvidersSnapshot> => ipc.invoke(IPC_CHANNELS.ProvidersApiKeySave, providerId, apiKey),
      setDefaultModel: (providerId: ProviderId, modelId: string): Promise<ProvidersSnapshot> => ipc.invoke(IPC_CHANNELS.ProvidersDefaultModelSet, providerId, modelId),
      setModelPickerScope: (scope: ModelPickerScope): Promise<ProvidersSnapshot> => ipc.invoke(IPC_CHANNELS.ProvidersScopeSet, scope),
      setPrimaryProvider: (providerId: ProviderId): Promise<ProvidersSnapshot> => ipc.invoke(IPC_CHANNELS.ProvidersPrimarySet, providerId),
    },
    sessions: {
      getUsageStats: (workspacePath: string): Promise<PiUsageStats> => ipc.invoke(IPC_CHANNELS.SessionsGetUsageStats, workspacePath),
      list: (workspacePath: string): Promise<PiSessionSummary[]> => ipc.invoke(IPC_CHANNELS.SessionsList, workspacePath),
      open: (workspacePath: string, sessionPath: string): Promise<{ session: PiSessionSnapshot; workspace: WorkspaceSnapshot }> => ipc.invoke(IPC_CHANNELS.SessionsOpen, workspacePath, sessionPath),
      setPinned: (workspacePath: string, sessionPath: string, pinned: boolean, beforeSessionPath?: string): Promise<WorkspaceSnapshot> => ipc.invoke(IPC_CHANNELS.SessionsSetPinned, workspacePath, sessionPath, pinned, beforeSessionPath),
    },
    workspaces: {
      clear: (): Promise<WorkspaceSnapshot> => ipc.invoke(IPC_CHANNELS.WorkspacesClear),
      get: (): Promise<WorkspaceSnapshot> => ipc.invoke(IPC_CHANNELS.WorkspacesGet),
      getGitBranch: (path: string): Promise<string | undefined> => ipc.invoke(IPC_CHANNELS.WorkspacesGetGitBranch, path),
      pickDirectory: (): Promise<string | undefined> => ipc.invoke(IPC_CHANNELS.WorkspacesPickDirectory),
      openDirectory: (path: string): Promise<void> => ipc.invoke(IPC_CHANNELS.WorkspacesOpenDirectory, path),
      create: (name: string, path: string): Promise<WorkspaceSnapshot> => ipc.invoke(IPC_CHANNELS.WorkspacesCreate, name, path),
      update: (path: string, name: string, nextPath: string): Promise<WorkspaceSnapshot> => ipc.invoke(IPC_CHANNELS.WorkspacesUpdate, path, name, nextPath),
      select: (path: string): Promise<WorkspaceSnapshot> => ipc.invoke(IPC_CHANNELS.WorkspacesSelect, path),
      setPinned: (workspacePath: string, pinned: boolean, beforeWorkspacePath?: string): Promise<WorkspaceSnapshot> => ipc.invoke(IPC_CHANNELS.WorkspacesSetPinned, workspacePath, pinned, beforeWorkspacePath),
    },
  };
}

export type PiAppAPI = ReturnType<typeof createPiAppAPI>;
