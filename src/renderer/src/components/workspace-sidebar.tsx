import type { FormEvent, SVGProps } from 'react';
import { Folder, FolderPlus, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

type WorkspaceSnapshot = Awaited<ReturnType<Window['api']['workspaces']['get']>>;
type PiSessionSummary = Awaited<ReturnType<Window['api']['sessions']['list']>>[number];

interface WorkspaceSidebarProps {
  onOpenSession?: (workspacePath: string, sessionPath: string) => void;
}

export function WorkspaceSidebar({ onOpenSession }: WorkspaceSidebarProps) {
  const { formatMessage } = useIntl();
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>();
  const [sessionsByWorkspace, setSessionsByWorkspace] = useState<Record<string, PiSessionSummary[]>>({});
  const [collapsedSessionPaths, setCollapsedSessionPaths] = useState<Record<string, boolean>>({});
  const [selectedSessionPath, setSelectedSessionPath] = useState<string>();
  const [runningSessionPath, setRunningSessionPath] = useState<string>();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    void window.api.workspaces.get().then(setWorkspace);
    const onWorkspaceChanged = (event: Event) => setWorkspace((event as CustomEvent<WorkspaceSnapshot>).detail);
    const onSessionChanged = (event: Event) => setSelectedSessionPath((event as CustomEvent<{ path: string }>).detail.path);
    const openCreateProject = () => setIsCreating(true);
    window.addEventListener('workspace-changed', onWorkspaceChanged);
    window.addEventListener('session-changed', onSessionChanged);
    window.addEventListener('create-project', openCreateProject);
    return () => {
      window.removeEventListener('workspace-changed', onWorkspaceChanged);
      window.removeEventListener('session-changed', onSessionChanged);
      window.removeEventListener('create-project', openCreateProject);
    };
  }, []);

  useEffect(() => window.api.composer.onUpdate((update) => {
    if (update.type !== 'status' || !update.sessionPath)
      return;
    setRunningSessionPath(current => update.status === 'running' ? update.sessionPath : current === update.sessionPath ? undefined : current);
  }), []);

  useEffect(() => {
    if (!workspace)
      return;
    let active = true;
    const refresh = () => Promise.all(workspace.workspaces.map(async item => [item.path, await window.api.sessions.list(item.path)] as const)).then((entries) => {
      if (active)
        setSessionsByWorkspace(Object.fromEntries(entries));
    }).catch(() => {
      if (active)
        setSessionsByWorkspace({});
    });
    const clearSelectedSession = () => setSelectedSessionPath(undefined);
    void refresh();
    window.addEventListener('sessions-changed', refresh);
    window.addEventListener('new-conversation', clearSelectedSession);
    return () => {
      active = false;
      window.removeEventListener('sessions-changed', refresh);
      window.removeEventListener('new-conversation', clearSelectedSession);
    };
  }, [workspace]);

  const update = (next: WorkspaceSnapshot) => {
    setWorkspace(next);
    window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: next }));
  };

  const openSession = async (workspacePath: string, sessionPath: string) => {
    if (onOpenSession) {
      onOpenSession(workspacePath, sessionPath);
      return;
    }
    const { session, workspace } = await window.api.sessions.open(workspacePath, sessionPath);
    update(workspace);
    setSelectedSessionPath(sessionPath);
    window.dispatchEvent(new CustomEvent('session-changed', { detail: session }));
  };

  return (
    <nav aria-label={formatMessage({ id: 'projects.title' })} className="workspace-sidebar">
      <div className="workspace-sidebar-heading">
        <button aria-expanded={!isCollapsed} className="workspace-sidebar-toggle" onClick={() => setIsCollapsed(collapsed => !collapsed)} type="button">
          <span>{formatMessage({ id: 'projects.title' })}</span>
          <CodexChevron aria-hidden="true" className={isCollapsed ? 'is-collapsed' : undefined} />
        </button>
        <button aria-label={formatMessage({ id: 'projects.add' })} className="workspace-sidebar-create" onClick={() => setIsCreating(true)} title={formatMessage({ id: 'projects.add' })} type="button"><CodexPlus aria-hidden="true" /></button>
      </div>
      {!isCollapsed && (
        <div className="workspace-sidebar-list">
          {workspace?.workspaces.map((item) => {
            const collapsed = collapsedSessionPaths[item.path] ?? false;
            const sessionListId = `workspace-sessions-${item.path}`;
            return (
              <div className="workspace-sidebar-project" key={item.path}>
                <button aria-controls={sessionListId} aria-expanded={!collapsed} className="workspace-sidebar-project-toggle" onClick={() => setCollapsedSessionPaths(paths => ({ ...paths, [item.path]: !paths[item.path] }))} type="button">
                  <CodexFolder aria-hidden="true" />
                  <span>{item.displayName}</span>
                </button>
                {!collapsed && (
                  <div id={sessionListId}>
                    {(sessionsByWorkspace[item.path] ?? []).map(session => (
                      <button aria-current={session.path === selectedSessionPath ? 'page' : undefined} key={session.path} onClick={() => void openSession(item.path, session.path)} type="button">
                        <span>{session.firstMessage || '新对话'}</span>
                        {session.path === runningSessionPath && <span aria-label="正在生成" className="workspace-sidebar-session-activity" role="status"><LoaderCircle aria-hidden="true" className="chat-composer-send-loading" size={16} /></span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isCreating && <CreateProjectDialog onClose={() => setIsCreating(false)} onCreated={update} />}
    </nav>
  );
}

function CodexChevron(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" height="21" viewBox="0 0 20 21" width="20" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M15.2793 7.71101C15.539 7.45131 15.961 7.45131 16.2207 7.71101C16.4804 7.97071 16.4804 8.39272 16.2207 8.65242L10.4707 14.4024C10.211 14.6621 9.78902 14.6621 9.52932 14.4024L3.77932 8.65242L3.69436 8.54792C3.52385 8.28979 3.55205 7.93828 3.77932 7.71101C4.00659 7.48374 4.3581 7.45554 4.61623 7.62605L4.72073 7.71101L10 12.9903L15.2793 7.71101Z" fill="currentColor" stroke="currentColor" strokeWidth=".6" />
    </svg>
  );
}

function CodexFolder(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path clipRule="evenodd" d="M5.55957 2.14136C6.06503 2.14136 6.55801 2.30207 6.9668 2.59937L7.81836 3.21851C8.04761 3.38513 8.32401 3.47534 8.60742 3.47534H12.1338C13.4545 3.47559 14.5254 4.54621 14.5254 5.86694V11.4666C14.5254 12.7873 13.4545 13.8579 12.1338 13.8582H3.86621C2.54554 13.8579 1.47461 12.7873 1.47461 11.4666V4.53296C1.47486 3.21244 2.54569 2.1416 3.86621 2.14136H5.55957ZM2.52539 7.85718V11.4666C2.52539 12.2074 3.12544 12.8081 3.86621 12.8083H12.1338C12.8746 12.8081 13.4746 12.2074 13.4746 11.4666V7.85718H2.52539ZM3.86621 3.19214C3.12559 3.19238 2.52564 3.79234 2.52539 4.53296V6.8064H13.4746V5.86694C13.4746 5.12611 12.8746 4.52539 12.1338 4.52515H8.60742C8.10203 4.52515 7.60895 4.36534 7.2002 4.06812L6.34863 3.448C6.11937 3.28135 5.84301 3.19214 5.55957 3.19214H3.86621Z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

function CodexPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M9.33496 16.5V10.665H3.5C3.13273 10.665 2.83496 10.3673 2.83496 10C2.83496 9.63273 3.13273 9.33496 3.5 9.33496H9.33496V3.5C9.33496 3.13273 9.63273 2.83496 10 2.83496C10.3673 2.83496 10.665 3.13273 10.665 3.5V9.33496H16.5L16.6338 9.34863C16.9369 9.41057 17.165 9.67857 17.165 10C17.165 10.3214 16.9369 10.5894 16.6338 10.6514L16.5 10.665H10.665V16.5C10.665 16.8673 10.3673 17.165 10 17.165C9.63273 17.165 9.33496 16.8673 9.33496 16.5Z" fill="currentColor" />
    </svg>
  );
}

export function CreateProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (workspace: WorkspaceSnapshot) => void }) {
  const [name, setName] = useState('');
  const [sourcePath, setSourcePath] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickDirectory = async () => {
    const path = await window.api.workspaces.pickDirectory();
    if (path)
      setSourcePath(path);
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting)
      return;
    if (!name.trim() || !sourcePath) {
      setError('请填写项目名称并添加源文件夹');
      return;
    }
    setIsSubmitting(true);
    setError(undefined);
    try {
      onCreated(await window.api.workspaces.create(name.trim(), sourcePath));
      onClose();
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建项目失败');
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="project-dialog-backdrop" role="presentation">
      <form aria-labelledby="create-project-title" aria-modal="true" className="project-dialog" onSubmit={event => void create(event)} role="dialog">
        <div className="project-dialog-header">
          <h2 id="create-project-title">创建项目</h2>
          <button aria-label="关闭" onClick={onClose} type="button"><X aria-hidden="true" size={22} /></button>
        </div>
        <label className="project-dialog-name">
          <Folder aria-hidden="true" size={24} />
          <input aria-label="项目名称" autoFocus onChange={event => setName(event.target.value)} placeholder="项目名称" value={name} />
        </label>
        <span className="project-dialog-label">源文件夹</span>
        <button className="project-dialog-source" onClick={() => void pickDirectory()} type="button">
          <FolderPlus aria-hidden="true" size={28} />
          <span>{sourcePath ?? '添加 Codex 可读取和编辑的文件夹'}</span>
        </button>
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        <div className="project-dialog-actions">
          <button onClick={onClose} type="button">取消</button>
          <button disabled={isSubmitting} type="submit">{isSubmitting ? '创建中…' : '创建项目'}</button>
        </div>
      </form>
    </div>
  );
}
