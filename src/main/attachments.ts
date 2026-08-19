import type { ImageContent } from '@earendil-works/pi-ai';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';

export type AttachmentKind = 'image' | 'text';

export interface AttachmentMetadata {
  id: string;
  kind: AttachmentKind;
  name: string;
  size: number;
  previewDataUrl?: string;
}

export interface AttachmentFailure {
  name: string;
  reason: string;
}

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
        const source = await readFile(path);
        const fileStat = await stat(path);
        const imageMimeType = detectImageMimeType(source);
        const kind: AttachmentKind | undefined = imageMimeType ? 'image' : textExtensions.has(extname(name).toLowerCase()) ? 'text' : undefined;

        if (!kind) {
          failures.push({ name, reason: '不支持此文件类型，仅支持图片和 UTF-8 文本/代码文件。' });
          continue;
        }

        if (kind === 'text')
          decodeUtf8(source);

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
      catch (error) {
        failures.push({ name, reason: error instanceof TypeError ? '文件不是有效的 UTF-8 文本。' : '无法读取此文件。' });
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

  async toPrompt(ids: string[]): Promise<PromptAttachments> {
    const images: ImageContent[] = [];
    let text = '';

    for (const attachment of this.resolve(ids)) {
      const source = attachment.source ?? await readFile(attachment.path!);
      if (attachment.kind === 'image') {
        const mimeType = detectImageMimeType(source);
        if (!mimeType)
          throw new TypeError(`附件 ${attachment.name} 已不再是受支持的图片。`);
        images.push({ type: 'image', data: source.toString('base64'), mimeType });
      }
      else {
        text += `<file name="${attachment.name.replaceAll('"', '&quot;')}">\n${decodeUtf8(source)}\n</file>\n`;
      }
    }

    return { images, text };
  }
}

function toMetadata({ path: _path, source: _source, ...attachment }: StoredAttachment): AttachmentMetadata {
  return attachment;
}

function decodeUtf8(source: Buffer): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(source);
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
