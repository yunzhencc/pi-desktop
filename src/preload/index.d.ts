import type { ElectronAPI } from '@electron-toolkit/preload';
import type { AttachmentFailure, AttachmentMetadata } from '../main/attachments';
import type { DeepSeekModel, DeepSeekSettingsSnapshot } from '../main/deepseek-settings';
import type { PiSessionSnapshot, PiSessionSummary, TranscriptUpdate } from '../main/pi-runtime';
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
        getDeepSeek: () => Promise<DeepSeekSettingsSnapshot>;
        saveDeepSeek: (apiKey: string, model: DeepSeekModel) => Promise<DeepSeekSettingsSnapshot>;
      };
      sessions: {
        list: (workspacePath: string) => Promise<PiSessionSummary[]>;
        open: (workspacePath: string, sessionPath: string) => Promise<{ session: PiSessionSnapshot; workspace: WorkspaceSnapshot }>;
        setPinned: (workspacePath: string, sessionPath: string, pinned: boolean, beforeSessionPath?: string) => Promise<WorkspaceSnapshot>;
      };
      workspaces: {
        clear: () => Promise<WorkspaceSnapshot>;
        get: () => Promise<WorkspaceSnapshot>;
        getGitBranch: (path: string) => Promise<string | undefined>;
        pickDirectory: () => Promise<string | undefined>;
        create: (name: string, path: string) => Promise<WorkspaceSnapshot>;
        select: (path: string) => Promise<WorkspaceSnapshot>;
        setPinned: (workspacePath: string, pinned: boolean, beforeWorkspacePath?: string) => Promise<WorkspaceSnapshot>;
      };
    };
  }
}

export {};
