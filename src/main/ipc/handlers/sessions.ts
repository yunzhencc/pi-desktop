import type { PiRuntime } from '../../pi-runtime';
import type { WorkspaceRegistry } from '../../workspaces';
import { IPC_CHANNELS } from '@shared/ipc-channels';
import { registerHandler } from '../registry';

interface SessionHandlerDependencies {
  piRuntime: PiRuntime;
  workspaceRegistry: WorkspaceRegistry;
}

export function registerSessionHandlers({ piRuntime, workspaceRegistry }: SessionHandlerDependencies): void {
  const activateWorkspace = async (path: string) => {
    const snapshot = await workspaceRegistry.activate(path);
    piRuntime.setWorkspace(snapshot.selectedWorkspacePath!);
    return snapshot;
  };

  registerHandler(IPC_CHANNELS.SessionsList, (_event, workspacePath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim())
      throw new TypeError('无效的工作区路径');
    return piRuntime.listWorkspaceSessions(workspacePath);
  });
  registerHandler(IPC_CHANNELS.SessionsGetUsageStats, (_event, workspacePath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim())
      throw new TypeError('无效的工作区路径');
    return piRuntime.getWorkspaceUsageStats(workspacePath);
  });
  registerHandler(IPC_CHANNELS.SessionsOpen, async (_event, workspacePath: unknown, sessionPath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim() || typeof sessionPath !== 'string' || !sessionPath.trim())
      throw new TypeError('无效的会话');
    const sessions = await piRuntime.listWorkspaceSessions(workspacePath);
    if (!sessions.some(session => session.path === sessionPath))
      throw new TypeError('会话不属于该工作区');
    const snapshot = await activateWorkspace(workspacePath);
    return { session: await piRuntime.openSession(sessionPath), workspace: snapshot };
  });
  registerHandler(IPC_CHANNELS.SessionsSetPinned, async (_event, workspacePath: unknown, sessionPath: unknown, pinned: unknown, beforeSessionPath: unknown) => {
    if (typeof workspacePath !== 'string' || !workspacePath.trim() || typeof sessionPath !== 'string' || !sessionPath.trim() || typeof pinned !== 'boolean' || (beforeSessionPath !== undefined && typeof beforeSessionPath !== 'string'))
      throw new TypeError('无效的会话置顶请求');
    const sessions = await piRuntime.listWorkspaceSessions(workspacePath);
    if (!sessions.some(session => session.path === sessionPath) || (beforeSessionPath !== undefined && !sessions.some(session => session.path === beforeSessionPath)))
      throw new TypeError('会话不属于该工作区');
    return workspaceRegistry.setSessionPinned(sessionPath, pinned, beforeSessionPath);
  });
}
