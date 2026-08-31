// @vitest-environment jsdom

import type { WorkspaceFileEntry } from '@shared/types';
import { I18nProvider } from '@renderer/features/app/i18n';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkspaceFileViewer } from '.';

vi.mock('shiki', () => ({
  codeToHtml: vi.fn((code: string) => Promise.resolve(`<pre class="shiki"><code>${code}</code></pre>`)),
}));

beforeEach(() => {
  vi.stubGlobal('piApp', {
    workspaces: {
      get: vi.fn(() => Promise.resolve({
        pinnedSessionPaths: [],
        pinnedWorkspacePaths: [],
        selectedWorkspacePath: '/projects/old',
        workspaces: [],
      })),
      listFiles: vi.fn(() => Promise.resolve([])),
      readFile: vi.fn(),
      revealFile: vi.fn(() => Promise.resolve()),
      searchFiles: vi.fn(() => Promise.resolve({ entries: [], truncated: false })),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('loads the root and previews a selected text file', async () => {
  const user = userEvent.setup();
  window.piApp.workspaces.listFiles = vi.fn(() => Promise.resolve([
    { isDirectory: false, isFile: true, name: 'answer.ts', path: 'answer.ts' },
  ]));
  window.piApp.workspaces.readFile = vi.fn(() => Promise.resolve({ path: 'answer.ts', text: 'export const answer = 42;\nexport default answer;' }));
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  await user.click(await screen.findByRole('button', { name: 'answer.ts' }));

  await waitFor(() => expect(document.body).toHaveTextContent('export const answer = 42;'));
  expect(screen.getByText('1')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
});

it('uses server search results and reveals the selected path', async () => {
  const user = userEvent.setup();
  window.piApp.workspaces.searchFiles = vi.fn(() => Promise.resolve({
    entries: [{ isDirectory: false, isFile: true, name: 'answer.ts', path: 'src/answer.ts' }],
    truncated: false,
  }));
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  await user.type(screen.getByRole('searchbox', { name: '筛选文件' }), 'answer');
  await user.click(await screen.findByRole('button', { name: 'src/answer.ts' }));
  await user.click(screen.getByRole('button', { name: '在文件管理器中显示' }));

  expect(window.piApp.workspaces.revealFile).toHaveBeenCalledWith('src/answer.ts');
});

it('expands directories without loading their children again when selected', async () => {
  const user = userEvent.setup();
  window.piApp.workspaces.listFiles = vi.fn((path: string) => Promise.resolve(path
    ? []
    : [
        { isDirectory: true, isFile: false, name: 'src', path: 'src' },
      ]));
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  await user.click(await screen.findByRole('button', { name: 'Expand src' }));
  expect(window.piApp.workspaces.listFiles).toHaveBeenCalledWith('src');
  await user.click(screen.getByRole('button', { name: 'src' }));
  expect(window.piApp.workspaces.listFiles).toHaveBeenCalledTimes(2);
});

it('clears prior query entries before the next search resolves', async () => {
  const user = userEvent.setup();
  const nextSearch = deferred<{ entries: WorkspaceFileEntry[]; truncated: boolean }>();
  window.piApp.workspaces.searchFiles = vi.fn((query: string) => query === 'next'
    ? nextSearch.promise
    : Promise.resolve({
        entries: [{ isDirectory: false, isFile: true, name: 'previous.ts', path: 'previous.ts' }],
        truncated: false,
      }));
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  const search = screen.getByRole('searchbox', { name: '筛选文件' });
  await user.type(search, 'previous');
  expect(await screen.findByRole('button', { name: 'previous.ts' })).toBeTruthy();

  fireEvent.change(search, { target: { value: 'next' } });
  expect(screen.queryByRole('button', { name: 'previous.ts' })).toBeNull();
  await waitFor(() => expect(window.piApp.workspaces.searchFiles).toHaveBeenCalledWith('next'));
});

it('reloads the tree and ignores the prior workspace root response after a workspace switch', async () => {
  const oldRoot = deferred<WorkspaceFileEntry[]>();
  const newRoot = deferred<WorkspaceFileEntry[]>();
  window.piApp.workspaces.listFiles = vi.fn()
    .mockReturnValueOnce(oldRoot.promise)
    .mockReturnValueOnce(newRoot.promise);
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);
  await waitFor(() => expect(window.piApp.workspaces.listFiles).toHaveBeenCalledTimes(1));

  act(() => window.dispatchEvent(new CustomEvent('workspace-changed', {
    detail: { pinnedSessionPaths: [], pinnedWorkspacePaths: [], selectedWorkspacePath: '/projects/new', workspaces: [] },
  })));
  await waitFor(() => expect(window.piApp.workspaces.listFiles).toHaveBeenCalledTimes(2));
  await act(async () => newRoot.resolve([
    { isDirectory: false, isFile: true, name: 'new.ts', path: 'new.ts' },
  ]));
  expect(await screen.findByRole('button', { name: 'new.ts' })).toBeTruthy();

  await act(async () => oldRoot.resolve([
    { isDirectory: false, isFile: true, name: 'old.ts', path: 'old.ts' },
  ]));
  expect(screen.queryByRole('button', { name: 'old.ts' })).toBeNull();
});

it('clears selection and search without rendering prior workspace responses', async () => {
  const user = userEvent.setup();
  const oldRead = deferred<{ path: string; text: string }>();
  const oldSearch = deferred<{ entries: WorkspaceFileEntry[]; truncated: boolean }>();
  window.piApp.workspaces.listFiles = vi.fn()
    .mockResolvedValueOnce([{ isDirectory: false, isFile: true, name: 'old.ts', path: 'old.ts' }])
    .mockResolvedValueOnce([{ isDirectory: false, isFile: true, name: 'new.ts', path: 'new.ts' }]);
  window.piApp.workspaces.readFile = vi.fn(() => oldRead.promise);
  window.piApp.workspaces.searchFiles = vi.fn(() => oldSearch.promise);
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  await user.click(await screen.findByRole('button', { name: 'old.ts' }));
  await user.type(screen.getByRole('searchbox', { name: '筛选文件' }), 'old');
  await waitFor(() => expect(window.piApp.workspaces.searchFiles).toHaveBeenCalled());
  act(() => window.dispatchEvent(new CustomEvent('workspace-changed', {
    detail: { pinnedSessionPaths: [], pinnedWorkspacePaths: [], selectedWorkspacePath: '/projects/new', workspaces: [] },
  })));

  expect(screen.getByRole('searchbox', { name: '筛选文件' })).toHaveValue('');
  expect(screen.queryByRole('button', { name: '在文件管理器中显示' })).toBeNull();
  expect(await screen.findByRole('button', { name: 'new.ts' })).toBeTruthy();
  await act(async () => {
    oldRead.resolve({ path: 'old.ts', text: 'old workspace content' });
    oldSearch.resolve({
      entries: [{ isDirectory: false, isFile: true, name: 'leaked.ts', path: 'leaked.ts' }],
      truncated: false,
    });
  });

  expect(document.body).not.toHaveTextContent('old workspace content');
  expect(screen.queryByRole('button', { name: 'leaked.ts' })).toBeNull();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
