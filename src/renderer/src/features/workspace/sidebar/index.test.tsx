// @vitest-environment jsdom

import { I18nProvider } from '@renderer/features/app/i18n';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSidebar } from '.';

const weather = { displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' };
const research = { displayName: 'research', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/research' };
const session = { firstMessage: 'Summarize the forecast', id: 'session-1', modifiedAt: '2026-08-19T00:00:00.000Z', path: '/sessions/session-1.jsonl' };

beforeEach(() => {
  vi.stubGlobal('piApp', {
    sessions: {
      list: vi.fn(() => Promise.resolve([])),
      open: vi.fn(() => Promise.resolve({ session: { messages: [], path: session.path }, workspace: { pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] } })),
      setPinned: vi.fn(() => Promise.resolve({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] })),
    },
    composer: {
      onUpdate: vi.fn(() => () => {}),
    },
    workspaces: {
      get: vi.fn(() => Promise.resolve({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] })),
      pickDirectory: vi.fn(() => Promise.resolve('/projects/weather')),
      openDirectory: vi.fn(() => Promise.resolve()),
      create: vi.fn(() => Promise.resolve({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] })),
      update: vi.fn(() => Promise.resolve({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] })),
      select: vi.fn(() => Promise.resolve({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] })),
      setPinned: vi.fn(() => Promise.resolve({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] })),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('workspace sidebar', () => {
  it('uses the active locale for project labels', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText('weather')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'weather' })).not.toBeNull();
    expect(screen.getByRole('navigation', { name: '项目' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '添加项目' })).not.toBeNull();
  });

  it('shows the no-chats placeholder after a project loads without sessions', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    const placeholder = await screen.findByText('暂无聊天');
    expect(placeholder).toHaveClass(
      'px-8',
      'py-1',
      'text-[14px]',
      'leading-[21px]',
      'text-text-tertiary',
      'opacity-50',
    );
  });

  it('does not leave projects loading when one session list request fails', async () => {
    const error = new Error('Unable to list sessions');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.piApp.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    window.piApp.sessions.list.mockImplementation(path => path === weather.path ? Promise.reject(error) : Promise.resolve([session]));
    const { container } = render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByText('Summarize the forecast');
    await waitFor(() => expect(container.querySelectorAll('.animate-spin')).toHaveLength(0));
    expect(consoleError).toHaveBeenCalledWith('Failed to list workspace sessions', weather.path, error);
    consoleError.mockRestore();
  });

  it('collapses the project list from its heading', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText('weather')).not.toBeNull());
    const toggle = screen.getByRole('button', { name: '项目' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('weather')).toBeNull();
  });

  it('shows pinned projects in the global section and persists project pinning', async () => {
    window.piApp.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], pinnedWorkspacePaths: [research.path], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'research' });
    expect(screen.getByText('置顶').compareDocumentPosition(screen.getByRole('button', { name: 'weather' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'research' }));
    expect(screen.getByRole('menuitem', { name: '取消置顶' })).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: '取消置顶' })).toBeNull());

    fireEvent.contextMenu(screen.getByRole('button', { name: 'weather' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '置顶' }));

    await waitFor(() => expect(window.piApp.workspaces.setPinned).toHaveBeenCalledWith(weather.path, true));
  });

  it('starts a new chat in the project selected from its action menu', async () => {
    const onNewConversation = vi.fn();
    window.addEventListener('new-conversation', onNewConversation);
    window.piApp.workspaces.select.mockResolvedValue({ pinnedSessionPaths: [], selectedWorkspacePath: research.path, workspaces: [weather, research] });
    window.piApp.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'weather' });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'research' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '新建聊天' }));

    await waitFor(() => expect(window.piApp.workspaces.select).toHaveBeenCalledWith(research.path));
    expect(onNewConversation).toHaveBeenCalledOnce();
    window.removeEventListener('new-conversation', onNewConversation);
  });

  it('opens a project source folder from its action menu', async () => {
    window.piApp.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'weather' });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'research' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '在 Finder 中显示' }));

    await waitFor(() => expect(window.piApp.workspaces.openDirectory).toHaveBeenCalledWith(research.path));
  });

  it('pins a project from its action menu', async () => {
    window.piApp.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'weather' });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'research' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '置顶' }));

    await waitFor(() => expect(window.piApp.workspaces.setPinned).toHaveBeenCalledWith(research.path, true));
  });

  it('opens the project action menu from the ellipsis icon', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'weather' });
    const ellipsis = document.querySelector('.lucide-ellipsis')!;
    fireEvent.click(ellipsis);

    expect(screen.getByRole('menuitem', { name: '置顶' })).not.toBeNull();
    expect(ellipsis.parentElement?.className).toContain('inline-flex');
  });

  it('unpins a project from its action menu', async () => {
    window.piApp.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], pinnedWorkspacePaths: [research.path], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'research' });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'research' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '取消置顶' }));

    await waitFor(() => expect(window.piApp.workspaces.setPinned).toHaveBeenCalledWith(research.path, false));
  });

  it('edits a project name and source folder from its action menu', async () => {
    const edited = { displayName: '天气助手', lastOpenedAt: weather.lastOpenedAt, path: '/projects/weather-agent' };
    window.piApp.workspaces.pickDirectory.mockResolvedValue(edited.path);
    window.piApp.workspaces.update.mockResolvedValue({ pinnedSessionPaths: [], selectedWorkspacePath: edited.path, workspaces: [edited] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'weather' });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'weather' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '编辑' }));
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: edited.displayName } });
    fireEvent.click(screen.getByRole('button', { name: weather.path }));
    await waitFor(() => expect(screen.getByRole('button', { name: edited.path })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '保存项目' }));

    await waitFor(() => expect(window.piApp.workspaces.update).toHaveBeenCalledWith(weather.path, edited.displayName, edited.path));
    expect(await screen.findByRole('button', { name: edited.displayName })).not.toBeNull();
  });

  it('does not show a project info card on hover', async () => {
    window.piApp.sessions.list.mockResolvedValue([session]);
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    fireEvent.mouseEnter(await screen.findByRole('button', { name: 'weather' }));

    expect(screen.queryByRole('dialog', { name: 'weather 项目信息' })).toBeNull();
  });

  it('renders the pinned section before projects and collapses it independently', async () => {
    window.piApp.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], pinnedWorkspacePaths: [research.path], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    const pinnedToggle = await screen.findByRole('button', { name: '置顶' });
    const projectsToggle = screen.getByRole('button', { name: '项目' });
    expect(pinnedToggle.compareDocumentPosition(projectsToggle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(pinnedToggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(pinnedToggle);

    expect(pinnedToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'research' })).toBeNull();
    expect(projectsToggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'weather' })).not.toBeNull();
  });

  it('keeps a persisted new session when an earlier refresh finishes late', async () => {
    let resolveInitial: (sessions: typeof session[]) => void = () => {};
    const initialSessions = new Promise<typeof session[]>((resolve) => {
      resolveInitial = resolve;
    });
    window.piApp.sessions.list.mockReturnValueOnce(initialSessions);
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'weather' });
    await waitFor(() => expect(window.piApp.sessions.list).toHaveBeenCalledOnce());
    window.piApp.sessions.list.mockResolvedValue([session]);
    const onUpdate = window.piApp.composer.onUpdate as ReturnType<typeof vi.fn>;
    act(() => onUpdate.mock.calls[0]![0]({ sessionPath: session.path, type: 'session' }));

    await expect(screen.findByText('Summarize the forecast')).resolves.not.toBeNull();
    resolveInitial([]);

    await waitFor(() => expect(screen.getByText('Summarize the forecast')).not.toBeNull());
  });

  it('collapses and expands a project session history from its project row', async () => {
    window.piApp.sessions.list.mockResolvedValue([session]);
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByText('Summarize the forecast');
    const toggle = screen.getByRole('button', { name: 'weather' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Summarize the forecast')).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByText('Summarize the forecast')).not.toBeNull();
  });

  it('opens the create-project step and persists only after confirmation', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText('weather')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '添加项目' }));

    expect(screen.getByRole('dialog', { name: '创建项目' })).not.toBeNull();
    expect(window.piApp.workspaces.pickDirectory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '添加 PI 可读取和编辑的文件夹' }));
    await waitFor(() => expect(window.piApp.workspaces.pickDirectory).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: '天气助手' } });
    fireEvent.click(screen.getByRole('button', { name: '创建项目' }));

    await waitFor(() => expect(window.piApp.workspaces.create).toHaveBeenCalledWith('天气助手', '/projects/weather'));
  });

  it('creates a project without requiring a project name', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText('weather')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '添加项目' }));
    fireEvent.click(screen.getByRole('button', { name: '添加 PI 可读取和编辑的文件夹' }));
    await waitFor(() => expect(window.piApp.workspaces.pickDirectory).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: '创建项目' }));

    await waitFor(() => expect(window.piApp.workspaces.create).toHaveBeenCalledWith('', '/projects/weather'));
  });

  it('opens project creation when requested by the composer', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText('weather')).not.toBeNull());
    fireEvent(window, new Event('create-project'));

    expect(screen.getByRole('dialog', { name: '创建项目' })).not.toBeNull();
  });

  it('closes the create-project dialog from Escape or its backdrop', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText('weather')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '添加项目' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '创建项目' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '添加项目' }));
    fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]')!);
    expect(screen.queryByRole('dialog', { name: '创建项目' })).toBeNull();
  });

  it('keeps the create-project dialog open while the project is saving', async () => {
    let finishCreate: (workspace: Awaited<ReturnType<Window['piApp']['workspaces']['create']>>) => void;
    window.piApp.workspaces.create.mockImplementationOnce(() => new Promise((resolve) => {
      finishCreate = resolve;
    }));
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText('weather')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '添加项目' }));
    fireEvent.click(screen.getByRole('button', { name: '添加 PI 可读取和编辑的文件夹' }));
    await waitFor(() => expect(window.piApp.workspaces.pickDirectory).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: '天气助手' } });
    fireEvent.click(screen.getByRole('button', { name: '创建项目' }));

    expect(screen.getByRole('button', { name: '关闭' }).hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '创建项目' })).not.toBeNull();

    await act(async () => finishCreate!({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] }));
  });
});
