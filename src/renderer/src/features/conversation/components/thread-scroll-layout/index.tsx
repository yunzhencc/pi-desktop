import type { ReactNode } from 'react';
import type { ThreadLayout, ThreadTurn } from './thread-virtualizer';
import { useOverlayScrollbarsTheme } from '@renderer/features/app/theme';
import { ArrowDown } from 'lucide-react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildThreadLayout, preserveAnchorDistance, visibleThreadRange } from './thread-virtualizer';

const DEFAULT_TURN_HEIGHT = 72;
const FOLLOW_THRESHOLD = 24;
const TURN_GAP = 16;

export function ThreadScrollLayout<T extends ThreadTurn>({ children, footer, turns }: {
  children: (turn: T) => ReactNode;
  footer?: ReactNode;
  turns: T[];
}) {
  const overlayScrollbarsTheme = useOverlayScrollbarsTheme();
  const hasFooter = footer != null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousLayoutRef = useRef<ThreadLayout | null>(null);
  const previousTurnKeysRef = useRef<string[]>([]);
  const anchorKeyRef = useRef<string | null>(null);
  const followsBottomRef = useRef(true);
  const footerRef = useRef<HTMLDivElement>(null);
  const previousFooterHeightRef = useRef(0);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(() => new Map());
  const [footerHeightPx, setFooterHeightPx] = useState(0);
  const [scrollbarInitialized, setScrollbarInitialized] = useState(false);
  const [scrollMetrics, setScrollMetrics] = useState({ distanceFromBottomPx: 0, viewportHeightPx: 0 });
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const layout = useMemo(() => buildThreadLayout(turns, measuredHeights, TURN_GAP, DEFAULT_TURN_HEIGHT), [measuredHeights, turns]);
  const range = scrollMetrics.viewportHeightPx > 0
    ? visibleThreadRange({ distanceFromBottomPx: scrollMetrics.distanceFromBottomPx, layout, overscanCount: 2, viewportHeightPx: scrollMetrics.viewportHeightPx })
    : { endIndex: turns.length, startIndex: 0 };
  const visibleTurns = turns.slice(range.startIndex, range.endIndex);
  const topSpacerPx = range.startIndex === 0 ? 0 : layout.totalHeightPx - layout.bottomOffsetsPx[range.startIndex]! - layout.heightsPx[range.startIndex]!;
  const bottomSpacerPx = range.endIndex === 0 ? 0 : layout.bottomOffsetsPx[range.endIndex - 1]!;

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element == null)
      return;

    const previousLayout = previousLayoutRef.current;
    const sameTurns = previousTurnKeysRef.current.length === layout.turnKeys.length
      && previousTurnKeysRef.current.every((key, index) => key === layout.turnKeys[index]);
    if (followsBottomRef.current) {
      element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    }
    else if (sameTurns && previousLayout != null && anchorKeyRef.current != null) {
      const nextDistance = preserveAnchorDistance({
        anchorKey: anchorKeyRef.current,
        distanceFromBottomPx: distanceFromBottom(element),
        nextLayout: layout,
        previousLayout,
      });
      if (nextDistance != null)
        element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - nextDistance);
    }

    previousLayoutRef.current = layout;
    previousTurnKeysRef.current = layout.turnKeys;
    const distance = distanceFromBottom(element);
    setScrollMetrics(current => current.distanceFromBottomPx === distance && current.viewportHeightPx === element.clientHeight
      ? current
      : { distanceFromBottomPx: distance, viewportHeightPx: element.clientHeight });
  }, [layout, scrollbarInitialized]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element == null || typeof ResizeObserver === 'undefined')
      return;

    const observer = new ResizeObserver((entries) => {
      setMeasuredHeights((current) => {
        const next = new Map(current);
        let changed = false;
        for (const entry of entries) {
          const key = entry.target.getAttribute('data-thread-turn');
          const height = Math.ceil(entry.contentRect.height);
          if (key != null && height > 0 && next.get(key) !== height) {
            next.set(key, height);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
    element.querySelectorAll<HTMLElement>('[data-thread-turn]').forEach(turn => observer.observe(turn));
    return () => observer.disconnect();
  }, [range.endIndex, range.startIndex, turns]);

  useLayoutEffect(() => {
    const element = footerRef.current;
    if (element == null || typeof ResizeObserver === 'undefined')
      return;

    const observer = new ResizeObserver(([entry]) => {
      const height = Math.ceil(entry?.contentRect.height ?? 0);
      setFooterHeightPx(current => current === height ? current : height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasFooter]);

  useLayoutEffect(() => {
    const previousHeight = previousFooterHeightRef.current;
    previousFooterHeightRef.current = footerHeightPx;
    const element = scrollRef.current;
    if (element == null || previousHeight === footerHeightPx)
      return;

    if (followsBottomRef.current)
      element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    else
      element.scrollTop = Math.max(0, element.scrollTop + footerHeightPx - previousHeight);
  }, [footerHeightPx]);

  const scrollToBottom = () => {
    const element = scrollRef.current;
    if (element == null)
      return;
    followsBottomRef.current = true;
    element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    setShowJumpToBottom(false);
    setScrollMetrics({ distanceFromBottomPx: 0, viewportHeightPx: element.clientHeight });
  };
  const handleScroll = (element: HTMLElement) => {
    scrollRef.current = element;
    const distance = distanceFromBottom(element);
    const followsBottom = distance <= FOLLOW_THRESHOLD;
    followsBottomRef.current = followsBottom;
    setShowJumpToBottom(!followsBottom);
    const nextRange = visibleThreadRange({ distanceFromBottomPx: distance, layout, overscanCount: 2, viewportHeightPx: element.clientHeight });
    anchorKeyRef.current = layout.turnKeys[nextRange.startIndex] ?? null;
    setScrollMetrics(current => current.distanceFromBottomPx === distance && current.viewportHeightPx === element.clientHeight
      ? current
      : { distanceFromBottomPx: distance, viewportHeightPx: element.clientHeight });
  };
  const jumpToBottomButton = showJumpToBottom && (
    <button aria-label="Jump to latest" className="thread-scroll-to-bottom" onClick={scrollToBottom} title="Jump to latest" type="button">
      <ArrowDown aria-hidden="true" size={16} />
    </button>
  );

  return (
    <>
      <OverlayScrollbarsComponent
        aria-live="polite"
        className="thread-scroll-layout"
        events={{
          initialized: (instance) => {
            scrollRef.current = instance.elements().viewport;
            setScrollbarInitialized(true);
          },
          scroll: instance => handleScroll(instance.elements().viewport),
        }}
        options={{ scrollbars: { autoHide: 'leave', theme: overlayScrollbarsTheme } }}
        role="log"
      >
        <div className="thread-scroll-surface" data-thread-scroll-surface>
          <div className="thread-scroll-content" style={footer ? { paddingBottom: footerHeightPx + 16 } : undefined}>
            <div aria-hidden="true" style={{ height: topSpacerPx }} />
            {visibleTurns.map((turn, index) => (
              <div data-thread-turn={turn.key} key={turn.key} style={{ marginBottom: index === visibleTurns.length - 1 ? 0 : TURN_GAP }}>
                {children(turn)}
              </div>
            ))}
            <div aria-hidden="true" style={{ height: bottomSpacerPx }} />
          </div>
          {footer && (
            <div className="thread-scroll-footer" ref={footerRef}>
              {jumpToBottomButton}
              {footer}
            </div>
          )}
        </div>
      </OverlayScrollbarsComponent>
      {!footer && jumpToBottomButton}
    </>
  );
}

function distanceFromBottom(element: HTMLElement | null) {
  if (element == null)
    return 0;
  return Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
}
