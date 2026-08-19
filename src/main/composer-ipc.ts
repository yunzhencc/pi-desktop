import type { AttachmentStore } from './attachments';

export function createComposerHandlers(
  attachments: AttachmentStore,
  sendToPi: (prompt: string, attachmentIds: string[]) => Promise<void>,
  choosePaths: () => Promise<string[]>,
) {
  return {
    addAttachments: async (paths: string[]) => attachments.add(paths),
    chooseAttachments: async () => attachments.add(await choosePaths()),
    removeAttachment: (id: string) => attachments.remove(id),
    send: async (prompt: string, attachmentIds: string[]) => sendToPi(prompt, attachmentIds),
  };
}
