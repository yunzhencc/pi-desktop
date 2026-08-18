import { useHotkey } from '@tanstack/react-hotkeys';
import { useEffect, useState } from 'react';
import {
  readRightPanelWidth,
  writeRightPanelWidth,
} from './components/right-panel';
import { RightPanelResizeHandle } from './components/right-panel-resize-handle';
import {
  readSidebarWidth,
} from './components/sidebar-resize';
import { SidebarResizeHandle } from './components/sidebar-resize-handle';
import { SidebarToggle } from './components/sidebar-toggle';
import { getToolbarInset } from './components/toolbar-inset';

const RIGHT_PANEL_WIDTH_STORAGE_KEY = 'app-shell:right-panel-width:v3';
const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-width';

export function App() {
  const isMac = navigator.platform.includes('Mac');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
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
  const [rightPanelWidthRatio, setRightPanelWidthRatio] = useState(() => {
    const width = readRightPanelWidth(
      localStorage.getItem(RIGHT_PANEL_WIDTH_STORAGE_KEY),
      initialMainContentWidth,
      viewportSize.height,
    );
    return writeRightPanelWidth(width, initialMainContentWidth);
  });

  const toolbarInset = getToolbarInset({ isFullscreen, isMac });
  const toggleSidebar = () => setIsSidebarVisible(visible => !visible);
  const mainContentWidth = viewportSize.width - (isSidebarVisible ? sidebarWidth : 0);
  const rightPanelWidth = readRightPanelWidth(
    String(rightPanelWidthRatio),
    mainContentWidth,
    viewportSize.height,
  );
  const updateRightPanelWidth = (width: number) => {
    setRightPanelWidthRatio(writeRightPanelWidth(width, mainContentWidth));
  };
  const toggleRightPanel = () => setIsRightPanelOpen(open => !open);
  useHotkey('Mod+B', toggleSidebar, { ignoreInputs: false, preventDefault: true, stopPropagation: false });

  useEffect(() => {
    window.api.windowControls.getIsFullscreen().then(setIsFullscreen);
    return window.api.windowControls.onFullscreenChange(setIsFullscreen);
  }, []);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ height: window.innerHeight, width: window.innerWidth });
    };

    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  return (
    <div className="relative flex h-svh min-h-0 overflow-hidden bg-transparent">
      <header
        className={`app-shell-header draggable absolute inset-x-0 top-0 z-30 flex h-[46px]${!isSidebarVisible && !isRightPanelOpen ? ' app-shell-header--both-panels-closed' : ''}`}
      >
        <div
          className="app-shell-toolbar app-shell-header-left flex shrink-0 items-center"
          style={{
            paddingInlineStart: toolbarInset,
            width: isSidebarVisible ? sidebarWidth : toolbarInset + 32,
          }}
        >
          <SidebarToggle isSidebarVisible={isSidebarVisible} onToggle={toggleSidebar} />
        </div>
        <div className="app-shell-header-main min-w-0 flex-1" />
        <div
          className="app-shell-toolbar app-shell-header-right flex shrink-0 items-center justify-end"
          style={{
            width: isRightPanelOpen ? rightPanelWidth : 40,
          }}
        >
          <button
            aria-expanded={isRightPanelOpen}
            aria-label={isRightPanelOpen ? 'Hide right panel' : 'Show right panel'}
            className="sidebar-trigger flex size-8 items-center justify-center"
            onClick={toggleRightPanel}
            title="Toggle right panel"
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
        className="app-shell-left-panel relative shrink-0"
        data-open={isSidebarVisible}
        style={{
          width: isSidebarVisible ? sidebarWidth : 0,
        }}
      >
        {isSidebarVisible && (
          <SidebarResizeHandle
            onCollapse={() => setIsSidebarVisible(false)}
            onResizeEnd={width => localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))}
            onWidthChange={setSidebarWidth}
            width={sidebarWidth}
          />
        )}
      </aside>
      <main className="app-shell-main-surface min-w-0" />
      <aside
        className="app-shell-right-panel relative shrink-0"
        data-open={isRightPanelOpen}
        style={{
          width: isRightPanelOpen ? rightPanelWidth : 0,
        }}
      >
        {isRightPanelOpen && (
          <RightPanelResizeHandle
            mainContentWidth={mainContentWidth}
            onClose={() => setIsRightPanelOpen(false)}
            onResizeEnd={(width) => {
              localStorage.setItem(
                RIGHT_PANEL_WIDTH_STORAGE_KEY,
                String(writeRightPanelWidth(width, mainContentWidth)),
              );
            }}
            onWidthChange={updateRightPanelWidth}
            shellHeight={viewportSize.height}
            width={rightPanelWidth}
          />
        )}
      </aside>
    </div>
  );
}
