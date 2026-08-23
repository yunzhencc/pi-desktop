import type { WorkspaceSnapshot, WorkspaceSummary } from '@shared/types';
import type { SVGProps } from 'react';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { Fragment, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { CreateProjectDialog } from '../project/create';
import { ProjectItem } from '../project/item';
import { SessionItem } from '../session/item';
import './style.css';

type PiSessionSummary = Awaited<ReturnType<Window['piApp']['sessions']['list']>>[number];

interface SessionEntry {
  session: PiSessionSummary;
  workspacePath: string;
}

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
  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProject, setEditingProject] = useState<WorkspaceSummary>();

  useEffect(() => {
    void window.piApp.workspaces.get().then(setWorkspace);
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

  useEffect(() => window.piApp.composer.onUpdate((update) => {
    if (update.type === 'session') {
      window.dispatchEvent(new Event('sessions-changed'));
      return;
    }
    if (update.type !== 'status' || !update.sessionPath)
      return;
    setRunningSessionPath(current => update.status === 'running' ? update.sessionPath : current === update.sessionPath ? undefined : current);
  }), []);

  useEffect(() => {
    if (!workspace)
      return;
    let active = true;
    let refreshVersion = 0;
    const refresh = () => {
      const version = ++refreshVersion;
      return Promise.all(workspace.workspaces.map(async item => [item.path, await window.piApp.sessions.list(item.path)] as const)).then((entries) => {
        if (active && version === refreshVersion)
          setSessionsByWorkspace(Object.fromEntries(entries));
      }).catch(() => {
        if (active && version === refreshVersion)
          setSessionsByWorkspace({});
      });
    };
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
    const { session, workspace } = await window.piApp.sessions.open(workspacePath, sessionPath);
    update(workspace);
    setSelectedSessionPath(sessionPath);
    window.dispatchEvent(new CustomEvent('session-changed', { detail: session }));
  };

  const startProjectConversation = async (workspacePath: string) => {
    const current = workspace;
    if (!current)
      return;
    try {
      update(await window.piApp.workspaces.select(workspacePath));
      setSelectedSessionPath(undefined);
      window.dispatchEvent(new Event('new-conversation'));
    }
    catch {
      update(current);
    }
  };

  const setSessionPinned = async (workspacePath: string, sessionPath: string, pinned: boolean) => {
    const current = workspace;
    if (!current)
      return;
    const paths = (current.pinnedSessionPaths ?? []).filter(path => path !== sessionPath);
    if (pinned)
      paths.push(sessionPath);
    update({ ...current, pinnedSessionPaths: paths });
    try {
      update(await window.piApp.sessions.setPinned(workspacePath, sessionPath, pinned));
    }
    catch {
      update(current);
    }
  };

  const setWorkspacePinned = async (workspacePath: string, pinned: boolean) => {
    const current = workspace;
    if (!current)
      return;
    const paths = (current.pinnedWorkspacePaths ?? []).filter(path => path !== workspacePath);
    if (pinned)
      paths.push(workspacePath);
    update({ ...current, pinnedWorkspacePaths: paths });
    try {
      update(await window.piApp.workspaces.setPinned(workspacePath, pinned));
    }
    catch {
      update(current);
    }
  };
  const sessionEntries: SessionEntry[] = workspace?.workspaces.flatMap(item => (sessionsByWorkspace[item.path] ?? []).map(session => ({ session, workspacePath: item.path }))) ?? [];
  const sessionByPath = new Map(sessionEntries.map(entry => [entry.session.path, entry]));
  const pinnedSessions = (workspace?.pinnedSessionPaths ?? []).flatMap(path => sessionByPath.get(path) ?? []);
  const pinnedPaths = new Set(pinnedSessions.map(entry => entry.session.path));
  const workspaceByPath = new Map(workspace?.workspaces.map(item => [item.path, item]));
  const pinnedWorkspaces = (workspace?.pinnedWorkspacePaths ?? []).flatMap(path => workspaceByPath.get(path) ?? []);
  const pinnedWorkspacePathSet = new Set(pinnedWorkspaces.map(workspace => workspace.path));

  const renderProject = (item: WorkspaceSummary, isPinned: boolean) => {
    const collapsed = collapsedSessionPaths[item.path] ?? false;
    const sessionListId = `workspace-sessions-${item.path}`;
    const sessions = sessionsByWorkspace[item.path] ?? [];
    const isRunning = sessionsByWorkspace[item.path] === undefined;

    return (
      <Fragment key={item.path}>
        <ProjectItem
          collapsed={collapsed}
          isPinned={isPinned}
          onToggleCollapsed={() => setCollapsedSessionPaths(paths => ({ ...paths, [item.path]: !paths[item.path] }))}
          onTogglePin={() => void setWorkspacePinned(item.path, !isPinned)}
          onEdit={() => setEditingProject(item)}
          onNewConversation={() => void startProjectConversation(item.path)}
          onOpenSource={() => void window.piApp.workspaces.openDirectory(item.path)}
          isRunning={isRunning}
        >
          {item.displayName}
        </ProjectItem>
        {!collapsed && (
          <div id={sessionListId}>
            {sessions.filter(session => isPinned || !pinnedPaths.has(session.path)).map((session) => {
              const sessionIsPinned = pinnedPaths.has(session.path);
              return (
                <SessionRow
                  isPinned={sessionIsPinned}
                  isRunning={session.path === runningSessionPath}
                  isSelected={session.path === selectedSessionPath}
                  key={session.path}
                  onOpen={() => void openSession(item.path, session.path)}
                  onTogglePin={() => void setSessionPinned(item.path, session.path, !sessionIsPinned)}
                  projectName={item.displayName}
                  session={session}
                />
              );
            })}
          </div>
        )}
      </Fragment>

    );
  };
  const hasPinnedItems = pinnedWorkspaces.length > 0 || pinnedSessions.length > 0;

  return (
    <nav aria-label={formatMessage({ id: 'projects.title' })} className="workspace-sidebar mx-2 my-4 min-h-0 flex-1 overflow-auto">
      {hasPinnedItems && (
        <>
          <div className="workspace-sidebar-heading group/sidebar-heading flex h-7 items-center gap-1 px-2 text-[13px] text-text-tertiary">
            <button aria-expanded={!isPinnedCollapsed} className="group/sidebar-toggle flex min-w-0 flex-1 items-center gap-1 rounded-md py-0.5 text-left" onClick={() => setIsPinnedCollapsed(collapsed => !collapsed)} type="button">
              <span className="min-w-0 truncate">{formatMessage({ id: 'projects.pin' })}</span>
              <CodexChevron
                aria-hidden="true"
                className={cn(
                  'size-3 shrink-0 opacity-0 transition-[transform,opacity] duration-150 group-hover/sidebar-toggle:opacity-100 group-focus-visible/sidebar-toggle:opacity-100',
                  isPinnedCollapsed && '-rotate-90 opacity-100',
                )}
              />
            </button>
          </div>
          {!isPinnedCollapsed && (
            <div className="workspace-sidebar-pinned-list mb-2">
              {pinnedWorkspaces.map(item => renderProject(item, true))}
              {pinnedSessions.filter(entry => !pinnedWorkspacePathSet.has(entry.workspacePath)).map(({ session, workspacePath }) => (
                <SessionRow
                  isPinned
                  isRunning={session.path === runningSessionPath}
                  isSelected={session.path === selectedSessionPath}
                  key={session.path}
                  onOpen={() => void openSession(workspacePath, session.path)}
                  onTogglePin={() => void setSessionPinned(workspacePath, session.path, false)}
                  projectName={workspaceByPath.get(workspacePath)?.displayName}
                  session={session}
                />
              ))}
            </div>
          )}
        </>
      )}
      <div className="workspace-sidebar-heading group/sidebar-heading flex h-7 items-center gap-1 px-2 text-[13px] text-text-tertiary">
        <button aria-expanded={!isCollapsed} className="group/sidebar-toggle flex min-w-0 flex-1 items-center gap-1 rounded-md py-0.5 text-left" onClick={() => setIsCollapsed(collapsed => !collapsed)} type="button">
          <span className="min-w-0 truncate">{formatMessage({ id: 'projects.title' })}</span>
          <CodexChevron
            aria-hidden="true"
            className={cn(
              'size-3 shrink-0 opacity-0 transition-[transform,opacity] duration-150 group-hover/sidebar-toggle:opacity-100 group-focus-visible/sidebar-toggle:opacity-100',
              isCollapsed && '-rotate-90 opacity-100',
            )}
          />
        </button>
        <button
          aria-label={formatMessage({ id: 'projects.add' })}
          className="workspace-sidebar-create pointer-events-none grid size-6 place-items-center rounded-md text-text-tertiary opacity-0 transition-opacity duration-150 group-hover/sidebar-heading:pointer-events-auto group-hover/sidebar-heading:opacity-100 group-focus-within/sidebar-heading:pointer-events-auto group-focus-within/sidebar-heading:opacity-100 hover:text-foreground focus-visible:text-foreground [&_svg]:size-3.5"
          onClick={() => setIsCreating(true)}
          title={formatMessage({ id: 'projects.add' })}
          type="button"
        >
          <CodexPlus aria-hidden="true" />
        </button>
      </div>
      {!isCollapsed && (
        <div className="workspace-sidebar-list">
          {workspace?.workspaces.filter(item => !pinnedWorkspacePathSet.has(item.path)).map(item => renderProject(item, false))}
        </div>
      )}
      {isCreating && <CreateProjectDialog onClose={() => setIsCreating(false)} onCreated={update} />}
      {editingProject && <CreateProjectDialog onClose={() => setEditingProject(undefined)} onCreated={update} project={editingProject} />}
    </nav>
  );
}

function SessionRow({ isPinned, isRunning, isSelected, onOpen, onTogglePin, projectName, session }: {
  isPinned: boolean;
  isRunning: boolean;
  isSelected: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  projectName?: string;
  session: PiSessionSummary;
}) {
  const { formatMessage } = useIntl();
  const title = session.firstMessage || formatMessage({ id: 'conversation.new' });

  return (
    <>
      <SessionItem
        isRunning={isRunning}
        isSelected={isSelected}
        isPinned={isPinned}
        onClick={onOpen}
        onTogglePin={onTogglePin}
        modifiedAt={session.modifiedAt}
        projectName={projectName}
      >
        {title}
      </SessionItem>
    </>
  );
}

function CodexChevron(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" height="21" viewBox="0 0 20 21" width="20" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M15.2793 7.71101C15.539 7.45131 15.961 7.45131 16.2207 7.71101C16.4804 7.97071 16.4804 8.39272 16.2207 8.65242L10.4707 14.4024C10.211 14.6621 9.78902 14.6621 9.52932 14.4024L3.77932 8.65242L3.69436 8.54792C3.52385 8.28979 3.55205 7.93828 3.77932 7.71101C4.00659 7.48374 4.3581 7.45554 4.61623 7.62605L4.72073 7.71101L10 12.9903L15.2793 7.71101Z" fill="currentColor" stroke="currentColor" strokeWidth=".6" />
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
