import type { ElectronAPI } from '@electron-toolkit/preload';
import type { AttachmentFailure, AttachmentMetadata } from '../main/attachments';
import type { TranscriptUpdate } from '../main/pi-runtime';

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
        removeAttachment: (id: string) => Promise<void>;
        send: (prompt: string, attachmentIds: string[]) => Promise<void>;
        onUpdate: (callback: (update: TranscriptUpdate) => void) => () => void;
      };
    };
  }
}

export {};
