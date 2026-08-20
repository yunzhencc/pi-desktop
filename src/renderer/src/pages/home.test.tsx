// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act, cleanup, fireEvent, screen, render as testingRender, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../providers/i18n';
import { HomePage } from './home';

let animationFrames: FrameRequestCallback[];
let workspaces: { get: ReturnType<typeof vi.fn>; pick: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> };

function render(ui: ReactElement) {
  return testingRender(<I18nProvider>{ui}</I18nProvider>);
}

vi.mock('../components/chat-composer', () => ({
  ChatComposer: ({ inlineEdit, isRunning, onStop, onSubmitted }: { inlineEdit?: { initialText: string; onCancel: () => void; onSubmit: (text: string) => void }; isRunning: boolean; onStop: () => void; onSubmitted: (text: string) => void }) => inlineEdit
    ? (
        <div>
          <div aria-label="Edit message" role="textbox">{inlineEdit.initialText}</div>
          <button aria-label="Cancel edit" onClick={inlineEdit.onCancel}>Cancel</button>
          <button aria-label="Send edited message" onClick={() => inlineEdit.onSubmit('Build it differently')}>Send</button>
        </div>
      )
    : (
        <button aria-label={isRunning ? 'Stop generating' : 'Fake composer'} onClick={() => isRunning ? onStop() : onSubmitted('Build this')}>
          {isRunning ? 'Stop' : 'Fake composer'}
        </button>
      ),
  NewConversationToolbar: () => <div aria-label="新会话项目上下文" role="toolbar" />,
}));

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
      selectedWorkspacePath: '/projects/weather',
      workspaces: [{ displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' }],
    })),
    pick: vi.fn(() => Promise.resolve({
      selectedWorkspacePath: '/projects/weather',
      workspaces: [{ displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' }],
    })),
    select: vi.fn(),
  };
  vi.stubGlobal('api', { composer: { editLastUserMessage: vi.fn(), newConversation: vi.fn(), onUpdate: vi.fn(() => () => {}) }, workspaces });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('home page', () => {
  it('shows an empty state and appends a submitted user message', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: '我们要构建什么？' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.getByText('Build this')).not.toBeNull();
  });

  it('shows a user message timestamp and copies its text', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 19, 10, 1));
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.getByText(/10:01/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(writeText).toHaveBeenCalledWith('Build this');
  });

  it('keeps the latest assistant reply actions visible while its timestamp stays hover-only', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 19, 10, 1));
    const writeText = vi.fn(() => Promise.resolve());
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<HomePage />);

    act(() => onUpdate.mock.calls[0]![0]({ done: true, text: 'Done', timestamp: Date.now(), type: 'assistant' }));

    expect(screen.getByText(/10:01/)).not.toBeNull();
    expect(container.querySelector('.chat-message-assistant-footer.is-latest')).not.toBeNull();
    expect(container.querySelector('.chat-message-assistant-timestamp')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy assistant message' }));
    expect(writeText).toHaveBeenCalledWith('Done');
  });

  it('shows a completed duration divider before the assistant reply', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T10:00:00Z'));
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    vi.setSystemTime(new Date('2026-08-19T10:01:05Z'));
    act(() => onUpdate.mock.calls[0]![0]({ done: true, entryId: 'assistant-1', text: 'Done', timestamp: Date.now(), type: 'assistant' }));

    expect(screen.getByText('耗时 1分 5秒')).not.toBeNull();
    expect(container.querySelector('[data-duration-divider]')).not.toBeNull();
  });

  it('shows previous assistant reply actions only on hover', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<HomePage />);

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
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<HomePage />);

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
    vi.stubGlobal('api', { composer: { forkAssistantMessage, newConversation: vi.fn(), onUpdate }, workspaces });
    render(<HomePage />);

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
    vi.stubGlobal('api', { composer: { editLastUserMessage, newConversation: vi.fn(), onUpdate: vi.fn(() => () => {}), send }, workspaces });
    render(<HomePage />);

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
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    fireEvent.doubleClick(screen.getByText('Build this'));

    expect(screen.getByRole('textbox', { name: 'Edit message' })).not.toBeNull();
  });

  it('directs an unselected workspace to the sidebar', async () => {
    workspaces.get.mockResolvedValue({ workspaces: [] });
    render(<HomePage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '我们要构建什么？' })).not.toBeNull());
    expect(screen.getByRole('img', { name: 'PI' })).not.toBeNull();
    expect(screen.queryByText('构建新功能、应用或工具')).toBeNull();
  });

  it('welcomes a selected project by name', async () => {
    render(<HomePage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '你想让我们在 weather 中构建什么？' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'weather' }));

    expect(screen.getByRole('dialog', { name: '选择项目' })).not.toBeNull();
    expect(screen.getByRole('combobox', { name: '搜索项目' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: '你想让我们在 weather 中构建什么？' })).not.toBeNull();
    expect(screen.getByRole('img', { name: 'PI' })).not.toBeNull();
  });

  it('clears the pending transcript when a new conversation starts', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    expect(screen.getByText('Build this')).not.toBeNull();
    act(() => window.dispatchEvent(new Event('new-conversation')));

    expect(screen.queryByText('Build this')).toBeNull();
    expect(screen.getByRole('heading', { name: '我们要构建什么？' })).not.toBeNull();
  });

  it('replaces the pending transcript with the selected session history', () => {
    render(<HomePage />);

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
    render(<HomePage />);

    expect(screen.getByRole('toolbar', { name: '新会话项目上下文' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.queryByRole('toolbar', { name: '新会话项目上下文' })).toBeNull();
  });

  it('renders submitted and streamed turns through the transcript log', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    expect(screen.getByRole('log').textContent).toContain('Build this');

    act(() => onUpdate.mock.calls[0]![0]({ done: false, text: 'Working', type: 'assistant' }));
    act(() => animationFrames.at(-1)?.(0));
    expect(screen.getByRole('log').textContent).toContain('Working');
  });

  it('shows a running tool command and collapses its completed output', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<HomePage />);

    act(() => onUpdate.mock.calls[0]![0]({ args: { command: 'git status --short' }, sessionPath: '/sessions/active.jsonl', status: 'running', toolCallId: 'tool-1', toolName: 'bash', type: 'tool' }));

    expect(screen.getByRole('status', { name: '正在使用工具 bash' })).not.toBeNull();
    expect(screen.getByText('git status --short')).not.toBeNull();

    act(() => onUpdate.mock.calls[0]![0]({ output: ' M src/main.ts', sessionPath: '/sessions/active.jsonl', status: 'completed', toolCallId: 'tool-1', toolName: 'bash', type: 'tool' }));

    expect(screen.queryByText(' M src/main.ts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '显示工具 bash 详情' }));
    expect(screen.getByText((_, element) => element?.tagName === 'PRE' && element.textContent === ' M src/main.ts')).not.toBeNull();
  });

  it('keeps the composer inside the transcript scroll container', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.getByRole('log').contains(screen.getByRole('button', { name: 'Fake composer' }))).toBe(true);
  });

  it('renders a streamed assistant snapshot as Markdown', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    const { container } = render(<HomePage />);

    act(() => onUpdate.mock.calls[0]![0]({ done: false, text: 'Use **bold** text.', type: 'assistant' }));
    act(() => animationFrames.at(-1)?.(0));

    expect(container.querySelector('.chat-message-assistant strong')?.textContent).toBe('bold');
  });

  it('renders only the latest streamed snapshot in an animation frame', () => {
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('api', { composer: { onUpdate }, workspaces });
    render(<HomePage />);

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
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate, stop }, workspaces });
    render(<HomePage />);

    act(() => onUpdate.mock.calls[0]![0]({ status: 'running', type: 'status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(stop).toHaveBeenCalledOnce();

    act(() => onUpdate.mock.calls[0]![0]({ status: 'settled', type: 'status' }));
    expect(screen.getByRole('button', { name: 'Fake composer' })).not.toBeNull();
  });
});
