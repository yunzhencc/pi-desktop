// @vitest-environment jsdom

import { I18nProvider } from '@renderer/features/app/i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatComposer, NewConversationToolbar } from '.';

const composer = {
  addDroppedAttachments: vi.fn(),
  addPastedImage: vi.fn(),
  onUpdate: vi.fn(),
  removeAttachment: vi.fn(),
  send: vi.fn(),
};
const providers = {
  get: vi.fn(),
  setDefaultModel: vi.fn(),
};
const weather = { displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' };
const notes = { displayName: 'notes', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/notes' };
const workspaces = {
  clear: vi.fn(),
  create: vi.fn(),
  getGitBranch: vi.fn(),
  get: vi.fn(),
  pickDirectory: vi.fn(),
  select: vi.fn(),
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
  const rect = new DOMRect(0, 0, 1, 1);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [rect] });
  Object.defineProperty(window, 'scrollBy', { configurable: true, value: () => {} });
  vi.stubGlobal('api', { composer, providers, workspaces });
  composer.addDroppedAttachments.mockResolvedValue({ attachments: [], failures: [] });
  composer.addPastedImage.mockResolvedValue({ attachments: [], failures: [] });
  composer.removeAttachment.mockResolvedValue(undefined);
  composer.send.mockResolvedValue(undefined);
  providers.get.mockResolvedValue({
    availableProviders: [],
    connectedProviders: [
      {
        authType: 'api_key',
        configured: true,
        id: 'deepseek',
        models: [
          { id: 'deepseek-chat', name: 'DeepSeek Chat', providerId: 'deepseek', reasoning: false, supportsImages: false },
          { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', providerId: 'deepseek', reasoning: true, supportsImages: false },
        ],
        name: 'DeepSeek',
        primary: true,
      },
      {
        authType: 'api_key',
        configured: true,
        id: 'openrouter',
        models: [{ id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', providerId: 'openrouter', reasoning: false, supportsImages: false }],
        name: 'OpenRouter',
        primary: false,
      },
    ],
    defaultModel: { modelId: 'deepseek-chat', providerId: 'deepseek' },
    modelPickerScope: 'all-providers',
    primaryProvider: 'deepseek',
  });
  providers.setDefaultModel.mockResolvedValue({
    availableProviders: [],
    connectedProviders: [
      {
        authType: 'api_key',
        configured: true,
        id: 'deepseek',
        models: [
          { id: 'deepseek-chat', name: 'DeepSeek Chat', providerId: 'deepseek', reasoning: false, supportsImages: false },
          { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', providerId: 'deepseek', reasoning: true, supportsImages: false },
        ],
        name: 'DeepSeek',
        primary: true,
      },
    ],
    defaultModel: { modelId: 'deepseek-reasoner', providerId: 'deepseek' },
    modelPickerScope: 'all-providers',
    primaryProvider: 'deepseek',
  });
  workspaces.create.mockResolvedValue({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather, notes] });
  workspaces.clear.mockResolvedValue({ pinnedSessionPaths: [], workspaces: [weather, notes] });
  workspaces.getGitBranch.mockResolvedValue('main');
  workspaces.pickDirectory.mockResolvedValue('/projects/weather');
  workspaces.select.mockResolvedValue({ pinnedSessionPaths: [], selectedWorkspacePath: notes.path, workspaces: [notes, weather] });
});

function renderComposer(onSubmitted = vi.fn(), props: Partial<Parameters<typeof ChatComposer>[0]> = {}) {
  return render(
    <I18nProvider>
      <ChatComposer onSubmitted={onSubmitted} workspace={{ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] }} {...props} />
    </I18nProvider>,
  );
}

function renderNewConversationToolbar(props: Partial<Parameters<typeof NewConversationToolbar>[0]> & { onClearProject?: () => void } = {}) {
  return render(
    <I18nProvider>
      <NewConversationToolbar workspace={{ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather, notes] }} {...props} />
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

  it('autolinks a typed HTTP URL only after a space', async () => {
    const user = userEvent.setup();
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    await user.type(editor, 'https://example.com/docs');
    expect(editor.querySelector('[data-link-href]')).toBeNull();
    await user.type(editor, ' ');

    expect(screen.getByRole('button', { name: 'https://example.com/docs' }).getAttribute('data-link-href')).toBe('https://example.com/docs');
  });

  it('autolinks a pasted HTTP URL without its trailing punctuation', () => {
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    fireEvent.paste(editor, { clipboardData: { getData: () => 'Read https://example.com/docs.' } });

    expect(editor.querySelector('[data-link-href]')?.getAttribute('data-link-href')).toBe('https://example.com/docs');
    expect(editor.textContent).toBe('Read https://example.com/docs.');
  });

  it('shows Codex-style link controls and saves an edited URL', async () => {
    const user = userEvent.setup();
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    await user.type(editor, 'https://example.com/docs ');
    await user.click(editor.querySelector('[data-link-href]')!);
    expect(screen.getByRole('dialog', { name: '链接选项' }).className).toContain('composer-link-popover-actions');
    await user.click(screen.getByRole('button', { name: '编辑链接' }));
    expect(screen.getByRole('dialog', { name: '链接选项' }).className).toContain('composer-link-popover-editor');
    await user.clear(screen.getByRole('textbox', { name: 'URL' }));
    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'https://openai.com');
    await user.click(screen.getByRole('button', { name: '保存链接 URL' }));

    expect(editor.querySelector('[data-link-href]')?.getAttribute('data-link-href')).toBe('https://openai.com');
  });

  it('saves edited link display text without changing its URL', async () => {
    const user = userEvent.setup();
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    await user.type(editor, 'https://example.com/docs ');
    await user.click(editor.querySelector('[data-link-href]')!);
    await user.click(screen.getByRole('button', { name: '编辑文本' }));
    await user.clear(screen.getByRole('textbox', { name: '文本' }));
    await user.type(screen.getByRole('textbox', { name: '文本' }), '项目文档');
    await user.click(screen.getByRole('button', { name: '保存链接文本' }));

    expect(editor.textContent).toBe('项目文档 ');
    expect(editor.querySelector('[data-link-href]')?.getAttribute('data-link-href')).toBe('https://example.com/docs');
  });

  it('saves an edited URL with Enter without submitting the composer', async () => {
    const user = userEvent.setup();
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    await user.type(editor, 'https://example.com/docs ');
    await user.click(editor.querySelector('[data-link-href]')!);
    await user.click(screen.getByRole('button', { name: '编辑链接' }));
    await user.clear(screen.getByRole('textbox', { name: 'URL' }));
    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'https://openai.com{Enter}');

    expect(editor.querySelector('[data-link-href]')?.getAttribute('data-link-href')).toBe('https://openai.com');
    expect(composer.send).not.toHaveBeenCalled();
  });

  it('opens the selected link in a new browser target', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    await user.type(editor, 'https://example.com/docs ');
    await user.click(editor.querySelector('[data-link-href]')!);
    await user.click(screen.getByRole('button', { name: '打开链接' }));

    expect(open).toHaveBeenCalledWith('https://example.com/docs', '_blank', 'noopener,noreferrer');
  });

  it('removes a link while preserving its display text when its URL is cleared', async () => {
    const user = userEvent.setup();
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    await user.type(editor, 'https://example.com/docs ');
    await user.click(editor.querySelector('[data-link-href]')!);
    await user.click(screen.getByRole('button', { name: '编辑链接' }));
    await user.clear(screen.getByRole('textbox', { name: 'URL' }));
    await user.click(screen.getByRole('button', { name: '保存链接 URL' }));

    expect(editor.textContent).toBe('https://example.com/docs ');
    expect(editor.querySelector('[data-link-href]')).toBeNull();
  });

  it('keeps the URL editor open and reports an invalid link', async () => {
    const user = userEvent.setup();
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    await user.type(editor, 'https://example.com/docs ');
    await user.click(editor.querySelector('[data-link-href]')!);
    await user.click(screen.getByRole('button', { name: '编辑链接' }));
    await user.clear(screen.getByRole('textbox', { name: 'URL' }));
    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'ftp://example.com');
    await user.click(screen.getByRole('button', { name: '保存链接 URL' }));

    expect(screen.getByRole('textbox', { name: 'URL' }).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('请输入 HTTP 或 HTTPS 链接');
  });

  it('closes link controls with Escape', async () => {
    const user = userEvent.setup();
    renderComposer();
    const editor = screen.getByRole('textbox', { name: 'Message Pi' });

    await user.type(editor, 'https://example.com/docs ');
    await user.click(editor.querySelector('[data-link-href]')!);
    fireEvent.keyDown(screen.getByRole('dialog', { name: '链接选项' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: '链接选项' })).toBeNull();
  });

  it('prefills the editor with an editable user message draft', () => {
    renderComposer(vi.fn(), { draft: { id: 1, text: 'Revise the plan' } });

    expect(screen.getByRole('textbox', { name: 'Message Pi' }).textContent).toBe('Revise the plan');
  });

  it('renders a prefilled inline message editor through the Composer', () => {
    renderComposer(vi.fn(), {
      inlineEdit: { initialText: 'Revise the plan', onCancel: vi.fn(), onSubmit: vi.fn() },
    } as never);

    expect(screen.getByRole('textbox', { name: 'Edit message' }).textContent).toBe('Revise the plan');
    expect(screen.getByRole('button', { name: 'Cancel edit' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Send edited message' })).not.toBeNull();
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

  it('searches and switches the model from the composer action row', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(await screen.findByRole('button', { name: '选择模型，当前 DeepSeek Chat' }));
    const headings = [...document.querySelectorAll('[cmdk-group-heading]')];
    expect(headings.map(heading => heading.querySelector('.chat-composer-model-group-heading > span')?.textContent)).toEqual(['DeepSeek', 'OpenRouter']);
    expect(headings.every(heading => heading.querySelector('svg'))).toBe(true);
    await user.type(screen.getByRole('combobox', { name: '搜索模型' }), 'reason');
    await waitFor(() => expect(screen.queryByRole('option', { name: /Qwen3 Coder/ })).toBeNull());
    await user.click(screen.getByRole('option', { name: /DeepSeek Reasoner/ }));

    expect(providers.setDefaultModel).toHaveBeenCalledWith('deepseek', 'deepseek-reasoner');
  });

  it('keeps the model picker ungrouped when only one provider is available', async () => {
    const user = userEvent.setup();
    providers.get.mockResolvedValueOnce({
      availableProviders: [],
      connectedProviders: [
        {
          authType: 'api_key',
          configured: true,
          id: 'deepseek',
          models: [
            { id: 'deepseek-chat', name: 'DeepSeek Chat', providerId: 'deepseek', reasoning: false, supportsImages: false },
            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', providerId: 'deepseek', reasoning: true, supportsImages: false },
          ],
          name: 'DeepSeek',
          primary: true,
        },
      ],
      defaultModel: { modelId: 'deepseek-chat', providerId: 'deepseek' },
      modelPickerScope: 'all-providers',
      primaryProvider: 'deepseek',
    });
    renderComposer();

    await user.click(await screen.findByRole('button', { name: '选择模型，当前 DeepSeek Chat' }));

    expect(document.querySelector('[cmdk-group-heading]')).toBeNull();
    expect(screen.getByRole('option', { name: /DeepSeek Reasoner/ })).not.toBeNull();
  });

  it('groups models when all connected providers are in scope even if only one has selectable models', async () => {
    const user = userEvent.setup();
    providers.get.mockResolvedValueOnce({
      availableProviders: [],
      connectedProviders: [
        {
          authType: 'api_key',
          configured: true,
          id: 'deepseek',
          models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat', providerId: 'deepseek', reasoning: false, supportsImages: false }],
          name: 'DeepSeek',
          primary: true,
        },
        {
          authType: 'api_key',
          configured: true,
          id: 'opencode-go',
          models: [],
          name: 'OpenCode Go',
          primary: false,
        },
      ],
      defaultModel: { modelId: 'deepseek-chat', providerId: 'deepseek' },
      modelPickerScope: 'all-providers',
      primaryProvider: 'deepseek',
    });
    renderComposer();

    await user.click(await screen.findByRole('button', { name: '选择模型，当前 DeepSeek Chat' }));

    const headings = [...document.querySelectorAll('[cmdk-group-heading]')];
    expect(headings.map(heading => heading.querySelector('.chat-composer-model-group-heading > span')?.textContent)).toEqual(['DeepSeek']);
    expect(headings[0]?.querySelector('svg')).not.toBeNull();
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

  it('opens the project menu and selects a workspace', async () => {
    const user = userEvent.setup();
    const onSelectProject = vi.fn();
    renderNewConversationToolbar({ onSelectProject, workspace: { pinnedSessionPaths: [], workspaces: [weather, notes] } });

    await user.click(screen.getByRole('button', { name: '选择项目' }));
    expect(screen.getByRole('dialog', { name: '选择项目' })).not.toBeNull();
    await user.click(screen.getByRole('option', { name: 'notes' }));

    expect(onSelectProject).toHaveBeenCalledWith(notes.path);
  });

  it('starts project creation from the project menu', async () => {
    const user = userEvent.setup();
    const onCreateProject = vi.fn();
    renderNewConversationToolbar({ onCreateProject, workspace: { pinnedSessionPaths: [], workspaces: [weather, notes] } });

    await user.click(screen.getByRole('button', { name: '选择项目' }));
    await user.click(screen.getByRole('option', { name: '新建项目' }));

    expect(onCreateProject).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: '选择项目' })).toBeNull();
  });

  it('shows the active local Git context above a new conversation', async () => {
    renderNewConversationToolbar();

    const toolbar = await screen.findByRole('toolbar', { name: '新会话项目上下文' });
    expect(toolbar.textContent).toContain('weather');
    expect(toolbar.textContent).toContain('本地');
    expect(toolbar.textContent).toContain('main');
  });

  it('uses Codex-sized context icons', async () => {
    renderNewConversationToolbar();

    const toolbar = await screen.findByRole('toolbar', { name: '新会话项目上下文' });
    expect([...toolbar.querySelectorAll('svg')].map(icon => icon.getAttribute('width'))).toEqual(['16', '16', '16']);
  });

  it('switches a selected project from the project toolbar', async () => {
    const user = userEvent.setup();
    const onSelectProject = vi.fn();
    renderNewConversationToolbar({ onSelectProject });

    await user.click(screen.getByRole('button', { name: 'weather' }));
    await user.click(screen.getByRole('option', { name: 'notes' }));

    expect(onSelectProject).toHaveBeenCalledWith(notes.path);
  });

  it('clears the selected project without opening its picker', async () => {
    const user = userEvent.setup();
    const onClearProject = vi.fn();
    renderNewConversationToolbar({ onClearProject });

    expect(screen.getByRole('button', { name: '清理项目' }).querySelector('svg')?.getAttribute('width')).toBe('16');

    await user.click(screen.getByRole('button', { name: '清理项目' }));

    expect(onClearProject).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: '选择项目' })).toBeNull();
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
