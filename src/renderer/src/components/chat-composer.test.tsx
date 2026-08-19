// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../providers/i18n';
import { ChatComposer, NewConversationToolbar } from './chat-composer';

const composer = {
  addDroppedAttachments: vi.fn(),
  addPastedImage: vi.fn(),
  onUpdate: vi.fn(),
  removeAttachment: vi.fn(),
  send: vi.fn(),
};
const weather = { displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' };
const notes = { displayName: 'notes', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/notes' };
const workspaces = {
  create: vi.fn(),
  getGitBranch: vi.fn(),
  get: vi.fn(),
  pickDirectory: vi.fn(),
  select: vi.fn(),
};

beforeEach(() => {
  localStorage.clear();
  const rect = new DOMRect(0, 0, 1, 1);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [rect] });
  Object.defineProperty(window, 'scrollBy', { configurable: true, value: () => {} });
  vi.stubGlobal('api', { composer, workspaces });
  composer.addDroppedAttachments.mockResolvedValue({ attachments: [], failures: [] });
  composer.addPastedImage.mockResolvedValue({ attachments: [], failures: [] });
  composer.removeAttachment.mockResolvedValue(undefined);
  composer.send.mockResolvedValue(undefined);
  workspaces.create.mockResolvedValue({ selectedWorkspacePath: weather.path, workspaces: [weather, notes] });
  workspaces.getGitBranch.mockResolvedValue('main');
  workspaces.pickDirectory.mockResolvedValue('/projects/weather');
  workspaces.select.mockResolvedValue({ selectedWorkspacePath: notes.path, workspaces: [notes, weather] });
});

function renderComposer(onSubmitted = vi.fn(), props: Partial<Parameters<typeof ChatComposer>[0]> = {}) {
  return render(
    <I18nProvider>
      <ChatComposer onSubmitted={onSubmitted} workspace={{ selectedWorkspacePath: weather.path, workspaces: [weather] }} {...props} />
    </I18nProvider>,
  );
}

function renderNewConversationToolbar(props: Partial<Parameters<typeof NewConversationToolbar>[0]> = {}) {
  return render(
    <I18nProvider>
      <NewConversationToolbar onWorkspaceChange={vi.fn()} workspace={{ selectedWorkspacePath: weather.path, workspaces: [weather, notes] }} {...props} />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('chat composer', () => {
  it('sends typed text and clears the editor', async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    renderComposer(onSubmitted);

    await user.type(screen.getByRole('textbox', { name: 'Message Pi' }), 'Hello Pi');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(composer.send).toHaveBeenCalledWith('Hello Pi', []);
    expect(onSubmitted).toHaveBeenCalledWith('Hello Pi');
    expect(screen.getByRole('textbox', { name: 'Message Pi' }).textContent).toBe('');
  });

  it('shows a loading indicator until sending completes', async () => {
    let finishSend: (() => void) | undefined;
    composer.send.mockImplementation(() => new Promise<void>((resolve) => {
      finishSend = resolve;
    }));
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByRole('textbox', { name: 'Message Pi' }), 'Hello Pi');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByRole('button', { name: 'Sending message' }).querySelector('.lucide-loader-circle')).not.toBeNull();

    finishSend?.();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' }).querySelector('.lucide-arrow-up')).not.toBeNull());
  });

  it('uses the send control to stop an active Pi turn', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(
      <I18nProvider>
        <ChatComposer isRunning onStop={onStop} onSubmitted={vi.fn()} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Stop generating' }));

    expect(onStop).toHaveBeenCalledOnce();
  });

  it('records the user message before the send request settles', async () => {
    composer.send.mockImplementation(() => new Promise<void>(() => {}));
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    renderComposer(onSubmitted);

    await user.type(screen.getByRole('textbox', { name: 'Message Pi' }), 'Hello Pi');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSubmitted).toHaveBeenCalledWith('Hello Pi');
  });

  it('sends typed text when Enter is pressed', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByRole('textbox', { name: 'Message Pi' }), 'Hello Pi{Enter}');

    await waitFor(() => expect(composer.send).toHaveBeenCalledWith('Hello Pi', []));
  });

  it('keeps a newline when Shift+Enter is pressed', async () => {
    const user = userEvent.setup();
    renderComposer();

    const editor = screen.getByRole('textbox', { name: 'Message Pi' });
    await user.type(editor, 'Hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(editor, 'Pi');

    expect(composer.send).not.toHaveBeenCalled();
    expect(editor.querySelectorAll('p')).toHaveLength(2);
  });

  it('does not render auxiliary composer controls', () => {
    renderComposer();

    expect(screen.queryByRole('button', { name: 'Add attachment' })).toBeNull();
    expect(screen.queryByText('⌘↵ to send')).toBeNull();
  });

  it('uses Codex’s vertical send arrow', () => {
    renderComposer();

    expect(screen.getByRole('button', { name: 'Send message' }).querySelector('.lucide-arrow-up')).not.toBeNull();
  });

  it('uses the localized Codex default placeholder', () => {
    renderComposer();

    expect(screen.getByRole('form', { name: 'Message Pi' }).style.getPropertyValue('--chat-composer-placeholder')).toBe('"随心输入"');
  });

  it('uses the English placeholder when selected', () => {
    localStorage.setItem('pi-desktop-locale', 'en');
    renderComposer();

    expect(screen.getByRole('form', { name: 'Message Pi' }).style.getPropertyValue('--chat-composer-placeholder')).toBe('"Do anything"');
  });

  it('keeps the project toolbar outside the established composer', () => {
    renderComposer();

    expect(screen.queryByRole('button', { name: 'weather' })).toBeNull();
  });

  it('renders the project picker when no project is selected', () => {
    renderNewConversationToolbar({ workspace: { workspaces: [weather, notes] } });

    expect(screen.getByRole('button', { name: '选择项目' })).not.toBeNull();
  });

  it('switches the new conversation to a selected project', async () => {
    const onWorkspaceChange = vi.fn();
    const user = userEvent.setup();
    renderNewConversationToolbar({ onWorkspaceChange });

    await user.click(screen.getByRole('button', { name: 'weather' }));
    await user.click(await screen.findByRole('menuitem', { name: 'notes' }));

    expect(workspaces.select).toHaveBeenCalledWith(notes.path);
    await waitFor(() => expect(onWorkspaceChange).toHaveBeenCalledWith({ selectedWorkspacePath: notes.path, workspaces: [notes, weather] }));
  });

  it('dismisses the project picker with Escape', async () => {
    const user = userEvent.setup();
    renderNewConversationToolbar();

    await user.click(screen.getByRole('button', { name: 'weather' }));
    expect(await screen.findByRole('menu')).not.toBeNull();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('shows the active local Git context above a new conversation', async () => {
    renderNewConversationToolbar();

    const toolbar = await screen.findByRole('toolbar', { name: '新会话项目上下文' });
    expect(toolbar.textContent).toContain('weather');
    expect(toolbar.textContent).toContain('本地');
    expect(toolbar.textContent).toContain('main');
  });

  it('opens project creation from the new-conversation project picker', async () => {
    const user = userEvent.setup();
    renderNewConversationToolbar();

    await user.click(screen.getByRole('button', { name: 'weather' }));
    await user.click(await screen.findByRole('menuitem', { name: '新建项目' }));

    expect(screen.getByRole('dialog', { name: '创建项目' })).not.toBeNull();
  });

  it('uses the drop attachment command for Electron file paths', async () => {
    renderComposer();
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'path', { value: '/tmp/notes.txt' });

    fireEvent.drop(screen.getByRole('textbox', { name: 'Message Pi' }), { dataTransfer: { files: [file] } });

    await waitFor(() => expect(composer.addDroppedAttachments).toHaveBeenCalledWith(['/tmp/notes.txt']));
  });

  it('adds a clipboard image while the editor is not focused', async () => {
    renderComposer();
    const image = new File([Uint8Array.from([0x89, 0x50, 0x4E, 0x47])], 'clipboard.png', { type: 'image/png' });
    const item = { getAsFile: () => image, kind: 'file', type: 'image/png' } as DataTransferItem;

    fireEvent.paste(window, { clipboardData: { items: [item] } });

    await waitFor(() => expect(composer.addPastedImage).toHaveBeenCalledWith('clipboard.png', 'iVBORw=='));
  });

  it('renders pasted images as Codex thumbnail attachments', async () => {
    composer.addPastedImage.mockResolvedValue({
      attachments: [{ id: 'image-1', kind: 'image', name: '0000.jpg', previewDataUrl: 'data:image/jpeg;base64,/9j/', size: 4 }],
      failures: [],
    });
    renderComposer();
    const image = new File([Uint8Array.from([0x89, 0x50, 0x4E, 0x47])], 'clipboard.png', { type: 'image/png' });
    const item = { getAsFile: () => image, kind: 'file', type: 'image/png' } as DataTransferItem;

    fireEvent.paste(window, { clipboardData: { items: [item] } });

    expect((await screen.findByAltText('0000.jpg')).closest('.chat-composer-image')).not.toBeNull();
    expect(screen.queryByText('0000.jpg')).toBeNull();
  });

  it('asks for a restart when the running preload bridge is outdated', async () => {
    vi.stubGlobal('api', { composer: { ...composer, addPastedImage: undefined } });
    renderComposer();
    const image = new File([Uint8Array.from([0x89, 0x50, 0x4E, 0x47])], 'clipboard.png', { type: 'image/png' });
    const item = { getAsFile: () => image, kind: 'file', type: 'image/png' } as DataTransferItem;

    fireEvent.paste(window, { clipboardData: { items: [item] } });

    expect((await screen.findByRole('status')).textContent).toBe('请重启 Pi Desktop 后再粘贴图片。');
  });
});
