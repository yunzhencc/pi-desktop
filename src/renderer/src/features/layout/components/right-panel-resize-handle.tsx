import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  clampRightPanelWidth,
  readRightPanelWidth,
  shouldCloseRightPanel,
} from './right-panel';

interface DragState {
  didMove: boolean;
  startPosition: number;
  startSize: number;
}

interface RightPanelResizeHandleProps {
  mainContentWidth: number;
  onClose: () => void;
  onResizeEnd: (width: number) => void;
  onResizingChange: (isResizing: boolean) => void;
  onWidthChange: (width: number) => void;
  shellHeight: number;
  width: number;
}

export function RightPanelResizeHandle({
  mainContentWidth,
  onClose,
  onResizeEnd,
  onResizingChange,
  onWidthChange,
  shellHeight,
  width,
}: RightPanelResizeHandleProps) {
  const { formatMessage } = useIntl();
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => () => onResizingChange(false), [onResizingChange]);

  useEffect(() => {
    if (!isResizing)
      return;

    const getWidth = (event: PointerEvent) => {
      const drag = dragRef.current;
      return drag && clampRightPanelWidth(
        drag.startSize - event.clientX + drag.startPosition,
        mainContentWidth,
      );
    };
    const resize = (event: PointerEvent) => {
      event.preventDefault();
      const drag = dragRef.current;
      if (!drag)
        return;

      drag.didMove ||= event.clientX !== drag.startPosition;
      const nextWidth = drag.startSize - event.clientX + drag.startPosition;
      if (shouldCloseRightPanel(nextWidth)) {
        onResizingChange(false);
        onClose();
        return;
      }

      onWidthChange(clampRightPanelWidth(nextWidth, mainContentWidth));
    };
    const finish = (event: PointerEvent) => {
      event.preventDefault();
      const drag = dragRef.current;
      const nextWidth = getWidth(event);
      if (drag?.didMove && nextWidth !== null) {
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
  }, [isResizing, mainContentWidth, onClose, onResizeEnd, onResizingChange, onWidthChange]);

  const reset = () => {
    const nextWidth = readRightPanelWidth(null, mainContentWidth, shellHeight);
    onWidthChange(nextWidth);
    onResizeEnd(nextWidth);
  };

  return (
    <div
      aria-label={formatMessage({ id: 'resize.rightPanel' })}
      aria-orientation="vertical"
      aria-valuemax={clampRightPanelWidth(Number.POSITIVE_INFINITY, mainContentWidth)}
      aria-valuemin={320}
      aria-valuenow={width}
      className="group absolute top-0 bottom-0 left-0 z-20 flex w-4 -translate-x-2 touch-none select-none cursor-col-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={event => event.detail === 2 && reset()}
      onKeyDown={(event) => {
        const offset = event.key === 'ArrowLeft' ? 10 : event.key === 'ArrowRight' ? -10 : null;
        if (offset === null)
          return;

        event.preventDefault();
        const nextWidth = clampRightPanelWidth(width + offset, mainContentWidth);
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
      <div className="right-panel-resize-handle-line pointer-events-none m-auto h-full w-px bg-gradient-to-b from-transparent via-foreground/25 to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 group-focus-visible:opacity-100" />
    </div>
  );
}
