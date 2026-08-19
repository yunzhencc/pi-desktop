// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../providers/i18n';
import { WorkspaceSidebar } from './workspace-sidebar';

const weather = { displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' };
const session = { firstMessage: 'Summarize the forecast', id: 'session-1', modifiedAt: '2026-08-19T00:00:00.000Z', path: '/sessions/session-1.jsonl' };

beforeEach(() => {
  vi.stubGlobal('api', {
    sessions: {
      list: vi.fn(() => Promise.resolve([])),
      open: vi.fn(() => Promise.resolve({ session: { messages: [], path: session.path }, workspace: { selectedWorkspacePath: weather.path, workspaces: [weather] } })),
    },
    workspaces: {
      get: vi.fn(() => Promise.resolve({ selectedWorkspacePath: weather.path, workspaces: [weather] })),
      pickDirectory: vi.fn(() => Promise.resolve('/projects/weather')),
      create: vi.fn(() => Promise.resolve({ selectedWorkspacePath: weather.path, workspaces: [weather] })),
      select: vi.fn(() => Promise.resolve({ selectedWorkspacePath: weather.path, workspaces: [weather] })),
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
