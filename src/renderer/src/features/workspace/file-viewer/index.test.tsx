// @vitest-environment jsdom

import { I18nProvider } from '@renderer/features/app/i18n';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkspaceFileViewer } from '.';

vi.mock('shiki', () => ({
  codeToHtml: vi.fn((code: string) => Promise.resolve(`<pre class="shiki"><code>${code}</code></pre>`)),
}));

beforeEach(() => {
  vi.stubGlobal('piApp', {
    workspaces: {
      listFiles: vi.fn(() => Promise.resolve([])),
      readFile: vi.fn(),
      revealFile: vi.fn(() => Promise.resolve()),
      searchFiles: vi.fn(() => Promise.resolve({ entries: [], truncated: false })),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('loads the root and previews a selected text file', async () => {
  const user = userEvent.setup();
  window.piApp.workspaces.listFiles = vi.fn(() => Promise.resolve([
    { isDirectory: false, isFile: true, name: 'answer.ts', path: 'answer.ts' },
  ]));
  window.piApp.workspaces.readFile = vi.fn(() => Promise.resolve({ path: 'answer.ts', text: 'export const answer = 42;' }));
  render(<I18nProvider><WorkspaceFileViewer /></I18nProvider>);

  await user.click(await screen.findByRole('button', { name: 'answer.ts' }));

  await waitFor(() => expect(document.body).toHaveTextContent('export const answer = 42;'));
});

it('uses server search results and reveals the selected path', async () => {
  const user = userEvent.setup();
  window.piApp.workspaces.searchFiles = vi.fn(() => Promise.resolve({
    entries: [{ isDirectory: false, isFile: true, name: 'answer.ts', path: 'src/answer.ts' }],
    truncated: false,
  }));
  render(<I18nProvider><WorkspaceFileViewer /></I18nProvider>);

  await user.type(screen.getByRole('searchbox', { name: '筛选文件' }), 'answer');
  await user.click(await screen.findByRole('button', { name: 'src/answer.ts' }));
  await user.click(screen.getByRole('button', { name: '在文件管理器中显示' }));

  expect(window.piApp.workspaces.revealFile).toHaveBeenCalledWith('src/answer.ts');
});
