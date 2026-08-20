// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../providers/i18n';
import { WorkspaceSidebar } from './workspace-sidebar';

const weather = { displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' };
const research = { displayName: 'research', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/research' };
const session = { firstMessage: 'Summarize the forecast', id: 'session-1', modifiedAt: '2026-08-19T00:00:00.000Z', path: '/sessions/session-1.jsonl' };
const pinnedSession = { firstMessage: 'Keep this handy', id: 'session-2', modifiedAt: '2026-08-19T00:00:00.000Z', path: '/sessions/session-2.jsonl' };
const secondPinnedSession = { firstMessage: 'Review this later', id: 'session-3', modifiedAt: '2026-08-19T00:00:00.000Z', path: '/sessions/session-3.jsonl' };

beforeEach(() => {
  vi.stubGlobal('api', {
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
      create: vi.fn(() => Promise.resolve({ pinnedSessionPaths: [], selectedWorkspacePath: weather.path, workspaces: [weather] })),
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

  it('opens a session instead of selecting its project', async () => {
    window.api.sessions.list.mockResolvedValue([session]);
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Summarize the forecast' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Summarize the forecast' }));

    await waitFor(() => expect(window.api.sessions.open).toHaveBeenCalledWith(weather.path, session.path));
  });

  it('shows the global pinned section before project sessions and persists a pin action', async () => {
    window.api.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [pinnedSession.path], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    window.api.sessions.list.mockImplementation(path => Promise.resolve(path === research.path ? [pinnedSession] : [session]));
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'Keep this handy' });
    expect(screen.getByText('置顶').compareDocumentPosition(screen.getByRole('button', { name: 'weather' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('button', { name: '取消置顶 Keep this handy' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '置顶 Summarize the forecast' }));

    await waitFor(() => expect(window.api.sessions.setPinned).toHaveBeenCalledWith(weather.path, session.path, true));
  });

  it('shows pinned projects in the global section and persists project pinning', async () => {
    window.api.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], pinnedWorkspacePaths: [research.path], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'research' });
    expect(screen.getByText('置顶').compareDocumentPosition(screen.getByRole('button', { name: 'weather' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('button', { name: '取消置顶项目 research' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '置顶项目 weather' }));

    await waitFor(() => expect(window.api.workspaces.setPinned).toHaveBeenCalledWith(weather.path, true));
  });

  it('reorders pinned projects by dragging them within the global section', async () => {
    window.api.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], pinnedWorkspacePaths: [weather.path, research.path], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    const weatherProject = (await screen.findByRole('button', { name: 'weather' })).closest('.workspace-sidebar-project')!;
    const researchProject = screen.getByRole('button', { name: 'research' }).closest('.workspace-sidebar-project')!;
    fireEvent.dragStart(researchProject);
    fireEvent.drop(weatherProject);

    await waitFor(() => expect(window.api.workspaces.setPinned).toHaveBeenCalledWith(research.path, true, weather.path));
  });

  it('reorders pinned tasks within a pinned project without moving that project', async () => {
    window.api.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [pinnedSession.path, secondPinnedSession.path], pinnedWorkspacePaths: [research.path], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
    window.api.sessions.list.mockImplementation(path => Promise.resolve(path === research.path ? [pinnedSession, secondPinnedSession] : []));
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    const firstTask = await screen.findByRole('button', { name: 'Keep this handy' });
    const secondTask = screen.getByRole('button', { name: 'Review this later' });
    fireEvent.dragStart(secondTask.closest('.workspace-sidebar-session-row')!);
    fireEvent.drop(firstTask.closest('.workspace-sidebar-session-row')!);

    await waitFor(() => expect(window.api.sessions.setPinned).toHaveBeenCalledWith(research.path, secondPinnedSession.path, true, pinnedSession.path));
    expect(window.api.workspaces.setPinned).not.toHaveBeenCalled();
  });

  it('renders the pinned section before projects and collapses it independently', async () => {
    window.api.workspaces.get.mockResolvedValue({ pinnedSessionPaths: [], pinnedWorkspacePaths: [research.path], selectedWorkspacePath: weather.path, workspaces: [weather, research] });
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

  it('delegates a session selection to application navigation when provided', async () => {
    const onOpenSession = vi.fn();
    window.api.sessions.list.mockResolvedValue([session]);
    render(
      <I18nProvider>
        <WorkspaceSidebar onOpenSession={onOpenSession} />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'Summarize the forecast' });
    fireEvent.click(screen.getByRole('button', { name: 'Summarize the forecast' }));

    expect(onOpenSession).toHaveBeenCalledWith(weather.path, session.path);
    expect(window.api.sessions.open).not.toHaveBeenCalled();
  });

  it('marks a session selected when application navigation restores it', async () => {
    window.api.sessions.list.mockResolvedValue([session]);
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    const sessionButton = await screen.findByRole('button', { name: 'Summarize the forecast' });
    fireEvent(window, new CustomEvent('session-changed', { detail: { messages: [], path: session.path } }));

    expect(sessionButton.getAttribute('aria-current')).toBe('page');
  });

  it('shows activity on the session that is generating', async () => {
    window.api.sessions.list.mockResolvedValue([session]);
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    const sessionButton = await screen.findByRole('button', { name: 'Summarize the forecast' });
    const onUpdate = window.api.composer.onUpdate as ReturnType<typeof vi.fn>;
    fireEvent(window, new CustomEvent('session-changed', { detail: { messages: [], path: session.path } }));
    act(() => onUpdate.mock.calls[0]![0]({ sessionPath: session.path, status: 'running', type: 'status' }));

    expect(screen.getByRole('status', { name: '正在生成' })).not.toBeNull();
    expect(sessionButton.querySelector('.workspace-sidebar-session-title')).not.toBeNull();
  });

  it('collapses and expands a project session history from its project row', async () => {
    window.api.sessions.list.mockResolvedValue([session]);
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await screen.findByRole('button', { name: 'Summarize the forecast' });
    const toggle = screen.getByRole('button', { name: 'weather' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Summarize the forecast' })).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Summarize the forecast' })).not.toBeNull();
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
    expect(window.api.workspaces.pickDirectory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '添加 Codex 可读取和编辑的文件夹' }));
    await waitFor(() => expect(window.api.workspaces.pickDirectory).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: '天气助手' } });
    fireEvent.click(screen.getByRole('button', { name: '创建项目' }));

    await waitFor(() => expect(window.api.workspaces.create).toHaveBeenCalledWith('天气助手', '/projects/weather'));
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
});
