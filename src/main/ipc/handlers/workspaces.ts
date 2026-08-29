import type { PiRuntime } from '../../pi-runtime';
import type { WorkspaceRegistry } from '../../workspaces';
import { IPC_CHANNELS } from '@shared/ipc-channels';
import { BrowserWindow, dialog, shell } from 'electron';
import { listWorkspaceFiles, readWorkspaceFile, resolveWorkspaceFilePath, searchWorkspaceFiles } from '../../workspace-files';
import { getWorkspaceGitBranch } from '../../workspaces';
import { registerHandler } from '../registry';

interface WorkspaceHandlerDependencies {
  piRuntime: PiRuntime;
  workspaceRegistry: WorkspaceRegistry;
}

export function registerWorkspaceHandlers({ piRuntime, workspaceRegistry }: WorkspaceHandlerDependencies): void {
  const selectedWorkspacePath = () => {
    const path = workspaceRegistry.snapshot().selectedWorkspacePath;
    if (!path)
      throw new Error('请先选择工作区');
    return path;
  };
  const selectWorkspace = async (path: string) => {
    const snapshot = await workspaceRegistry.select(path);
    piRuntime.setWorkspace(snapshot.selectedWorkspacePath!);
    return snapshot;
  };

  registerHandler(IPC_CHANNELS.WorkspacesGet, () => workspaceRegistry.snapshot());
  registerHandler(IPC_CHANNELS.WorkspacesListFiles, (_event, relativePath: unknown) => {
    if (typeof relativePath !== 'string')
      throw new TypeError('无效的文件路径');
    return listWorkspaceFiles(selectedWorkspacePath(), relativePath);
  });
  registerHandler(IPC_CHANNELS.WorkspacesReadFile, (_event, relativePath: unknown) => {
    if (typeof relativePath !== 'string')
      throw new TypeError('无效的文件路径');
    return readWorkspaceFile(selectedWorkspacePath(), relativePath);
  });
  registerHandler(IPC_CHANNELS.WorkspacesSearchFiles, (_event, query: unknown) => {
    if (typeof query !== 'string')
      throw new TypeError('无效的搜索内容');
    return searchWorkspaceFiles(selectedWorkspacePath(), query);
  });
  registerHandler(IPC_CHANNELS.WorkspacesRevealFile, async (_event, relativePath: unknown) => {
    if (typeof relativePath !== 'string')
      throw new TypeError('无效的文件路径');
    shell.showItemInFolder(await resolveWorkspaceFilePath(selectedWorkspacePath(), relativePath));
  });
  registerHandler(IPC_CHANNELS.WorkspacesSetPinned, (_event, workspacePath: unknown, pinned: unknown, beforeWorkspacePath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim() || typeof pinned !== 'boolean' || (beforeWorkspacePath !== undefined && typeof beforeWorkspacePath !== 'string'))
      throw new TypeError('无效的项目置顶请求');
    return workspaceRegistry.setWorkspacePinned(workspacePath, pinned, beforeWorkspacePath);
  });
  registerHandler(IPC_CHANNELS.WorkspacesClear, async () => {
    const snapshot = await workspaceRegistry.clear();
    piRuntime.clearWorkspace();
    return snapshot;
  });
  registerHandler(IPC_CHANNELS.WorkspacesGetGitBranch, (_event, path: unknown) => {
    if (typeof path !== 'string' || !path.trim())
      throw new TypeError('无效的工作区路径');
    return getWorkspaceGitBranch(path);
  });
  registerHandler(IPC_CHANNELS.WorkspacesPickDirectory, async (event) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender) ?? undefined, {
      properties: ['openDirectory'],
      title: '选择源文件夹',
    });
    return result.canceled ? undefined : result.filePaths[0];
  });
  registerHandler(IPC_CHANNELS.WorkspacesOpenDirectory, async (_event, path: unknown) => {
    if (typeof path !== 'string' || !path.trim())
      throw new TypeError('无效的工作区路径');
    const error = await shell.openPath(path);
    if (error)
      throw new Error(error);
  });
  registerHandler(IPC_CHANNELS.WorkspacesCreate, async (_event, name: unknown, path: unknown) => {
    if (typeof name !== 'string' || typeof path !== 'string' || !path.trim())
      throw new TypeError('无效的项目');
    const snapshot = await workspaceRegistry.create(path, name);
    piRuntime.setWorkspace(snapshot.selectedWorkspacePath!);
    return snapshot;
  });
  registerHandler(IPC_CHANNELS.WorkspacesUpdate, async (_event, path: unknown, name: unknown, nextPath: unknown) => {
    if (typeof path !== 'string' || !path.trim() || typeof name !== 'string' || typeof nextPath !== 'string' || !nextPath.trim())
      throw new TypeError('无效的项目');
    const snapshot = await workspaceRegistry.update(path, nextPath, name);
    if (snapshot.selectedWorkspacePath === nextPath)
      piRuntime.setWorkspace(nextPath);
    return snapshot;
  });
  registerHandler(IPC_CHANNELS.WorkspacesSelect, (_event, path: unknown) => {
    if (typeof path !== 'string' || !path.trim())
      throw new TypeError('无效的工作区路径');
    return selectWorkspace(path);
  });
}
