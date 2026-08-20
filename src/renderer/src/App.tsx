import type { WorkspaceSnapshot } from '../../main/workspaces';
import type { AppHistory, AppLocation } from './components/app-history';
import { useHotkeys } from '@tanstack/react-hotkeys';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  canGoBack,
  canGoForward,
  createAppHistory,
  currentAppLocation,
  moveAppHistory,
  pushAppHistory,
} from './components/app-history';
import {
  getExpandedRightPanelWidth,
  getRightPanelExpansionAfterToggle,
  getRightPanelHeaderWidth,
  getRightPanelWidthMode,
  readRightPanelWidth,
  writeRightPanelWidth,
} from './components/right-panel';
import { RightPanelResizeHandle } from './components/right-panel-resize-handle';
import { SettingsSidebar } from './components/settings-view';
import { Footer } from './components/sidebar';
import {
  readSidebarWidth,
} from './components/sidebar-resize';
import { SidebarResizeHandle } from './components/sidebar-resize-handle';
import { SidebarToggle } from './components/sidebar-toggle';
import { getToolbarInset } from './components/toolbar-inset';
import { WorkspaceSidebar } from './components/workspace-sidebar';
import { ShortcutSettingsProvider, useShortcutSettings } from './shortcuts/shortcut-context';

const RIGHT_PANEL_WIDTH_STORAGE_KEY = 'app-shell:right-panel-width:v3';
const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-width';

export function App() {
  return <ShortcutSettingsProvider><AppShell /></ShortcutSettingsProvider>;
}

function AppShell() {
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
  const [appHistory, setAppHistory] = useState(historyRef.current);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return readSidebarWidth(
      localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
      window.innerWidth,
    );
  });
  const [viewportSize, setViewportSize] = useState(() => ({
    height: window.innerHeight,
    width: window.innerWidth,
  }));
  const initialMainContentWidth = viewportSize.width - sidebarWidth;
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [rightPanelWidthRatio, setRightPanelWidthRatio] = useState(() => {
    const width = readRightPanelWidth(
      localStorage.getItem(RIGHT_PANEL_WIDTH_STORAGE_KEY),
      initialMainContentWidth,
      viewportSize.height,
    );
    return writeRightPanelWidth(width, initialMainContentWidth);
  });

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
      const { session, workspace } = await window.api.sessions.open(location.workspacePath, location.sessionPath);
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
  const openSettings = () => void visitLocation({ kind: 'settings', path: '/settings/general' });
  const toggleCurrentSessionPin = () => {
    const location = currentAppLocation(historyRef.current);
    if (location.kind !== 'session')
      return;

    void window.api.workspaces.get()
      .then(workspace => window.api.sessions.setPinned(
        location.workspacePath,
        location.sessionPath,
        !(workspace.pinnedSessionPaths ?? []).includes(location.sessionPath),
      ))
      .then(workspace => window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: workspace })))
      .catch(() => {});
  };
  const headerLeftWidth = isSidebarVisible ? sidebarWidth : toolbarInset + 96;
  const mainContentWidth = viewportSize.width - (isSidebarVisible ? sidebarWidth : 0);
  const rightPanelWidth = readRightPanelWidth(
    String(rightPanelWidthRatio),
    mainContentWidth,
    viewportSize.height,
  );
  const displayedRightPanelWidth = isRightPanelExpanded
    ? getExpandedRightPanelWidth(mainContentWidth)
    : rightPanelWidth;
  const rightPanelWidthMode = getRightPanelWidthMode(isRightPanelExpanded);
  const headerRightWidth = getRightPanelHeaderWidth(
    isRightPanelExpanded,
    displayedRightPanelWidth,
    viewportSize.width,
    headerLeftWidth,
  );
  const updateRightPanelWidth = (width: number) => {
    setRightPanelWidthRatio(writeRightPanelWidth(width, mainContentWidth));
  };
  const toggleRightPanel = () => {
    setIsRightPanelExpanded(getRightPanelExpansionAfterToggle(isRightPanelOpen, isRightPanelExpanded));
    setIsRightPanelOpen(open => !open);
  };
  const toggleRightPanelExpanded = () => setIsRightPanelExpanded(expanded => !expanded);
  useHotkeys(
    [
      ...bindings.newConversation.map(hotkey => ({ callback: startNewConversation, hotkey })),
      ...bindings.toggleSidebar.map(hotkey => ({ callback: toggleSidebar, hotkey })),
      ...bindings.openSettings.map(hotkey => ({ callback: openSettings, hotkey })),
      ...bindings.toggleSessionPin.map(hotkey => ({ callback: toggleCurrentSessionPin, hotkey })),
      { callback: () => void navigateHistory(-1), hotkey: 'Mod+[' },
      { callback: () => void navigateHistory(1), hotkey: 'Mod+]' },
    ],
    { ignoreInputs: true, preventDefault: true, stopPropagation: false },
  );

  useEffect(() => {
    window.api.windowControls.getIsFullscreen().then(setIsFullscreen);
    return window.api.windowControls.onFullscreenChange(setIsFullscreen);
  }, []);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const stopListening = window.api.windowControls.onOpaqueSurfaceChange((opaque) => {
      receivedChange = true;
      setIsWindowOpaque(opaque);
    });

    window.api.windowControls.getIsOpaqueSurface().then((opaque) => {
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
    const updateViewportSize = () => {
      setViewportSize({ height: window.innerHeight, width: window.innerWidth });
    };

    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  return (
    <div className="app-shell relative flex h-svh min-h-0 overflow-hidden bg-transparent" data-resizing={isResizing}>
      <header className="app-shell-header draggable absolute inset-x-0 top-0 z-30 flex h-[46px]">
        <div
          className="app-shell-toolbar app-shell-header-left flex shrink-0 items-center"
          style={{
            paddingInlineStart: toolbarInset,
            width: headerLeftWidth,
          }}
        >
          {!isSettingsPage && <SidebarToggle isSidebarVisible={isSidebarVisible} onToggle={toggleSidebar} />}
          <button
            aria-label={formatMessage({ id: 'navigation.back' })}
            className="sidebar-trigger flex size-8 items-center justify-center disabled:pointer-events-none disabled:opacity-35"
            disabled={!canGoBack(appHistory)}
            onClick={() => void navigateHistory(-1)}
            title={formatMessage({ id: 'navigation.back' })}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={formatMessage({ id: 'navigation.forward' })}
            className="sidebar-trigger flex size-8 items-center justify-center disabled:pointer-events-none disabled:opacity-35"
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
          className="app-shell-toolbar app-shell-header-right flex shrink-0 items-center justify-end"
          style={{
            width: isRightPanelOpen ? headerRightWidth : 40,
          }}
        >
          {isRightPanelOpen && (
            <button
              aria-label={formatMessage({ id: isRightPanelExpanded ? 'panel.restore' : 'panel.expand' })}
              aria-pressed={isRightPanelExpanded}
              className="right-panel-expand-trigger sidebar-trigger flex size-8 items-center justify-center"
              onClick={toggleRightPanelExpanded}
              title={formatMessage({ id: isRightPanelExpanded ? 'panel.restore' : 'panel.expand' })}
              type="button"
            >
              {isRightPanelExpanded
                ? (
                    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
                      <path d="M6.1664 8.80845C6.7325 8.80845 7.1918 9.26774 7.1918 9.83384V13.3338C7.19155 13.6236 6.9562 13.8592 6.6664 13.8592C6.37672 13.8591 6.14126 13.6235 6.14101 13.3338V10.5936L2.70547 14.0379C2.50071 14.243 2.16753 14.2435 1.9623 14.0389C1.75709 13.8342 1.75665 13.501 1.96133 13.2957L5.39101 9.85923H2.6664C2.37672 9.85909 2.14126 9.6235 2.14101 9.33384C2.14101 9.04397 2.37657 8.80858 2.6664 8.80845H6.1664Z" fill="currentColor" />
                      <path d="M13.2943 1.96274C13.4989 1.75743 13.8311 1.75731 14.0365 1.96177C14.2419 2.16637 14.243 2.49854 14.0385 2.70395L10.6127 6.14145H13.3334C13.6233 6.14145 13.8588 6.37689 13.8588 6.66684C13.8587 6.95674 13.6233 7.19223 13.3334 7.19223H9.8334C9.26734 7.19223 8.80807 6.73288 8.80801 6.16684V2.66684C8.80801 2.37689 9.04345 2.14145 9.3334 2.14145C9.62335 2.14145 9.85879 2.37689 9.85879 2.66684V5.41098L13.2943 1.96274Z" fill="currentColor" />
                    </svg>
                  )
                : (
                    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
                      <path d="M4.33496 11C4.33496 10.6327 4.63273 10.335 5 10.335C5.36727 10.335 5.66504 10.6327 5.66504 11V14.335H9L9.13379 14.3486C9.43692 14.4106 9.66504 14.6786 9.66504 15C9.66504 15.3214 9.43692 15.5894 9.13379 15.6514L9 15.665H5C4.63273 15.665 4.33496 15.3673 4.33496 15V11ZM14.335 9V5.66504H11C10.6327 5.66504 10.335 5.36727 10.335 5C10.335 4.63273 10.6327 4.33496 11 4.33496H15L15.1338 4.34863C15.4369 4.41057 15.665 4.67857 15.665 5V9C15.665 9.36727 15.3673 9.66504 15 9.66504C14.6327 9.66504 14.335 9.36727 14.335 9Z" fill="currentColor" />
                    </svg>
                  )}
            </button>
          )}
          <button
            aria-expanded={isRightPanelOpen}
            aria-label={formatMessage({ id: isRightPanelOpen ? 'panel.hide' : 'panel.show' })}
            className="sidebar-trigger flex size-8 items-center justify-center"
            onClick={toggleRightPanel}
            title={formatMessage({ id: 'panel.toggle' })}
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
                    <div className="sidebar-new-conversation">
                      <button aria-keyshortcuts="Meta+N Control+N Meta+Shift+O Control+Shift+O" className="sidebar-new-conversation__main" onClick={startNewConversation} type="button">
                        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
                          <path d="M6.33325 1.80763C6.62314 1.80763 6.85855 2.04315 6.85864 2.33302C6.85864 2.62297 6.6232 2.85841 6.33325 2.85841H4.66626C3.66786 2.85859 2.85891 3.66765 2.85864 4.66603V11.333C2.85864 12.3316 3.66769 13.1414 4.66626 13.1416H11.3333C12.332 13.1416 13.1418 12.3317 13.1418 11.333V9.66603C13.1421 9.37642 13.3766 9.14179 13.6663 9.14161C13.956 9.14161 14.1914 9.37631 14.1917 9.66603V11.333C14.1917 12.9116 12.9119 14.1914 11.3333 14.1914H4.66626C3.0878 14.1912 1.80786 12.9115 1.80786 11.333V4.66603C1.80813 3.08775 3.08796 1.80781 4.66626 1.80763H6.33325Z" fill="currentColor" />
                          <path clipRule="evenodd" d="M10.842 2.32228C11.6259 1.55049 12.8863 1.55435 13.6643 2.33204C14.4442 3.11205 14.4469 4.37706 13.6702 5.16017L9.41626 9.4463C9.05652 9.80879 8.59956 10.0601 8.10083 10.1699L6.19263 10.5899C5.7111 10.6958 5.28165 10.2666 5.38794 9.78517L5.80884 7.88185C5.9196 7.38036 6.17342 6.92096 6.53931 6.56056L10.842 2.32228ZM12.9221 3.07521C12.552 2.7051 11.9524 2.70322 11.5793 3.07033L7.27563 7.30861C7.05429 7.52663 6.90125 7.80504 6.83423 8.10841L6.54028 9.43849L7.87524 9.14454C8.17687 9.07807 8.45355 8.92625 8.67114 8.70704L12.9241 4.41993C13.2934 4.04741 13.2928 3.44631 12.9221 3.07521Z" fill="currentColor" fillRule="evenodd" />
                        </svg>
                        {formatMessage({ id: 'conversation.new' })}
                      </button>
                      <button aria-label={formatMessage({ id: 'conversation.quick' })} className="sidebar-new-conversation__quick" onClick={startNewConversation} title={formatMessage({ id: 'conversation.quick' })} type="button">
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
      <main className="app-shell-main-surface min-w-0"><Outlet /></main>
      <aside
        className="app-shell-right-panel relative shrink-0"
        data-open={isRightPanelOpen}
        data-width-mode={rightPanelWidthMode}
        style={{
          width: isRightPanelOpen ? displayedRightPanelWidth : 0,
        }}
      >
        {isRightPanelOpen && !isRightPanelExpanded && (
          <RightPanelResizeHandle
            mainContentWidth={mainContentWidth}
            onClose={() => setIsRightPanelOpen(false)}
            onResizeEnd={(width) => {
              localStorage.setItem(
                RIGHT_PANEL_WIDTH_STORAGE_KEY,
                String(writeRightPanelWidth(width, mainContentWidth)),
              );
            }}
            onResizingChange={setIsResizing}
            onWidthChange={updateRightPanelWidth}
            shellHeight={viewportSize.height}
            width={rightPanelWidth}
          />
        )}
      </aside>
    </div>
  );
}
