import type { AttachmentStore } from './attachments';
import { Buffer } from 'node:buffer';

export function createComposerHandlers(
  attachments: AttachmentStore,
  sendToPi: (prompt: string, attachmentIds: string[]) => Promise<void>,
) {
  return {
    addAttachments: async (paths: string[]) => attachments.add(paths),
    addPastedImage: (name: string, data: string) => attachments.addImage(name, Buffer.from(data, 'base64')),
    removeAttachment: (id: string) => attachments.remove(id),
    send: async (prompt: string, attachmentIds: string[]) => sendToPi(prompt, attachmentIds),
  };
}
