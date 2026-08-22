import type { ImageContent } from '@earendil-works/pi-ai';
import type { AttachmentFailure, AttachmentKind, AttachmentMetadata } from '@shared/types';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { open, readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';

interface StoredAttachment extends AttachmentMetadata {
  path?: string;
  source?: Buffer;
}

export interface PromptAttachments {
  images: ImageContent[];
  text: string;
}

const textExtensions = new Set([
  '.bash',
  '.c',
  '.cc',
  '.cpp',
  '.css',
  '.csv',
  '.env',
  '.gitignore',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.ini',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.log',
  '.md',
  '.mjs',
  '.py',
  '.rs',
  '.sh',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
  '.zsh',
]);

export class AttachmentStore {
  #attachments = new Map<string, StoredAttachment>();

  async add(paths: string[]): Promise<{ attachments: AttachmentMetadata[]; failures: AttachmentFailure[] }> {
    const attachments: AttachmentMetadata[] = [];
    const failures: AttachmentFailure[] = [];

    for (const path of paths) {
      const name = basename(path);
      try {
        const fileStat = await stat(path);
        if (!fileStat.isFile()) {
          failures.push({ name, reason: '只能添加文件。' });
          continue;
        }
        const source = await readImageSource(path);
        const imageMimeType = source && detectImageMimeType(source);
        const kind: AttachmentKind = imageMimeType
          ? 'image'
          : extname(name).toLowerCase() === '.pdf'
            ? 'pdf'
            : textExtensions.has(extname(name).toLowerCase())
              ? 'text'
              : 'file';

        const attachment: StoredAttachment = {
          id: randomUUID(),
          kind,
          name,
          path,
          size: fileStat.size,
          ...(imageMimeType ? { previewDataUrl: `data:${imageMimeType};base64,${source.toString('base64')}` } : {}),
        };
        this.#attachments.set(attachment.id, attachment);
        attachments.push(toMetadata(attachment));
      }
      catch {
        failures.push({ name, reason: '无法读取此文件。' });
      }
    }

    return { attachments, failures };
  }

  addImage(name: string, source: Buffer): { attachments: AttachmentMetadata[]; failures: AttachmentFailure[] } {
    const imageMimeType = detectImageMimeType(source);
    if (!imageMimeType)
      return { attachments: [], failures: [{ name, reason: '不支持此图片类型。' }] };

    const attachment: StoredAttachment = {
      id: randomUUID(),
      kind: 'image',
      name,
      size: source.length,
      source,
      previewDataUrl: `data:${imageMimeType};base64,${source.toString('base64')}`,
    };
    this.#attachments.set(attachment.id, attachment);
    return { attachments: [toMetadata(attachment)], failures: [] };
  }

  remove(id: string): void {
    this.#attachments.delete(id);
  }

  resolve(ids: string[]): StoredAttachment[] {
    return ids.flatMap((id) => {
      const attachment = this.#attachments.get(id);
      return attachment ? [attachment] : [];
    });
  }

  reveal(id: string): string | undefined {
    return this.#attachments.get(id)?.path;
  }

  async toPrompt(ids: string[]): Promise<PromptAttachments> {
    const images: ImageContent[] = [];
    let text = '';

    for (const attachment of this.resolve(ids)) {
      if (attachment.kind === 'image') {
        const source = attachment.source ?? (attachment.path ? await readFile(attachment.path) : undefined);
        if (!source)
          continue;
        const mimeType = detectImageMimeType(source);
        if (!mimeType)
          throw new TypeError(`附件 ${attachment.name} 已不再是受支持的图片。`);
        images.push({ type: 'image', data: source.toString('base64'), mimeType });
        continue;
      }
      if (attachment.path) {
        text += `${fileReference(attachment.path)}\n`;
      }
    }

    return { images, text };
  }
}

function toMetadata({ path: _path, source: _source, ...attachment }: StoredAttachment): AttachmentMetadata {
  return attachment;
}

function fileReference(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  return /\s/.test(normalized)
    ? `@"${normalized.replaceAll(/(["\\])/g, '\\$1')}"`
    : `@${normalized}`;
}

async function readImageSource(path: string): Promise<Buffer | undefined> {
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    return detectImageMimeType(header.subarray(0, bytesRead)) ? readFile(path) : undefined;
  }
  finally {
    await file.close();
  }
}

function detectImageMimeType(source: Buffer): string | undefined {
  if (source.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])))
    return 'image/png';
  if (source.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF])))
    return 'image/jpeg';
  if (source.subarray(0, 3).toString('ascii') === 'GIF')
    return 'image/gif';
  if (source.subarray(0, 4).toString('ascii') === 'RIFF' && source.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  return undefined;
}
