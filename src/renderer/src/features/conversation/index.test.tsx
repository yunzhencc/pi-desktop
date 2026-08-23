// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { I18nProvider } from '@renderer/features/app/i18n';
import { act, cleanup, fireEvent, screen, render as testingRender, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPage } from './';

let animationFrames: FrameRequestCallback[];
let workspaces: { get: ReturnType<typeof vi.fn>; pick: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> };

function render(ui: ReactElement) {
  return testingRender(<I18nProvider>{ui}</I18nProvider>);
}

vi.mock('./components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components')>();
  return {
    ...actual,
    ChatComposer: ({ inlineEdit, isRunning, onStop, onSubmitted }: { inlineEdit?: { initialText: string; onCancel: () => void; onSubmit: (text: string) => void }; isRunning: boolean; onStop: () => void; onSubmitted: Parameters<typeof actual.ChatComposer>[0]['onSubmitted'] }) => inlineEdit
      ? (
          <div>
            <div aria-label="Edit message" role="textbox">{inlineEdit.initialText}</div>
            <button aria-label="Cancel edit" onClick={inlineEdit.onCancel}>Cancel</button>
            <button aria-label="Send edited message" onClick={() => inlineEdit.onSubmit('Build it differently')}>Send</button>
          </div>
        )
      : (
          <>
            <button aria-label={isRunning ? 'Stop generating' : 'Fake composer'} onClick={() => isRunning ? onStop() : onSubmitted('Build this')}>
              {isRunning ? 'Stop' : 'Fake composer'}
            </button>
            <button aria-label="Fake attachment composer" onClick={() => onSubmitted('Summarize this', [{ id: 'pdf-1', kind: 'pdf', name: 'brief.pdf', size: 4 }])}>
              Fake attachment composer
            </button>
            <button aria-label="Fake file-only composer" onClick={() => onSubmitted('', [{ id: 'pdf-1', kind: 'pdf', name: 'brief.pdf', size: 4 }])}>
              Fake file-only composer
            </button>
          </>
        ),
    NewConversationToolbar: () => <div aria-label="新会话项目上下文" role="toolbar" />,
  };
});

beforeEach(() => {
  animationFrames = [];
  vi.stubGlobal('ResizeObserver', class {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  workspaces = {
    get: vi.fn(() => Promise.resolve({
      pinnedSessionPaths: [],
      selectedWorkspacePath: '/projects/weather',
      workspaces: [{ displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' }],
    })),
    pick: vi.fn(() => Promise.resolve({
      pinnedSessionPaths: [],
      selectedWorkspacePath: '/projects/weather',
      workspaces: [{ displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' }],
    })),
    select: vi.fn(),
  };
  vi.stubGlobal('piApp', { composer: { editLastUserMessage: vi.fn(), newConversation: vi.fn(), onUpdate: vi.fn(() => () => {}) }, workspaces });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('conversation page', () => {
  it('shows an empty state and appends a submitted user message', () => {
    render(<ConversationPage />);

    expect(screen.getByRole('heading', { name: '我们要构建什么？' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.getByText('Build this')).not.toBeNull();
    const bubble = screen.getByText('Build this').closest('.chat-message-user-content');
    expect(bubble?.hasAttribute('data-user-message-bubble')).toBe(true);
    expect(bubble?.closest('.chat-message-user-stack')?.hasAttribute('data-user-message-bubble')).toBe(false);
  });

  it('shows a user message timestamp and copies its text', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 19, 10, 1));
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.getByText(/10:01/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(writeText).toHaveBeenCalledWith('Build this');
  });

  it('renders submitted attachments on the user message', () => {
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake attachment composer' }));

    expect(screen.getByText('brief.pdf')).not.toBeNull();
    expect(screen.queryByText('PDF')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show brief.pdf in folder' })).toBeNull();
    expect(screen.getByLabelText('Attachments').getAttribute('data-variant')).toBe('message');
    expect(screen.getByText('brief.pdf').closest('.chat-message-file-pill')).not.toBeNull();
    expect(screen.getByText('brief.pdf').closest('.chat-message-user-content')).toBeNull();
    expect(document.querySelector('.chat-composer-file-card-main')).toBeNull();
    const icon = document.querySelector('.chat-message-file-pill-icon [data-file-icon="pdf"]');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('width')).toBe('18');
    expect(icon?.getAttribute('height')).toBe('18');
  });

  it('does not render an empty text bubble for file-only user messages', () => {
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake file-only composer' }));

    expect(screen.getByText('brief.pdf')).not.toBeNull();
    expect(document.querySelector('.chat-message-file-pill')).not.toBeNull();
    expect(document.querySelector('.chat-message-user-content')).toBeNull();
    expect(screen.getByLabelText('Attachments').hasAttribute('data-user-message-bubble')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
  });

  it('restores submitted attachment summaries for a reopened session', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake attachment composer' }));
    act(() => onUpdate.mock.calls[0]![0]({ sessionPath: '/sessions/active.jsonl', type: 'session' }));
    act(() => window.dispatchEvent(new CustomEvent('session-changed', {
      detail: {
        messages: [{ role: 'user', text: 'Summarize this' }],
        path: '/sessions/active.jsonl',
      },
    })));

    expect(screen.getByText('brief.pdf')).not.toBeNull();
  });

  it('hides restored attachment reference text when the attachment card is present', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake attachment composer' }));
    act(() => onUpdate.mock.calls[0]![0]({ sessionPath: '/sessions/active.jsonl', type: 'session' }));
    act(() => window.dispatchEvent(new CustomEvent('session-changed', {
      detail: {
        messages: [{ role: 'user', text: '@/Users/wangxingkang/Desktop/brief.pdf\n' }],
        path: '/sessions/active.jsonl',
      },
    })));

    expect(screen.getByText('brief.pdf').closest('.chat-message-file-pill')).not.toBeNull();
    expect(screen.queryByText('@/Users/wangxingkang/Desktop/brief.pdf')).toBeNull();
    expect(document.querySelector('.chat-message-user-content')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
  });

  it('keeps the latest assistant reply actions and timestamp visible', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 19, 10, 1));
    const writeText = vi.fn(() => Promise.resolve());
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<ConversationPage />);

    act(() => onUpdate.mock.calls[0]![0]({ done: true, text: 'Done', timestamp: Date.now(), type: 'assistant' }));

    expect(screen.getByText(/10:01/)).not.toBeNull();
    expect(container.querySelector('.chat-message-assistant-footer.is-latest')).not.toBeNull();
    expect(container.querySelector('.chat-message-assistant-timestamp')).not.toBeNull();
    expect(screen.getByRole('toolbar', { name: 'Assistant message actions' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy assistant message' }));
    expect(writeText).toHaveBeenCalledWith('Done');
  });

  it('shows a completed duration divider before the assistant reply', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T10:00:00Z'));
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    vi.setSystemTime(new Date('2026-08-19T10:01:05Z'));
    act(() => onUpdate.mock.calls[0]![0]({ done: true, entryId: 'assistant-1', text: 'Done', timestamp: Date.now(), type: 'assistant' }));

    expect(screen.getByText('耗时 1分 5秒')).not.toBeNull();
    expect(container.querySelector('[data-duration-divider]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '收起工具活动' })).toBeNull();
  });

  it('shows previous assistant reply actions only on hover', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    act(() => onUpdate.mock.calls[0]![0]({ done: true, entryId: 'assistant-1', text: 'First reply', timestamp: 1_000, type: 'assistant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    act(() => onUpdate.mock.calls[0]![0]({ done: true, entryId: 'assistant-2', text: 'Second reply', timestamp: 2_000, type: 'assistant' }));

    const footers = container.querySelectorAll('.chat-message-assistant-footer');
    expect(footers).toHaveLength(2);
    expect(footers[0]?.classList.contains('is-latest')).toBe(false);
    expect(footers[1]?.classList.contains('is-latest')).toBe(true);
  });

  it('does not render Fork when the assistant reply has no branch target', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<ConversationPage />);

    act(() => onUpdate.mock.calls[0]![0]({ done: true, text: 'Done', timestamp: 1_000, type: 'assistant' }));

    expect(screen.queryByRole('button', { name: 'Fork conversation from this message' })).toBeNull();
  });

  it('forks at an assistant reply and switches to the new conversation', async () => {
    const onUpdate = vi.fn(() => () => {});
    const forkAssistantMessage = vi.fn(() => Promise.resolve({
      messages: [
        { role: 'user', text: 'Forked request', timestamp: 1_000 },
        { role: 'assistant', text: 'Forked reply', timestamp: 2_000 },
      ],
      path: '/sessions/forked.jsonl',
    }));
    vi.stubGlobal('piApp', { composer: { forkAssistantMessage, newConversation: vi.fn(), onUpdate }, workspaces });
    render(<ConversationPage />);

    act(() => onUpdate.mock.calls[0]![0]({ done: true, entryId: 'assistant-1', text: 'Original reply', timestamp: 2_000, type: 'assistant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fork conversation from this message' }));

    await waitFor(() => expect(forkAssistantMessage).toHaveBeenCalledWith('assistant-1'));
    expect(screen.getByText('Forked request')).not.toBeNull();
    expect(screen.getByText('Forked reply')).not.toBeNull();
    expect(screen.queryByText('Original reply')).toBeNull();
  });

  it('edits the latest user message in place without navigating until it is resent', async () => {
    const editLastUserMessage = vi.fn(() => Promise.resolve('Build this'));
    const send = vi.fn(() => Promise.resolve());
    vi.stubGlobal('piApp', { composer: { editLastUserMessage, newConversation: vi.fn(), onUpdate: vi.fn(() => () => {}), send }, workspaces });
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));

    expect(screen.getByRole('textbox', { name: 'Edit message' }).textContent).toBe('Build this');
    expect(editLastUserMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }));

    expect(screen.getByText('Build this')).not.toBeNull();
    expect(editLastUserMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send edited message' }));

    await waitFor(() => expect(editLastUserMessage).toHaveBeenCalledOnce());
    expect(editLastUserMessage).toHaveBeenCalledWith('Build it differently');
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByText('Build this')).toBeNull();
    expect(screen.getByText('Build it differently')).not.toBeNull();
  });

  it('opens the latest user message editor on double-click', () => {
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    fireEvent.doubleClick(screen.getByText('Build this'));

    expect(screen.getByRole('textbox', { name: 'Edit message' })).not.toBeNull();
  });

  it('directs an unselected workspace to the sidebar', async () => {
    workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], workspaces: [] });
    render(<ConversationPage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '我们要构建什么？' })).not.toBeNull());
    expect(screen.getByRole('img', { name: 'PI' })).not.toBeNull();
    expect(screen.queryByText('构建新功能、应用或工具')).toBeNull();
  });

  it('welcomes a selected project by name', async () => {
    render(<ConversationPage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '你想让我们在 weather 中构建什么？' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'weather' }));

    expect(screen.getByRole('dialog', { name: '选择项目' })).not.toBeNull();
    expect(screen.getByRole('combobox', { name: '搜索项目' })).not.toBeNull();
    expect(screen.getByRole('img', { name: 'PI' })).not.toBeNull();
  });

  it('clears the pending transcript when a new conversation starts', () => {
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    expect(screen.getByText('Build this')).not.toBeNull();
    act(() => window.dispatchEvent(new Event('new-conversation')));

    expect(screen.queryByText('Build this')).toBeNull();
    expect(screen.getByRole('heading', { name: '我们要构建什么？' })).not.toBeNull();
  });

  it('replaces the pending transcript with the selected session history', () => {
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    act(() => window.dispatchEvent(new CustomEvent('session-changed', {
      detail: {
        messages: [
          { role: 'user', text: 'Earlier request' },
          { role: 'assistant', text: 'Earlier reply' },
        ],
      },
    })));

    expect(screen.queryByText('Build this')).toBeNull();
    expect(screen.getByText('Earlier request')).not.toBeNull();
    expect(screen.getByText('Earlier reply')).not.toBeNull();
  });

  it('shows project controls only while the conversation is new', () => {
    render(<ConversationPage />);

    expect(screen.getByRole('toolbar', { name: '新会话项目上下文' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.queryByRole('toolbar', { name: '新会话项目上下文' })).toBeNull();
  });

  it('renders submitted and streamed turns through the transcript log', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    expect(screen.getByRole('log').textContent).toContain('Build this');

    act(() => onUpdate.mock.calls[0]![0]({ done: false, text: 'Working', type: 'assistant' }));
    act(() => animationFrames.at(-1)?.(0));
    expect(screen.getByRole('log').textContent).toContain('Working');
  });

  it('shows a running tool command and collapses its completed output', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<ConversationPage />);

    act(() => onUpdate.mock.calls[0]![0]({ args: { command: 'git status --short' }, sessionPath: '/sessions/active.jsonl', status: 'running', toolCallId: 'tool-1', toolName: 'bash', type: 'tool' }));

    expect(screen.getByRole('status', { name: '正在使用工具 bash' })).not.toBeNull();
    expect(screen.getByText('git status --short')).not.toBeNull();

    act(() => onUpdate.mock.calls[0]![0]({ output: ' M src/main.ts', sessionPath: '/sessions/active.jsonl', status: 'completed', toolCallId: 'tool-1', toolName: 'bash', type: 'tool' }));

    expect(screen.queryByText(' M src/main.ts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '显示工具 bash 详情' }));
    expect(screen.getByText((_, element) => element?.tagName === 'PRE' && element.textContent === ' M src/main.ts')).not.toBeNull();
  });

  it('collects a completed tool run beneath one duration control', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<ConversationPage />);

    act(() => {
      onUpdate.mock.calls[0]![0]({ startedAtMs: 1_000, status: 'running', type: 'status' });
      onUpdate.mock.calls[0]![0]({ args: { command: 'git status --short' }, status: 'completed', toolCallId: 'tool-1', toolName: 'bash', type: 'tool' });
      onUpdate.mock.calls[0]![0]({ args: { path: 'README.md' }, status: 'failed', toolCallId: 'tool-2', toolName: 'read', type: 'tool' });
      onUpdate.mock.calls[0]![0]({ done: true, text: 'Assistant text stays visible', type: 'assistant' });
      onUpdate.mock.calls[0]![0]({ completedAtMs: 2_000, status: 'settled', type: 'status' });
    });

    expect(container.querySelectorAll('[data-activity-turn]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '收起工具活动' })).not.toBeNull();
    expect(container.querySelector('.chat-worked-for .rotate-180')).not.toBeNull();
    expect(container.querySelector('.chat-worked-for .rotate-180')).toHaveClass('opacity-100');
    expect(screen.getByText('运行了命令')).not.toBeNull();
    expect(screen.getByText('读取文件失败')).not.toBeNull();
    expect(container.querySelector('.chat-activity-turn-content')?.parentElement?.classList.contains('chat-worked-for')).toBe(true);
    expect(container.querySelector('.chat-activity-summary-item')).toHaveClass('w-[min(100%,44rem)]');
    expect(screen.getByRole('button', { name: '显示工具 bash 详情' }).querySelectorAll('svg')[1]).toHaveClass('opacity-0', 'group-hover:opacity-100', 'group-focus-visible:opacity-100');
    expect(screen.getByRole('button', { name: '显示工具 bash 详情' }).querySelectorAll('svg')[1]).not.toHaveClass('ml-auto');
    expect(container.querySelectorAll('.chat-tool-activity')).toHaveLength(0);

    const activityTurn = document.querySelector('[data-activity-turn]')!;
    fireEvent.click(activityTurn.querySelector('button[aria-label="收起工具活动"]')!);
    expect(screen.getByRole('button', { name: '展开工具活动' }).querySelector('svg')).toHaveClass('opacity-0');
    expect(activityTurn.textContent).not.toContain('运行了命令');
    expect(screen.getByText('Assistant text stays visible')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '展开工具活动' }));
    fireEvent.click(screen.getByRole('button', { name: '显示工具 bash 详情' }));
    expect(screen.getByRole('button', { name: '隐藏工具 bash 详情' }).querySelectorAll('svg')[1]).toHaveClass('rotate-180', 'opacity-100');
    expect(container.querySelector('.chat-tool-activity-details')).toHaveClass('overflow-x-hidden', 'overflow-y-auto', '[overflow-wrap:anywhere]');
    expect(screen.getByText('git status --short')).not.toBeNull();
  });

  it('renders web search activity as summaries without raw Markdown output', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<ConversationPage />);

    act(() => {
      onUpdate.mock.calls[0]![0]({ startedAtMs: 1_000, status: 'running', type: 'status' });
      onUpdate.mock.calls[0]![0]({
        args: { queries: ['企业章程 法条 公司法 章程 中国人大网', 'https://www.npc.gov.cn/c2/c30834/202312/t20231229_433999.html'] },
        output: '## Query: "企业章程 法条 公司法 章程 中国人大网"\n\nRaw search result\nSource: 中国人大网',
        status: 'completed',
        toolCallId: 'tool-search',
        toolName: 'web_search',
        type: 'tool',
      });
      onUpdate.mock.calls[0]![0]({ completedAtMs: 2_000, status: 'settled', type: 'status' });
    });

    expect(screen.getByRole('button', { name: '显示网页搜索详情' })).not.toHaveClass('w-full');
    expect(screen.getByRole('button', { name: '显示网页搜索详情' }).querySelector('svg:last-child')).toHaveClass('opacity-0');
    expect(screen.getByText('已搜索网页')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '显示网页搜索详情' }));
    expect(screen.getByRole('button', { name: '隐藏网页搜索详情' }).querySelector('svg:last-child')).toHaveClass('rotate-180', 'opacity-100');
    expect(screen.getByText('已搜索网页：企业章程 法条 公司法 章程 中国人大网')).not.toBeNull();
    expect(screen.getByText('已搜索网页：https://www.npc.gov.cn/c2/c30834/202312/t20231229_433999.html')).not.toBeNull();
    expect(container.textContent).not.toContain('## Query');
    expect(container.textContent).not.toContain('Source: 中国人大网');
    expect(container.querySelector('.chat-tool-activity-details')).toBeNull();
  });

  it('keeps an active activity expanded until its work duration settles', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<ConversationPage />);

    act(() => {
      onUpdate.mock.calls[0]![0]({ startedAtMs: 1_000, status: 'running', type: 'status' });
      onUpdate.mock.calls[0]![0]({ args: { command: 'git status --short' }, status: 'completed', toolCallId: 'tool-1', toolName: 'bash', type: 'tool' });
    });

    expect(screen.getByText('运行了命令')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '收起工具活动' })).toBeNull();

    act(() => onUpdate.mock.calls[0]![0]({ completedAtMs: 2_000, status: 'settled', type: 'status' }));

    expect(screen.getByRole('button', { name: '收起工具活动' })).not.toBeNull();
  });

  it('keeps an activity collapsed after virtualized turns remount', () => {
    render(<ConversationPage />);
    act(() => window.dispatchEvent(new CustomEvent('session-changed', {
      detail: {
        messages: [
          { role: 'user', text: 'Inspect the repository', timestamp: 1_000 },
          { args: { command: 'git status --short' }, role: 'tool', status: 'completed', toolCallId: 'tool-1', toolName: 'bash' },
          { completedAtMs: 2_000, role: 'work', startedAtMs: 1_000, status: 'worked' },
          ...Array.from({ length: 20 }, (_, index) => ({ role: 'assistant', text: `Reply ${index}`, timestamp: 3_000 + index })),
        ],
        path: '/sessions/virtualized.jsonl',
      },
    })));

    const activityTurn = document.querySelector('[data-activity-turn]')!;
    fireEvent.click(activityTurn.querySelector('button[aria-label="收起工具活动"]')!);
    expect(activityTurn.textContent).not.toContain('运行了命令');

    const transcript = screen.getByRole('log');
    Object.defineProperties(transcript, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 2_000 },
    });
    transcript.scrollTop = 1_900;
    fireEvent.scroll(transcript);
    transcript.scrollTop = 0;
    fireEvent.scroll(transcript);

    expect(screen.queryByText('运行了命令')).toBeNull();
  });

  it('collects restored tools that precede their persisted duration', () => {
    const { container } = render(<ConversationPage />);

    act(() => window.dispatchEvent(new CustomEvent('session-changed', {
      detail: {
        messages: [
          { role: 'user', text: 'Read this PDF', timestamp: 1_000 },
          { args: { command: 'pdftotext brief.pdf -' }, role: 'tool', status: 'completed', toolCallId: 'tool-1', toolName: 'bash' },
          { args: { path: 'brief.pdf' }, role: 'tool', status: 'completed', toolCallId: 'tool-2', toolName: 'read' },
          { completedAtMs: 17_000, role: 'work', startedAtMs: 1_000, status: 'worked' },
          { role: 'assistant', text: 'The PDF has four pages.', timestamp: 17_000 },
        ],
        path: '/sessions/pdf.jsonl',
      },
    })));

    expect(container.querySelectorAll('[data-activity-turn]')).toHaveLength(1);
    expect(screen.getByText('运行了命令')).not.toBeNull();
    expect(screen.getByText('已读取文件')).not.toBeNull();
    expect(container.querySelectorAll('.chat-tool-activity')).toHaveLength(0);
    expect(container.querySelector('[data-activity-turn]')?.contains(screen.getByText('The PDF has four pages.'))).toBe(true);
    expect(screen.getByText('The PDF has four pages.')).not.toBeNull();
  });

  it('keeps the composer inside the transcript sticky footer after messages start', () => {
    render(<ConversationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.getByRole('log').contains(screen.getByRole('button', { name: 'Fake composer' }))).toBe(true);
    expect(document.querySelector('.thread-scroll-footer')?.contains(screen.getByRole('button', { name: 'Fake composer' }))).toBe(true);
  });

  it('renders a streamed assistant snapshot as Markdown', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<ConversationPage />);

    act(() => onUpdate.mock.calls[0]![0]({ done: false, text: 'Use **bold** text.', type: 'assistant' }));
    act(() => animationFrames.at(-1)?.(0));

    expect(container.querySelector('.chat-message-assistant strong')?.textContent).toBe('bold');
  });

  it('renders only the latest streamed snapshot in an animation frame', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('piApp', { composer: { onUpdate }, workspaces });
    render(<ConversationPage />);

    act(() => {
      onUpdate.mock.calls[0]![0]({ done: false, text: 'First', type: 'assistant' });
      onUpdate.mock.calls[0]![0]({ done: false, text: 'Second', type: 'assistant' });
    });

    expect(screen.queryByRole('log')).toBeNull();
    act(() => animationFrames.at(-1)?.(0));
    expect(screen.getByRole('log').textContent).toContain('Second');
  });

  it('keeps the composer active until the agent settles and can stop it', () => {
    const onUpdate = vi.fn(() => () => {});
    const stop = vi.fn();
    vi.stubGlobal('piApp', { composer: { newConversation: vi.fn(), onUpdate, stop }, workspaces });
    render(<ConversationPage />);

    act(() => onUpdate.mock.calls[0]![0]({ status: 'running', type: 'status' }));
    expect(screen.getByText('正在思考').classList.contains('is-running')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(stop).toHaveBeenCalledOnce();

    act(() => onUpdate.mock.calls[0]![0]({ status: 'settled', type: 'status' }));
    expect(screen.getByRole('button', { name: 'Fake composer' })).not.toBeNull();
  });
});
