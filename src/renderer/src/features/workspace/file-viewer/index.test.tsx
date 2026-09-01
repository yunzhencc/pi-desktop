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
  expect(screen.getByText('1').parentElement).toHaveClass('leading-5');
  const source = screen.getByText((_, element) => element?.tagName === 'CODE' && element.textContent === 'export const answer = 42;\nexport default answer;');
  expect(source.closest('pre')?.parentElement).toHaveClass('leading-5');
});

it('keeps the selected file label while its preview is loading', async () => {
  const user = userEvent.setup();
  const read = deferred<{ path: string; text: string }>();
  window.piApp.workspaces.listFiles = vi.fn(() => Promise.resolve([
    { isDirectory: false, isFile: true, name: 'answer.ts', path: 'answer.ts' },
  ]));
  window.piApp.workspaces.readFile = vi.fn(() => read.promise);
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  await user.click(await screen.findByRole('button', { name: 'answer.ts' }));

  expect(screen.getAllByText('answer.ts').length).toBeGreaterThan(1);
  expect(screen.getByRole('tab', { name: 'answer.ts' })).toBeTruthy();
  expect(screen.getByText('正在加载文件')).toBeTruthy();
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

it('does not offer disclosure for flat directory search results', async () => {
  const user = userEvent.setup();
  window.piApp.workspaces.searchFiles = vi.fn(() => Promise.resolve({
    entries: [{ isDirectory: true, isFile: false, name: 'components', path: 'src/components' }],
    truncated: false,
  }));
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  await user.type(screen.getByRole('searchbox', { name: '筛选文件' }), 'components');

  expect(await screen.findByRole('button', { name: 'src/components' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Expand components' })).toBeNull();
});

it('calls onClose and retains both scroll positions across a viewer update', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  window.piApp.workspaces.listFiles = vi.fn(() => Promise.resolve([
    { isDirectory: false, isFile: true, name: 'answer.ts', path: 'answer.ts' },
  ]));
  render(<I18nProvider><WorkspaceFileViewer onClose={onClose} /></I18nProvider>);

  const file = await screen.findByRole('button', { name: 'answer.ts' });
  const code = screen.getByRole('region', { name: '文件预览' });
  const explorer = screen.getByRole('region', { name: '资源管理器' });
  code.scrollLeft = 12;
  code.scrollTop = 34;
  explorer.scrollLeft = 56;
  explorer.scrollTop = 78;
  fireEvent.scroll(code);
  fireEvent.scroll(explorer);

  code.scrollLeft = 0;
  code.scrollTop = 0;
  explorer.scrollLeft = 0;
  explorer.scrollTop = 0;
  expect(code).toHaveProperty('scrollLeft', 0);
  expect(code).toHaveProperty('scrollTop', 0);
  expect(explorer).toHaveProperty('scrollLeft', 0);
  expect(explorer).toHaveProperty('scrollTop', 0);

  await user.click(file);
  await user.click(screen.getByRole('button', { name: '关闭文件标签' }));

  expect(code).toHaveProperty('scrollLeft', 12);
  expect(code).toHaveProperty('scrollTop', 34);
  expect(explorer).toHaveProperty('scrollLeft', 56);
  expect(explorer).toHaveProperty('scrollTop', 78);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('reserves the 46px titlebar while keeping the workbench full height', () => {
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  expect(screen.getByRole('region', { name: '文件' })).toHaveClass('h-full', 'pt-11.5');
});

it('expands directories without loading their children again when selected', async () => {
  const user = userEvent.setup();
  window.piApp.workspaces.listFiles = vi.fn((path: string) => Promise.resolve(path
    ? []
    : [
        { isDirectory: true, isFile: false, name: 'src', path: 'src' },
      ]));
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  await user.click(await screen.findByRole('button', { name: '展开 src' }));
  expect(window.piApp.workspaces.listFiles).toHaveBeenCalledWith('src');
  expect(screen.getByRole('button', { name: '折叠 src' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'src' }));
  expect(window.piApp.workspaces.listFiles).toHaveBeenCalledTimes(2);
});

it('clears both scroll offsets when the workspace changes', async () => {
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  const code = screen.getByRole('region', { name: '文件预览' });
  const explorer = screen.getByRole('region', { name: '资源管理器' });
  code.scrollLeft = 12;
  code.scrollTop = 34;
  explorer.scrollLeft = 56;
  explorer.scrollTop = 78;
  fireEvent.scroll(code);
  fireEvent.scroll(explorer);

  act(() => window.dispatchEvent(new CustomEvent('workspace-changed', {
    detail: { pinnedSessionPaths: [], pinnedWorkspacePaths: [], selectedWorkspacePath: '/projects/new', workspaces: [] },
  })));

  expect(code).toHaveProperty('scrollLeft', 0);
  expect(code).toHaveProperty('scrollTop', 0);
  expect(explorer).toHaveProperty('scrollLeft', 0);
  expect(explorer).toHaveProperty('scrollTop', 0);
});

it('ignores the initial workspace snapshot after a newer empty workspace event', async () => {
  const initialWorkspace = deferred<{
    pinnedSessionPaths: [];
    pinnedWorkspacePaths: [];
    selectedWorkspacePath: string;
    workspaces: [];
  }>();
  window.piApp.workspaces.get = vi.fn(() => initialWorkspace.promise);
  render(<I18nProvider><WorkspaceFileViewer onClose={vi.fn()} /></I18nProvider>);

  act(() => window.dispatchEvent(new CustomEvent('workspace-changed', {
    detail: { pinnedSessionPaths: [], pinnedWorkspacePaths: [], workspaces: [] },
  })));
  await act(async () => initialWorkspace.resolve({
    pinnedSessionPaths: [],
    pinnedWorkspacePaths: [],
    selectedWorkspacePath: '/projects/stale',
    workspaces: [],
  }));

  expect(window.piApp.workspaces.listFiles).not.toHaveBeenCalled();
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
