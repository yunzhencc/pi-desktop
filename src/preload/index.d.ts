import type { ElectronAPI } from '@electron-toolkit/preload';
import type { AttachmentFailure, AttachmentMetadata } from '../main/attachments';
import type { PiSessionSnapshot, PiSessionSummary, PiUsageStats, TranscriptUpdate } from '../main/pi-runtime';
import type { ModelPickerScope, ProviderId, ProvidersSnapshot } from '../main/provider-settings';
import type { WorkspaceSnapshot } from '../main/workspaces';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      windowControls: {
        getIsFullscreen: () => Promise<boolean>;
        onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void;
        getIsOpaqueSurface: () => Promise<boolean>;
        setThemeSource: (theme: 'system' | 'light' | 'dark') => Promise<void>;
        onOpaqueSurfaceChange: (callback: (opaque: boolean) => void) => () => void;
      };
      composer: {
        addDroppedAttachments: (paths: string[]) => Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }>;
        addPastedImage: (name: string, data: string) => Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }>;
        editLastUserMessage: (text?: string) => Promise<string | undefined>;
        newConversation: () => Promise<void>;
        removeAttachment: (id: string) => Promise<void>;
        send: (prompt: string, attachmentIds: string[]) => Promise<void>;
        stop: () => Promise<void>;
        onUpdate: (callback: (update: TranscriptUpdate) => void) => () => void;
      };
      providers: {
        get: () => Promise<ProvidersSnapshot>;
        loginChatGPT: () => Promise<ProvidersSnapshot>;
        onChanged: (callback: (snapshot: ProvidersSnapshot) => void) => () => void;
        remove: (providerId: ProviderId) => Promise<ProvidersSnapshot>;
        saveApiKey: (providerId: ProviderId, apiKey: string) => Promise<ProvidersSnapshot>;
        setDefaultModel: (providerId: ProviderId, modelId: string) => Promise<ProvidersSnapshot>;
        setModelPickerScope: (scope: ModelPickerScope) => Promise<ProvidersSnapshot>;
        setPrimaryProvider: (providerId: ProviderId) => Promise<ProvidersSnapshot>;
      };
      sessions: {
        getUsageStats: (workspacePath: string) => Promise<PiUsageStats>;
        list: (workspacePath: string) => Promise<PiSessionSummary[]>;
        open: (workspacePath: string, sessionPath: string) => Promise<{ session: PiSessionSnapshot; workspace: WorkspaceSnapshot }>;
        setPinned: (workspacePath: string, sessionPath: string, pinned: boolean, beforeSessionPath?: string) => Promise<WorkspaceSnapshot>;
      };
      workspaces: {
        clear: () => Promise<WorkspaceSnapshot>;
        get: () => Promise<WorkspaceSnapshot>;
        getGitBranch: (path: string) => Promise<string | undefined>;
        pickDirectory: () => Promise<string | undefined>;
        openDirectory: (path: string) => Promise<void>;
        create: (name: string, path: string) => Promise<WorkspaceSnapshot>;
        update: (path: string, name: string, nextPath: string) => Promise<WorkspaceSnapshot>;
        select: (path: string) => Promise<WorkspaceSnapshot>;
        setPinned: (workspacePath: string, pinned: boolean, beforeWorkspacePath?: string) => Promise<WorkspaceSnapshot>;
      };
    };
  }
}

export {};
