import type { ElectronAPI } from '@electron-toolkit/preload';
import type { AttachmentFailure, AttachmentMetadata } from '../main/attachments';
import type { DeepSeekModel, DeepSeekSettingsSnapshot } from '../main/deepseek-settings';
import type { TranscriptUpdate } from '../main/pi-runtime';
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
      workspaces: {
        get: () => Promise<WorkspaceSnapshot>;
        getGitBranch: (path: string) => Promise<string | undefined>;
        pickDirectory: () => Promise<string | undefined>;
        create: (name: string, path: string) => Promise<WorkspaceSnapshot>;
        select: (path: string) => Promise<WorkspaceSnapshot>;
      };
    };
  }
}

export {};
