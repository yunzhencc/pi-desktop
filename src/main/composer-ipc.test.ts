import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttachmentStore } from './attachments';
import { createComposerHandlers } from './composer-ipc';

const directories: string[] = [];

async function fixture(name: string, contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'pi-desktop-ipc-'));
  directories.push(directory);
  const path = join(directory, name);
  await writeFile(path, contents);
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { force: true, recursive: true })));
});

describe('composer IPC handlers', () => {
  it('returns attachment metadata but never paths from file selection', async () => {
    const handlers = createComposerHandlers(new AttachmentStore(), vi.fn(), async () => [await fixture('notes.md', '# Notes')]);

    const result = await handlers.chooseAttachments();

    expect(result).toEqual({
      attachments: [expect.objectContaining({ kind: 'text', name: 'notes.md' })],
      failures: [],
    });
    expect(result.attachments[0]).not.toHaveProperty('path');
  });

  it('forwards only prompt text and opaque attachment IDs to the runtime', async () => {
    const attachments = new AttachmentStore();
    const selected = await attachments.add([await fixture('notes.txt', 'Hello')]);
    const send = vi.fn();
    const handlers = createComposerHandlers(attachments, send, async () => []);

    await handlers.send('Summarize this', [selected.attachments[0]!.id]);
    handlers.removeAttachment(selected.attachments[0]!.id);

    expect(send).toHaveBeenCalledWith('Summarize this', [selected.attachments[0]!.id]);
    expect(attachments.resolve([selected.attachments[0]!.id])).toEqual([]);
  });

  it('uses the same validation path for dropped file paths', async () => {
    const handlers = createComposerHandlers(new AttachmentStore(), vi.fn(), async () => []);

    const result = await handlers.addAttachments([await fixture('notes.txt', 'Hello')]);

    expect(result).toEqual({
      attachments: [expect.objectContaining({ kind: 'text', name: 'notes.txt' })],
      failures: [],
    });
  });
});
