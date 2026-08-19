import type { AttachmentStore } from './attachments';

export function createComposerHandlers(
  attachments: AttachmentStore,
  sendToPi: (prompt: string, attachmentIds: string[]) => Promise<void>,
) {
  return {
    addAttachments: async (paths: string[]) => attachments.add(paths),
    removeAttachment: (id: string) => attachments.remove(id),
    send: async (prompt: string, attachmentIds: string[]) => sendToPi(prompt, attachmentIds),
  };
}
