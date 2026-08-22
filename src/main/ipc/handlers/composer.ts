import type { AttachmentStore } from '../../attachments';
import type { PiRuntime } from '../../pi-runtime';
import { IPC_CHANNELS } from '@shared/ipc-channels';
import { BrowserWindow } from 'electron';
import { createComposerHandlers } from '../../composer-ipc';
import { registerHandler } from '../registry';

interface ComposerHandlerDependencies {
  attachmentStore: AttachmentStore;
  piRuntime: PiRuntime;
}

export function registerComposerHandlers({ attachmentStore, piRuntime }: ComposerHandlerDependencies): void {
  const composer = createComposerHandlers(
    attachmentStore,
    (prompt, attachmentIds) => piRuntime.send(prompt, attachmentIds),
    () => piRuntime.startNewConversation(),
  );

  registerHandler(IPC_CHANNELS.ComposerAddAttachments, (_event, paths: unknown) => {
    if (!Array.isArray(paths) || !paths.every(path => typeof path === 'string'))
      throw new TypeError('Invalid attachment paths');
    return composer.addAttachments(paths);
  });
  registerHandler(IPC_CHANNELS.ComposerAddPastedImage, (_event, name: unknown, data: unknown) => {
    if (typeof name !== 'string' || typeof data !== 'string')
      throw new TypeError('Invalid pasted image');
    return composer.addPastedImage(name, data);
  });
  registerHandler(IPC_CHANNELS.ComposerRemoveAttachment, (_event, id: unknown) => {
    if (typeof id !== 'string')
      throw new TypeError('Invalid attachment ID');
    composer.removeAttachment(id);
  });
  registerHandler(IPC_CHANNELS.ComposerSend, (_event, prompt: unknown, attachmentIds: unknown) => {
    if (typeof prompt !== 'string' || !Array.isArray(attachmentIds) || !attachmentIds.every(id => typeof id === 'string'))
      throw new TypeError('Invalid composer input');
    return composer.send(prompt, attachmentIds);
  });
  registerHandler(IPC_CHANNELS.ComposerEditLastUserMessage, (_event, message: unknown) => {
    if (message !== undefined && typeof message !== 'string')
      throw new TypeError('Invalid edited message');
    return piRuntime.editLastUserMessage(message);
  });
  registerHandler(IPC_CHANNELS.ComposerForkAssistantMessage, (_event, entryId: unknown) => {
    if (typeof entryId !== 'string' || !entryId)
      throw new TypeError('无效的回复');
    return piRuntime.forkAssistantMessage(entryId);
  });
  registerHandler(IPC_CHANNELS.ComposerNewConversation, () => composer.startNewConversation());
  registerHandler(IPC_CHANNELS.ComposerStop, () => piRuntime.abort());
  piRuntime.subscribe((update) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send(IPC_CHANNELS.ComposerUpdate, update);
  });
}
