// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../providers/i18n';
import { WorkspaceSidebar } from './workspace-sidebar';

const weather = { displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' };

beforeEach(() => {
  vi.stubGlobal('api', {
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

    await waitFor(() => expect(screen.getByRole('button', { name: 'weather' })).not.toBeNull());
    expect(screen.getByRole('navigation', { name: '项目' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '添加项目' })).not.toBeNull();
  });

  it('collapses the project list from its heading', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'weather' })).not.toBeNull());
    const toggle = screen.getByRole('button', { name: '项目' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'weather' })).toBeNull();
  });

  it('reflects a project selected from the new-conversation composer', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'weather' })).not.toBeNull());
    window.dispatchEvent(new CustomEvent('workspace-changed', {
      detail: { selectedWorkspacePath: '/projects/notes', workspaces: [{ ...weather, displayName: 'notes', path: '/projects/notes' }, weather] },
    }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'notes' }).getAttribute('aria-current')).toBe('page'));
  });

  it('opens the create-project step and persists only after confirmation', async () => {
    render(
      <I18nProvider>
        <WorkspaceSidebar />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'weather' })).not.toBeNull());
    expect(screen.getByRole('button', { name: 'weather' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: '添加项目' }));

    expect(screen.getByRole('dialog', { name: '创建项目' })).not.toBeNull();
    expect(window.api.workspaces.pickDirectory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '添加 Codex 可读取和编辑的文件夹' }));
    await waitFor(() => expect(window.api.workspaces.pickDirectory).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: '天气助手' } });
    fireEvent.click(screen.getByRole('button', { name: '创建项目' }));

    await waitFor(() => expect(window.api.workspaces.create).toHaveBeenCalledWith('天气助手', '/projects/weather'));
  });
});
