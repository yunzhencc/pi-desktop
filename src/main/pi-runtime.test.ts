import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  it('uses the Pi agent directory for new sessions', async () => {
    const createSession = vi.fn(async () => ({ prompt: vi.fn(), subscribe: () => () => {} }));
    const runtime = new PiRuntime(new AttachmentStore(), { agentDir: '/tmp/pi-desktop-agent', createSession });
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);

    expect(createSession).toHaveBeenCalledWith('/tmp/pi-desktop-agent', '/tmp/project', undefined);
  });

  it('lists persisted sessions for a workspace', async () => {
    const listSessions = vi.fn(async () => [{ firstMessage: 'Hello', id: 'session-1', modifiedAt: '2026-08-19T00:00:00.000Z', path: '/sessions/session-1.jsonl' }]);
    const runtime = new PiRuntime(new AttachmentStore(), { agentDir: '/tmp/pi-desktop-agent', listSessions });

    await expect(runtime.listWorkspaceSessions('/tmp/project')).resolves.toEqual([{ firstMessage: 'Hello', id: 'session-1', modifiedAt: '2026-08-19T00:00:00.000Z', path: '/sessions/session-1.jsonl' }]);
    expect(listSessions).toHaveBeenCalledWith('/tmp/project', '/tmp/pi-desktop-agent');
  });

  it('lists sessions persisted in the app agent directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pi-desktop-sessions-'));
    directories.push(root);
    const workspace = join(root, 'workspace');
    const agentDir = join(root, 'agent');
    await mkdir(workspace);
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const sessionDir = join(agentDir, 'sessions', `--${workspace.slice(1).replace(/[/:]/g, '-')}--`);
    const session = SessionManager.create(workspace, sessionDir);
    await writeFile(session.getSessionFile()!, `${JSON.stringify(session.getHeader())}\n${JSON.stringify({ id: 'message-1', message: { content: 'Hello', role: 'user', timestamp: Date.now() }, parentId: null, timestamp: new Date().toISOString(), type: 'message' })}\n`);
    const runtime = new PiRuntime(new AttachmentStore(), { agentDir, createSession: async () => ({ prompt: vi.fn(), subscribe: () => () => {} }) });

    await expect(runtime.listWorkspaceSessions(workspace)).resolves.toEqual([
      expect.objectContaining({ id: session.getSessionId(), path: session.getSessionFile() }),
    ]);
  });

  it('loads persisted user and assistant messages when opening a session', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pi-desktop-session-history-'));
    directories.push(root);
    const workspace = join(root, 'workspace');
    const agentDir = join(root, 'agent');
    await mkdir(workspace);
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const sessionDir = join(agentDir, 'sessions', `--${workspace.slice(1).replace(/[/:]/g, '-')}--`);
    const session = SessionManager.create(workspace, sessionDir);
    await writeFile(session.getSessionFile()!, `${JSON.stringify(session.getHeader())}\n${JSON.stringify({ id: 'message-1', message: { content: 'Earlier request', role: 'user', timestamp: 1000 }, parentId: null, timestamp: new Date().toISOString(), type: 'message' })}\n${JSON.stringify({ id: 'message-2', message: { content: [{ text: 'Earlier reply', type: 'text' }], role: 'assistant', timestamp: 2000 }, parentId: 'message-1', timestamp: new Date().toISOString(), type: 'message' })}\n`);
    const runtime = new PiRuntime(new AttachmentStore(), { agentDir });

    await expect(runtime.openSession(session.getSessionFile()!)).resolves.toEqual({
      messages: [
        { entryId: 'message-1', role: 'user', text: 'Earlier request', timestamp: 1000 },
        { completedAtMs: 2000, role: 'work', startedAtMs: 1000, status: 'worked' },
        { entryId: 'message-2', role: 'assistant', text: 'Earlier reply', timestamp: 2000 },
      ],
      path: session.getSessionFile(),
    });
  });

  it('restores tool commands and results from a persisted session', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pi-desktop-session-tools-'));
    directories.push(root);
    const workspace = join(root, 'workspace');
    const agentDir = join(root, 'agent');
    await mkdir(workspace);
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const sessionDir = join(agentDir, 'sessions', `--${workspace.slice(1).replace(/[/:]/g, '-')}--`);
    const session = SessionManager.create(workspace, sessionDir);
    await writeFile(session.getSessionFile()!, `${JSON.stringify(session.getHeader())}\n${JSON.stringify({ id: 'message-1', message: { content: 'Inspect this', role: 'user', timestamp: 1000 }, parentId: null, timestamp: new Date().toISOString(), type: 'message' })}\n${JSON.stringify({ id: 'message-2', message: { content: [{ arguments: { command: 'git status --short' }, id: 'tool-1', name: 'bash', type: 'toolCall' }], role: 'assistant', timestamp: 2000 }, parentId: 'message-1', timestamp: new Date().toISOString(), type: 'message' })}\n${JSON.stringify({ id: 'message-3', message: { content: [{ text: ' M src/main.ts', type: 'text' }], isError: false, role: 'toolResult', timestamp: 3000, toolCallId: 'tool-1', toolName: 'bash' }, parentId: 'message-2', timestamp: new Date().toISOString(), type: 'message' })}\n`);
    const runtime = new PiRuntime(new AttachmentStore(), { agentDir });

    await expect(runtime.openSession(session.getSessionFile()!)).resolves.toMatchObject({
      messages: [
        { role: 'user', text: 'Inspect this', timestamp: 1000 },
        { args: { command: 'git status --short' }, output: ' M src/main.ts', role: 'tool', status: 'completed', toolCallId: 'tool-1', toolName: 'bash' },
      ],
    });
  });

  it('forks a new persisted session at the selected assistant reply', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pi-desktop-session-fork-'));
    directories.push(root);
    const workspace = join(root, 'workspace');
    const agentDir = join(root, 'agent');
    await mkdir(workspace);
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const sessionDir = join(agentDir, 'sessions', `--${workspace.slice(1).replace(/[/:]/g, '-')}--`);
    const session = SessionManager.create(workspace, sessionDir);
    await writeFile(session.getSessionFile()!, `${JSON.stringify(session.getHeader())}\n${JSON.stringify({ id: 'message-1', message: { content: 'Earlier request', role: 'user', timestamp: 1_000 }, parentId: null, timestamp: new Date().toISOString(), type: 'message' })}\n${JSON.stringify({ id: 'message-2', message: { content: [{ text: 'Earlier reply', type: 'text' }], role: 'assistant', timestamp: 2_000 }, parentId: 'message-1', timestamp: new Date().toISOString(), type: 'message' })}\n${JSON.stringify({ id: 'message-3', message: { content: 'Later request', role: 'user', timestamp: 3_000 }, parentId: 'message-2', timestamp: new Date().toISOString(), type: 'message' })}\n`);
    const runtime = new PiRuntime(new AttachmentStore(), { agentDir });
    await runtime.openSession(session.getSessionFile()!);

    const fork = await runtime.forkAssistantMessage('message-2');

    expect(fork.path).not.toBe(session.getSessionFile());
    expect(fork.messages).toMatchObject([
      { role: 'user', text: 'Earlier request', timestamp: 1_000 },
      { completedAtMs: 2_000, role: 'work', startedAtMs: 1_000, status: 'worked' },
      { role: 'assistant', text: 'Earlier reply', timestamp: 2_000 },
    ]);
    expect(fork.messages).not.toContainEqual(expect.objectContaining({ text: 'Later request' }));
  });

  it('disposes the active Pi context before a new conversation', async () => {
    const dispose = vi.fn();
    const createSession = vi.fn(async () => ({ dispose, prompt: vi.fn(), subscribe: () => () => {} }));
    const runtime = new PiRuntime(new AttachmentStore(), createSession);
    runtime.setWorkspace('/tmp/project');
    await runtime.send('First', []);

    runtime.startNewConversation();
    await runtime.send('Second', []);

    expect(dispose).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('returns the last user prompt after moving the session to its parent branch', async () => {
    const editLastUserMessage = vi.fn(() => Promise.resolve({ cancelled: false, editorText: 'Revise the plan' }));
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({ editLastUserMessage, prompt: vi.fn(), subscribe: () => () => {} }));
    runtime.setWorkspace('/tmp/project');

    await expect(runtime.editLastUserMessage()).resolves.toBe('Revise the plan');
    expect(editLastUserMessage).toHaveBeenCalledOnce();
  });

  it('resends an edited last user message in the same operation', async () => {
    const editLastUserMessage = vi.fn(() => Promise.resolve({ cancelled: false, editorText: 'Original prompt' }));
    const prompt = vi.fn();
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({ editLastUserMessage, prompt, subscribe: () => () => {} }));
    runtime.setWorkspace('/tmp/project');

    await runtime.editLastUserMessage('Revised prompt');

    expect(editLastUserMessage).toHaveBeenCalledOnce();
    expect(prompt).toHaveBeenCalledWith('Revised prompt', undefined);
  });

  it('rejects sends until a workspace has been selected', async () => {
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({ prompt: vi.fn(), subscribe: () => () => {} }));

    await expect(runtime.send('Hello', [])).rejects.toThrow('请先选择工作区');
  });

  it('rejects sends after the selected workspace is cleared', async () => {
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({ prompt: vi.fn(), subscribe: () => () => {} }));
    runtime.setWorkspace('/tmp/project');
    runtime.clearWorkspace();

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
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);
    listener?.({ assistantMessageEvent: { contentIndex: 0, delta: 'Hi there', type: 'text_delta' }, type: 'message_update' });
    listener?.({ message: { content: [], role: 'assistant' }, type: 'message_end' });

    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ done: true, text: 'Hi there', timestamp: expect.any(Number), type: 'assistant' }));
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
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Hello', []);
    await runtime.abort();
    listener?.({ type: 'agent_settled' });

    expect(update.mock.calls.map(([event]) => event)).toEqual([
      { startedAtMs: expect.any(Number), status: 'running', type: 'status' },
      { completedAtMs: expect.any(Number), startedAtMs: expect.any(Number), status: 'settled', type: 'status', workStatus: 'stopped' },
    ]);
    expect(abort).toHaveBeenCalledOnce();
  });

  it('identifies the active session and forwards tool progress', async () => {
    let listener: ((event: unknown) => void) | undefined;
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({
      getSessionPath: () => '/sessions/active.jsonl',
      prompt: vi.fn(),
      subscribe: (callback: (event: unknown) => void) => {
        listener = callback;
        return () => {};
      },
    }));
    const update = vi.fn();
    runtime.subscribe(update);
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Inspect the project', []);
    listener?.({ args: { path: 'README.md' }, toolCallId: 'tool-1', toolName: 'read', type: 'tool_execution_start' });
    listener?.({ isError: false, result: { content: 'Hello' }, toolCallId: 'tool-1', toolName: 'read', type: 'tool_execution_end' });

    expect(update.mock.calls.map(([event]) => event)).toEqual([
      { sessionPath: '/sessions/active.jsonl', startedAtMs: expect.any(Number), status: 'running', type: 'status' },
      { args: { path: 'README.md' }, sessionPath: '/sessions/active.jsonl', status: 'running', toolCallId: 'tool-1', toolName: 'read', type: 'tool' },
      { output: { content: 'Hello' }, sessionPath: '/sessions/active.jsonl', status: 'completed', toolCallId: 'tool-1', toolName: 'read', type: 'tool' },
    ]);
  });

  it('announces a session after its first user message is persisted', async () => {
    let listener: ((event: unknown) => void) | undefined;
    const runtime = new PiRuntime(new AttachmentStore(), async () => ({
      getSessionPath: () => '/sessions/new.jsonl',
      prompt: vi.fn(),
      subscribe: (callback: (event: unknown) => void) => {
        listener = callback;
        return () => {};
      },
    }));
    const update = vi.fn();
    runtime.subscribe(update);
    runtime.setWorkspace('/tmp/project');

    await runtime.send('Start a new task', []);
    listener?.({ message: { content: [{ text: 'Start a new task', type: 'text' }], role: 'user' }, type: 'message_end' });
    await new Promise<void>(resolve => queueMicrotask(resolve));

    expect(update).toHaveBeenLastCalledWith({ sessionPath: '/sessions/new.jsonl', type: 'session' });
  });
});
