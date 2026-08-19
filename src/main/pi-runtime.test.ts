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

  it('uses the app-owned agent directory for new sessions', async () => {
    const createSession = vi.fn(async () => ({ prompt: vi.fn(), subscribe: () => () => {} }));
    const runtime = new PiRuntime(new AttachmentStore(), { agentDir: '/tmp/pi-desktop-agent', createSession });
    runtime.configureDeepSeek({ apiKey: 'sk-test', model: 'deepseek-v4-flash' });
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);

    expect(createSession).toHaveBeenCalledWith({ apiKey: 'sk-test', model: 'deepseek-v4-flash' }, '/tmp/pi-desktop-agent', '/tmp/project');
  });

  it('rejects sends until a workspace has been selected', async () => {
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({ prompt: vi.fn(), subscribe: () => () => {} }));
    runtime.configureDeepSeek({ apiKey: 'sk-test', model: 'deepseek-v4-flash' });

    await expect(runtime.send('Hello', [])).rejects.toThrow('请先选择工作区');
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
    runtime.setWorkspace('/tmp/project');

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
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);
    listener?.({
      type: 'message_update',
      message: { content: [{ text: 'Hi there', type: 'text' }], role: 'assistant' },
    });

    expect(update).toHaveBeenCalledWith({ done: false, text: 'Hi there', type: 'assistant' });
  });

  it('assembles delta-only assistant updates from current Pi sessions', async () => {
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
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);
    listener?.({ assistantMessageEvent: { contentIndex: 0, delta: 'Hi', type: 'text_delta' }, type: 'message_update' });
    listener?.({ assistantMessageEvent: { contentIndex: 0, delta: ' there', type: 'text_delta' }, type: 'message_update' });

    expect(update).toHaveBeenLastCalledWith({ done: false, text: 'Hi there', type: 'assistant' });
  });

  it('keeps streamed text when the terminal assistant snapshot is empty', async () => {
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
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);
    listener?.({ assistantMessageEvent: { contentIndex: 0, delta: 'Hi there', type: 'text_delta' }, type: 'message_update' });
    listener?.({ message: { content: [], role: 'assistant' }, type: 'message_end' });

    expect(update).toHaveBeenLastCalledWith({ done: true, text: 'Hi there', type: 'assistant' });
  });

  it('does not carry delta text into the next assistant message', async () => {
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
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);
    listener?.({ assistantMessageEvent: { contentIndex: 0, delta: 'First', type: 'text_delta' }, type: 'message_update' });
    listener?.({ message: { content: [], role: 'assistant' }, type: 'message_start' });
    listener?.({ assistantMessageEvent: { contentIndex: 0, delta: 'Second', type: 'text_delta' }, type: 'message_update' });

    expect(update).toHaveBeenLastCalledWith({ done: false, text: 'Second', type: 'assistant' });
  });

  it('queues a second message while Pi is still answering', async () => {
    const prompt = vi.fn(() => new Promise<void>(() => {}));
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({
      prompt,
      subscribe: () => () => {},
    }));
    runtime.configureDeepSeek({ apiKey: 'sk-test', model: 'deepseek-v4-flash' });
    runtime.setWorkspace('/tmp/project');

    let firstAccepted = false;
    void runtime.send('First', []).then(() => {
      firstAccepted = true;
    });
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(firstAccepted).toBe(true);
    void runtime.send('Second', []);
    await Promise.resolve();
    await Promise.resolve();

    expect(prompt).toHaveBeenNthCalledWith(2, 'Second', { streamingBehavior: 'steer' });
  });

  it('keeps the composer running until Pi settles and can abort the active turn', async () => {
    let listener: ((event: unknown) => void) | undefined;
    const abort = vi.fn();
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({
      abort,
      prompt: vi.fn(),
      subscribe: (callback: (event: unknown) => void) => {
        listener = callback;
        return () => {};
      },
    }));
    const update = vi.fn();
    runtime.subscribe(update);
    runtime.configureDeepSeek({ apiKey: 'sk-test', model: 'deepseek-v4-flash' });
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);
    await runtime.abort();
    listener?.({ type: 'agent_settled' });

    expect(update.mock.calls.map(([event]) => event)).toEqual([
      { status: 'running', type: 'status' },
      { status: 'settled', type: 'status' },
    ]);
    expect(abort).toHaveBeenCalledOnce();
  });
});
