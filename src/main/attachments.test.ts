import { Buffer } from 'node:buffer';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AttachmentStore } from './attachments';

const directories: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Jb7sAAAAASUVORK5CYII=', 'base64');

async function fixture(name: string, contents: string | Buffer): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'pi-desktop-attachments-'));
  directories.push(directory);
  const path = join(directory, name);
  await writeFile(path, contents);
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { force: true, recursive: true })));
});

describe('attachmentStore', () => {
  it('accepts supported images without exposing their path', async () => {
    const store = new AttachmentStore();
    const result = await store.add([await fixture('diagram.png', png)]);

    expect(result.failures).toEqual([]);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({ kind: 'image', name: 'diagram.png', size: png.length });
    expect(result.attachments[0]?.previewDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.attachments[0]).not.toHaveProperty('path');
  });

  it('accepts UTF-8 code files without exposing their contents', async () => {
    const store = new AttachmentStore();
    const result = await store.add([await fixture('example.ts', 'export const answer = 42;')]);

    expect(result.failures).toEqual([]);
    expect(result.attachments).toEqual([expect.objectContaining({ kind: 'text', name: 'example.ts', size: 25 })]);
    expect(result.attachments[0]).not.toHaveProperty('path');
    expect(result.attachments[0]).not.toHaveProperty('content');
  });

  it('rejects unsupported and invalid UTF-8 files', async () => {
    const store = new AttachmentStore();
    const result = await store.add([
      await fixture('recording.mp3', Buffer.from([0x49, 0x44, 0x33])),
      await fixture('broken.ts', Buffer.from([0xFF, 0xFE])),
    ]);

    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([
      expect.objectContaining({ name: 'recording.mp3', reason: expect.stringContaining('不支持') }),
      expect.objectContaining({ name: 'broken.ts', reason: expect.stringContaining('UTF-8') }),
    ]);
  });

  it('does not resolve an attachment after removal', async () => {
    const store = new AttachmentStore();
    const result = await store.add([await fixture('notes.txt', 'Hello')]);
    const attachment = result.attachments[0];

    store.remove(attachment.id);

    expect(store.resolve([attachment.id])).toEqual([]);
  });
});
