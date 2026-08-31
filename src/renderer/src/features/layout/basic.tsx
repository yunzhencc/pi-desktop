import type { WorkspaceSnapshot } from '@shared/types';
import type { AppHistory, AppLocation } from './utils';
import { useShortcutSettings } from '@renderer/features/app/shortcuts';
import { SettingsSidebar } from '@renderer/features/settings';
import { WorkspaceFileViewer, WorkspaceSidebar } from '@renderer/features/workspace';
import { useHotkeys } from '@tanstack/react-hotkeys';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { SidebarToggle } from './components';
import { Footer, SidebarResizeHandle } from './sidebar';
import { ToolLauncher } from './tool-launcher';
import {
  canGoBack,
  canGoForward,
  createAppHistory,
  currentAppLocation,
  getToolbarInset,
  moveAppHistory,
  pushAppHistory,
  readSidebarWidth,
} from './utils';

const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-width';
const sidebarTriggerClass = 'sidebar-trigger flex size-8 cursor-default items-center justify-center rounded-lg text-text-secondary outline-none [-webkit-app-region:no-drag] hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:text-foreground focus-visible:shadow-[0_0_0_2px_var(--focus)] disabled:pointer-events-none disabled:opacity-35';
type ToolSurface = 'closed' | 'launcher' | 'files';

export function BasicLayout() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const settingsPath = useRouterState({ select: state => state.location.pathname });
  const isSettingsPage = settingsPath.startsWith('/settings/');
  const { bindings } = useShortcutSettings();
  const isMac = navigator.platform.includes('Mac');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWindowOpaque, setIsWindowOpaque] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const historyRef = useRef<AppHistory>(createAppHistory({ kind: 'home' }));
  const navigationIdRef = useRef(0);
  const selectedWorkspacePathRef = useRef<string>();
  const [appHistory, setAppHistory] = useState(historyRef.current);
  const [filesAvailable, setFilesAvailable] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return readSidebarWidth(
      localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
      window.innerWidth,
    );
  });
  const [isResizing, setIsResizing] = useState(false);
  const [toolSurface, setToolSurface] = useState<ToolSurface>('closed');

  const toolbarInset = getToolbarInset({ isFullscreen, isMac });
  const toggleSidebar = () => {
    if (!isSettingsPage)
      setIsSidebarVisible(visible => !visible);
  };
  const commitHistory = (next: AppHistory) => {
    historyRef.current = next;
    setAppHistory(next);
  };
  const restoreLocation = async (location: AppLocation, navigationId: number) => {
    if (location.kind === 'home') {
      await Promise.resolve(navigate({ to: '/' }));
      if (navigationId !== navigationIdRef.current)
        return false;
      window.dispatchEvent(new Event('new-conversation'));
      return true;
    }
    if (location.kind === 'settings') {
      await Promise.resolve(navigate({ to: location.path }));
      return navigationId === navigationIdRef.current;
    }

    try {
      const { session, workspace } = await window.piApp.sessions.open(location.workspacePath, location.sessionPath);
      if (navigationId !== navigationIdRef.current)
        return false;
      window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: workspace }));
      window.dispatchEvent(new CustomEvent('session-changed', { detail: session }));
      return true;
    }
    catch {
      return false;
    }
  };
  const visitLocation = async (location: AppLocation) => {
    const next = pushAppHistory(historyRef.current, location);
    const navigationId = ++navigationIdRef.current;
    if (await restoreLocation(location, navigationId))
      commitHistory(next);
  };
  const navigateHistory = async (direction: -1 | 1) => {
    const next = moveAppHistory(historyRef.current, direction);
    if (next === historyRef.current)
      return;
    const navigationId = ++navigationIdRef.current;
    if (await restoreLocation(currentAppLocation(next), navigationId))
      commitHistory(next);
  };
  const startNewConversation = () => {
    void visitLocation({ kind: 'home' });
  };
  const openFiles = () => {
    if (selectedWorkspacePathRef.current)
      setToolSurface('files');
  };
  const openSettings = () => void visitLocation({ kind: 'settings', path: '/settings/general' });
  const toggleCurrentSessionPin = () => {
    const location = currentAppLocation(historyRef.current);
    if (location.kind !== 'session')
      return;

    void window.piApp.workspaces.get()
      .then(workspace => window.piApp.sessions.setPinned(
        location.workspacePath,
        location.sessionPath,
        !(workspace.pinnedSessionPaths ?? []).includes(location.sessionPath),
      ))
      .then(workspace => window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: workspace })))
      .catch(() => {});
  };
  const headerLeftWidth = isSidebarVisible ? sidebarWidth : toolbarInset + 96;
  useHotkeys(
    [
      ...bindings.newConversation.map(hotkey => ({ callback: startNewConversation, hotkey })),
      ...bindings.toggleSidebar.map(hotkey => ({ callback: toggleSidebar, hotkey })),
      ...bindings.openSettings.map(hotkey => ({ callback: openSettings, hotkey })),
      ...bindings.openFiles.map(hotkey => ({ callback: openFiles, hotkey })),
      ...bindings.toggleSessionPin.map(hotkey => ({ callback: toggleCurrentSessionPin, hotkey })),
      ...bindings.goBack.map(hotkey => ({ callback: () => void navigateHistory(-1), hotkey })),
      ...bindings.goForward.map(hotkey => ({ callback: () => void navigateHistory(1), hotkey })),
    ],
    { ignoreInputs: true, preventDefault: true, stopPropagation: false },
  );

  useEffect(() => {
    window.piApp.windowControls.getIsFullscreen().then(setIsFullscreen);
    return window.piApp.windowControls.onFullscreenChange(setIsFullscreen);
  }, []);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const stopListening = window.piApp.windowControls.onOpaqueSurfaceChange((opaque) => {
      receivedChange = true;
      setIsWindowOpaque(opaque);
    });

    window.piApp.windowControls.getIsOpaqueSurface().then((opaque) => {
      if (active && !receivedChange)
        setIsWindowOpaque(opaque);
    });

    return () => {
      active = false;
      stopListening();
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('electron-opaque', isWindowOpaque);
    return () => document.documentElement.classList.remove('electron-opaque');
  }, [isWindowOpaque]);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const updateWorkspace = (workspace: WorkspaceSnapshot) => {
      selectedWorkspacePathRef.current = workspace.selectedWorkspacePath;
      setFilesAvailable(Boolean(workspace.selectedWorkspacePath));
    };
    const onWorkspaceChanged = (event: Event) => {
      receivedChange = true;
      updateWorkspace((event as CustomEvent<WorkspaceSnapshot>).detail);
    };

    window.addEventListener('workspace-changed', onWorkspaceChanged);
    void window.piApp.workspaces.get().then((workspace) => {
      if (active && !receivedChange)
        updateWorkspace(workspace);
    }).catch(() => {});

    return () => {
      active = false;
      window.removeEventListener('workspace-changed', onWorkspaceChanged);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== 'Escape'
        || target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)
        || toolSurface === 'closed'
      ) {
        return;
      }

      event.preventDefault();
      setToolSurface(toolSurface === 'files' ? 'launcher' : 'closed');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toolSurface]);

  return (
    <div className="app-shell relative flex h-svh min-h-0 overflow-hidden bg-transparent" data-resizing={isResizing}>
      <header className="draggable absolute inset-x-0 top-0 z-30 flex h-11.5">
        <div
          className="app-shell-header-left flex shrink-0 items-center px-4 pe-0 transition-[width] duration-500 ease-[cubic-bezier(0.34,1.1,0.64,1)] motion-reduce:transition-none"
          style={{
            paddingInlineStart: toolbarInset,
            width: headerLeftWidth,
          }}
        >
          {!isSettingsPage && <SidebarToggle isSidebarVisible={isSidebarVisible} onToggle={toggleSidebar} />}
          <button
            aria-label={formatMessage({ id: 'navigation.back' })}
            className={sidebarTriggerClass}
            disabled={!canGoBack(appHistory)}
            onClick={() => void navigateHistory(-1)}
            title={formatMessage({ id: 'navigation.back' })}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={formatMessage({ id: 'navigation.forward' })}
            className={sidebarTriggerClass}
            disabled={!canGoForward(appHistory)}
            onClick={() => void navigateHistory(1)}
            title={formatMessage({ id: 'navigation.forward' })}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="min-w-0 flex-1" />
        <div
          className="app-shell-header-right flex w-10 shrink-0 items-center justify-end pe-2"
        >
          <button
            aria-expanded={toolSurface === 'launcher'}
            aria-label={formatMessage({ id: toolSurface === 'launcher' ? 'toolLauncher.hide' : 'toolLauncher.show' })}
            className={sidebarTriggerClass}
            onClick={() => setToolSurface(current => current === 'launcher' ? 'closed' : 'launcher')}
            title={formatMessage({ id: toolSurface === 'launcher' ? 'toolLauncher.hide' : 'toolLauncher.show' })}
            type="button"
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
              <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.5" width="14" x="3" y="3" />
              <path d="M12 3v14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </header>
      <aside
        className="app-shell-left-panel relative flex shrink-0 flex-col"
        data-open={isSidebarVisible}
        style={{
          width: isSidebarVisible ? sidebarWidth : 0,
        }}
      >
        {isSidebarVisible && (
          <>
            {!isSettingsPage && (
              <SidebarResizeHandle
                onCollapse={() => setIsSidebarVisible(false)}
                onResizeEnd={width => localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))}
                onResizingChange={setIsResizing}
                onWidthChange={setSidebarWidth}
                width={sidebarWidth}
              />
            )}
            {isSettingsPage
              ? (
                  <SettingsSidebar
                    activePath={settingsPath}
                    onClose={startNewConversation}
                    onNavigate={to => void visitLocation({ kind: 'settings', path: to })}
                  />
                )
              : (
                  <>
                    <div className="mx-2 mt-[54px] flex h-[31px] items-center gap-2 rounded-[10px] px-2 hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]">
                      <button aria-keyshortcuts="Meta+N Control+N Meta+Shift+O Control+Shift+O" className="flex h-[31px] flex-1 items-center gap-2 text-left text-sm leading-[21px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus)]" onClick={startNewConversation} type="button">
                        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
                          <path d="M6.33325 1.80763C6.62314 1.80763 6.85855 2.04315 6.85864 2.33302C6.85864 2.62297 6.6232 2.85841 6.33325 2.85841H4.66626C3.66786 2.85859 2.85891 3.66765 2.85864 4.66603V11.333C2.85864 12.3316 3.66769 13.1414 4.66626 13.1416H11.3333C12.332 13.1416 13.1418 12.3317 13.1418 11.333V9.66603C13.1421 9.37642 13.3766 9.14179 13.6663 9.14161C13.956 9.14161 14.1914 9.37631 14.1917 9.66603V11.333C14.1917 12.9116 12.9119 14.1914 11.3333 14.1914H4.66626C3.0878 14.1912 1.80786 12.9115 1.80786 11.333V4.66603C1.80813 3.08775 3.08796 1.80781 4.66626 1.80763H6.33325Z" fill="currentColor" />
                          <path clipRule="evenodd" d="M10.842 2.32228C11.6259 1.55049 12.8863 1.55435 13.6643 2.33204C14.4442 3.11205 14.4469 4.37706 13.6702 5.16017L9.41626 9.4463C9.05652 9.80879 8.59956 10.0601 8.10083 10.1699L6.19263 10.5899C5.7111 10.6958 5.28165 10.2666 5.38794 9.78517L5.80884 7.88185C5.9196 7.38036 6.17342 6.92096 6.53931 6.56056L10.842 2.32228ZM12.9221 3.07521C12.552 2.7051 11.9524 2.70322 11.5793 3.07033L7.27563 7.30861C7.05429 7.52663 6.90125 7.80504 6.83423 8.10841L6.54028 9.43849L7.87524 9.14454C8.17687 9.07807 8.45355 8.92625 8.67114 8.70704L12.9241 4.41993C13.2934 4.04741 13.2928 3.44631 12.9221 3.07521Z" fill="currentColor" fillRule="evenodd" />
                        </svg>
                        {formatMessage({ id: 'conversation.new' })}
                      </button>
                      <button aria-label={formatMessage({ id: 'conversation.quick' })} className="flex size-6 items-center justify-center rounded-lg p-1 text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus)]" onClick={startNewConversation} title={formatMessage({ id: 'conversation.quick' })} type="button">
                        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
                          <path d="M7.9834 5.3042C8.27312 5.30446 8.50879 5.5398 8.50879 5.82959V7.479H10.1582C10.4482 7.479 10.6836 7.71445 10.6836 8.00439C10.6836 8.29434 10.4482 8.52979 10.1582 8.52979H8.50879V10.1802C8.50853 10.4697 8.27296 10.7053 7.9834 10.7056C7.69361 10.7056 7.45827 10.4699 7.45801 10.1802V8.52979H5.80762C5.51767 8.52979 5.28223 8.29434 5.28223 8.00439C5.28223 7.71445 5.51767 7.479 5.80762 7.479H7.45801V5.82959C7.45801 5.53964 7.69345 5.3042 7.9834 5.3042Z" fill="currentColor" />
                          <path clipRule="evenodd" d="M8 1.80811C11.575 1.80811 14.5254 4.55306 14.5254 8.00049C14.5252 11.4478 11.5749 14.1919 8 14.1919C6.78477 14.1919 5.75932 13.8294 4.75488 13.3599L2.9873 13.8188C2.5113 13.9421 2.07317 13.5186 2.17969 13.0386L2.5498 11.3638C2.03641 10.3602 1.4747 9.38219 1.47461 8.00049C1.47461 4.55306 4.42502 1.80811 8 1.80811ZM8 2.85889C4.94756 2.85889 2.52539 5.18869 2.52539 8.00049C2.52548 9.13389 2.98018 9.88342 3.55176 11.0151C3.62017 11.1507 3.63938 11.3062 3.60645 11.4546L3.34277 12.6411L4.62598 12.3091L4.74023 12.2896C4.81669 12.2837 4.89333 12.2917 4.9668 12.312L5.0752 12.3521L5.44238 12.522C6.29248 12.8997 7.09158 13.1421 8 13.1421C11.0523 13.1421 13.4744 10.8121 13.4746 8.00049C13.4746 5.18869 11.0524 2.85889 8 2.85889Z" fill="currentColor" fillRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <WorkspaceSidebar onOpenSession={(workspacePath, sessionPath) => void visitLocation({ kind: 'session', sessionPath, workspacePath })} />

                    <Footer />
                  </>
                )}
          </>
        )}
      </aside>
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className={`min-w-0 ${toolSurface === 'files' ? 'min-w-72 flex-1 border-e border-border' : 'flex-1'}`}>
            <Outlet />
          </div>
          <div className="min-h-0 min-w-0 flex-[2]" hidden={toolSurface !== 'files'}>
            <WorkspaceFileViewer onClose={() => setToolSurface('launcher')} />
          </div>
        </div>
        {toolSurface === 'launcher' && (
          <div className="absolute inset-0 z-20">
            <ToolLauncher filesAvailable={filesAvailable} onOpenFiles={openFiles} />
          </div>
        )}
      </main>
    </div>
  );
}
