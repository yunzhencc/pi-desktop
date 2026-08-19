// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home';

let animationFrames: FrameRequestCallback[];
let workspaces: { get: ReturnType<typeof vi.fn>; pick: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> };

vi.mock('../components/chat-composer', () => ({
  ChatComposer: ({ isRunning, onStop, onSubmitted }: { isRunning: boolean; onStop: () => void; onSubmitted: (text: string) => void }) => (
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
  vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate: vi.fn(() => () => {}) }, workspaces });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

  it('keeps the composer inside the transcript scroll container', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));

    expect(screen.getByRole('log').contains(screen.getByRole('button', { name: 'Fake composer' }))).toBe(true);
  });

  it('shows the completed assistant work duration', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T10:00:00Z'));
    const onUpdate = vi.fn(() => () => {});
    vi.stubGlobal('api', { composer: { newConversation: vi.fn(), onUpdate }, workspaces });
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Fake composer' }));
    vi.setSystemTime(new Date('2026-08-19T10:01:05Z'));
    act(() => onUpdate.mock.calls[0]![0]({ done: true, text: 'Done', type: 'assistant' }));

    expect(screen.getByText('Worked for 1m 5s')).not.toBeNull();
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
