import { Buffer } from 'node:buffer';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttachmentStore } from './attachments';
import { PiRuntime } from './pi-runtime';

const directories: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Jb7sAAAAASUVORK5CYII=', 'base64');

async function fixture(name: string, contents: string | Buffer): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'pi-desktop-runtime-'));
  directories.push(directory);
  const path = join(directory, name);
  await writeFile(path, contents);
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { force: true, recursive: true })));
});

describe('pi runtime', () => {
  it('rejects sends until DeepSeek has been configured', async () => {
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({ prompt: vi.fn(), subscribe: () => () => {} }));

    await expect(runtime.send('Hello', [])).rejects.toThrow('请先在设置中配置 DeepSeek API Key');
  });

  it('passes Pi image content and text-file content to a session prompt', async () => {
    const attachments = new AttachmentStore();
    const result = await attachments.add([
      await fixture('diagram.png', png),
      await fixture('notes.md', '# Notes'),
    ]);
    const prompt = vi.fn();
    const runtime = new PiRuntime(attachments, async () => ({ prompt, subscribe: () => () => {} }));
    runtime.configureDeepSeek({ apiKey: 'sk-test', model: 'deepseek-v4-flash' });

    await runtime.send('Explain these files', result.attachments.map(attachment => attachment.id));

    expect(prompt).toHaveBeenCalledWith(
      'Explain these files\n<file name="notes.md">\n# Notes\n</file>\n',
      { images: [expect.objectContaining({ data: png.toString('base64'), mimeType: 'image/png', type: 'image' })] },
    );
  });

  it('forwards assistant text updates without exposing Pi event objects', async () => {
    let listener: ((event: unknown) => void) | undefined;
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({
      prompt: vi.fn(),
      subscribe: (callback: (event: unknown) => void) => {
        listener = callback;
        return () => {};
      },
    }));
    const update = vi.fn();
    runtime.subscribe(update);
    runtime.configureDeepSeek({ apiKey: 'sk-test', model: 'deepseek-v4-flash' });

    await runtime.send('Hello', []);
    listener?.({
      type: 'message_update',
      message: { content: [{ text: 'Hi there', type: 'text' }], role: 'assistant' },
    });

    expect(update).toHaveBeenCalledWith({ done: false, text: 'Hi there', type: 'assistant' });
  });
});
