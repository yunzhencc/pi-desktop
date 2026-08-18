import { useHotkey } from '@tanstack/react-hotkeys';
import { useEffect, useState } from 'react';
import {
  getExpandedRightPanelWidth,
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
  const toggleSidebar = () => setIsSidebarVisible(visible => !visible);
  const mainContentWidth = viewportSize.width - (isSidebarVisible ? sidebarWidth : 0);
  const rightPanelWidth = readRightPanelWidth(
    String(rightPanelWidthRatio),
    mainContentWidth,
    viewportSize.height,
  );
  const displayedRightPanelWidth = isRightPanelExpanded
    ? getExpandedRightPanelWidth(mainContentWidth)
    : rightPanelWidth;
  const updateRightPanelWidth = (width: number) => {
    setRightPanelWidthRatio(writeRightPanelWidth(width, mainContentWidth));
  };
  const toggleRightPanel = () => setIsRightPanelOpen(open => !open);
  const toggleRightPanelExpanded = () => setIsRightPanelExpanded(expanded => !expanded);
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
    <div className="app-shell relative flex h-svh min-h-0 overflow-hidden bg-transparent" data-resizing={isResizing}>
      <header className="app-shell-header draggable absolute inset-x-0 top-0 z-30 flex h-[46px]">
        <div
          className="app-shell-toolbar app-shell-header-left flex shrink-0 items-center"
          style={{
            paddingInlineStart: toolbarInset,
            width: isSidebarVisible ? sidebarWidth : toolbarInset + 32,
          }}
        >
          <SidebarToggle isSidebarVisible={isSidebarVisible} onToggle={toggleSidebar} />
        </div>
        <div className="min-w-0 flex-1" />
        <div
          className="app-shell-toolbar app-shell-header-right flex shrink-0 items-center justify-end"
          style={{
            width: isRightPanelOpen ? displayedRightPanelWidth : 40,
          }}
        >
          {isRightPanelOpen && (
            <button
              aria-label={isRightPanelExpanded ? 'Restore panel width' : 'Expand panel'}
              aria-pressed={isRightPanelExpanded}
              className="right-panel-expand-trigger sidebar-trigger flex size-8 items-center justify-center"
              onClick={toggleRightPanelExpanded}
              title={isRightPanelExpanded ? 'Restore panel width' : 'Expand panel'}
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
            onResizingChange={setIsResizing}
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
