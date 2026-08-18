import { useEffect, useRef, useState } from 'react';
import {
  clampSidebarWidth,
  shouldCollapseSidebar,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from './sidebar-resize';

interface DragState {
  didMove: boolean;
  startPosition: number;
  startSize: number;
}

interface SidebarResizeHandleProps {
  onCollapse: () => void;
  onResizeEnd: (width: number) => void;
  onResizingChange: (isResizing: boolean) => void;
  onWidthChange: (width: number) => void;
  width: number;
}

export function SidebarResizeHandle({
  onCollapse,
  onResizeEnd,
  onResizingChange,
  onWidthChange,
  width,
}: SidebarResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => () => onResizingChange(false), [onResizingChange]);

  useEffect(() => {
    if (!isResizing)
      return;

    const resize = (event: PointerEvent) => {
      event.preventDefault();
      const drag = dragRef.current;
      if (!drag)
        return;

      drag.didMove ||= event.clientX !== drag.startPosition;
      const nextWidth = drag.startSize + event.clientX - drag.startPosition;
      if (shouldCollapseSidebar(nextWidth)) {
        onResizingChange(false);
        onCollapse();
        return;
      }

      onWidthChange(clampSidebarWidth(nextWidth, window.innerWidth));
    };
    const finish = (event: PointerEvent) => {
      event.preventDefault();
      const drag = dragRef.current;
      if (drag?.didMove) {
        const nextWidth = clampSidebarWidth(
          drag.startSize + event.clientX - drag.startPosition,
          window.innerWidth,
        );
        onWidthChange(nextWidth);
        onResizeEnd(nextWidth);
      }
      dragRef.current = null;
      setIsResizing(false);
      onResizingChange(false);
    };

    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [isResizing, onCollapse, onResizeEnd, onResizingChange, onWidthChange]);

  const reset = () => {
    const nextWidth = clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH, window.innerWidth);
    onWidthChange(nextWidth);
    onResizeEnd(nextWidth);
  };

  return (
    <div
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuenow={width}
      className="group absolute top-[46px] right-0 bottom-0 z-20 flex w-4 translate-x-2 touch-none select-none cursor-col-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={event => event.detail === 2 && reset()}
      onKeyDown={(event) => {
        const offset = event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : null;
        if (offset === null)
          return;

        event.preventDefault();
        const nextWidth = clampSidebarWidth(width + offset, window.innerWidth);
        onWidthChange(nextWidth);
        onResizeEnd(nextWidth);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0)
          return;

        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragRef.current = {
          didMove: false,
          startPosition: event.clientX,
          startSize: width,
        };
        onResizingChange(true);
        setIsResizing(true);
      }}
      role="separator"
      tabIndex={0}
    >
      <div className="sidebar-resize-handle-line pointer-events-none m-auto h-full w-px bg-gradient-to-b from-transparent via-foreground/25 to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 group-focus-visible:opacity-100" />
    </div>
  );
}
