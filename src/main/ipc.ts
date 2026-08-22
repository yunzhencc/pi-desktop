import type { AttachmentStore } from './attachments';
import type { PiRuntime } from './pi-runtime';
import type { ProviderSettings } from './provider-settings';
import type { WorkspaceRegistry } from './workspaces';
import { registerComposerHandlers } from './ipc/handlers/composer';
import { registerProviderHandlers } from './ipc/handlers/providers';
import { registerSessionHandlers } from './ipc/handlers/sessions';
import { registerWindowControlHandlers } from './ipc/handlers/window-controls';
import { registerWorkspaceHandlers } from './ipc/handlers/workspaces';

interface IpcHandlerDependencies {
  attachmentStore: AttachmentStore;
  piRuntime: PiRuntime;
  providerSettings: ProviderSettings;
  workspaceRegistry: WorkspaceRegistry;
  getIsPrimaryWindowOpaque: () => boolean;
  syncPrimaryWindowBackdrop: () => void;
}

export function registerAllHandlers(deps: IpcHandlerDependencies): void {
  registerWindowControlHandlers(deps);
  registerProviderHandlers(deps);
  registerWorkspaceHandlers(deps);
  registerSessionHandlers(deps);
  registerComposerHandlers(deps);
}
