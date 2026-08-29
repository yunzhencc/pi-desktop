import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IPC_CHANNELS } from '@shared/ipc-channels';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceRegistry } from '../../workspaces';
import { registerWorkspaceHandlers } from './workspaces';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler)),
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
  },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() },
}));

const directories: string[] = [];

async function directory(name: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), `pi-desktop-${name}-`));
  directories.push(path);
  return path;
}

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler)
    throw new Error(`No handler registered for ${channel}`);
  return handler({} as never, ...args);
}

afterEach(async () => {
  handlers.clear();
  await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })));
});

describe('workspace IPC handlers', () => {
  it('uses only the selected workspace for file requests', async () => {
    const stateDirectory = await directory('workspace-state');
    const workspace = await directory('workspace');
    await mkdir(workspace, { recursive: true });
    await writeFile(join(workspace, 'README.md'), 'hello');
    const workspaceRegistry = new WorkspaceRegistry(join(stateDirectory, 'workspaces.json'));
    await workspaceRegistry.load();
    registerWorkspaceHandlers({ piRuntime: {} as never, workspaceRegistry });

    await expect(invoke(IPC_CHANNELS.WorkspacesListFiles, '')).rejects.toThrow('请先选择工作区');
    await workspaceRegistry.select(workspace);
    await expect(invoke(IPC_CHANNELS.WorkspacesListFiles, '')).resolves.toEqual([
      { isDirectory: false, isFile: true, name: 'README.md', path: 'README.md' },
    ]);
  });
});
