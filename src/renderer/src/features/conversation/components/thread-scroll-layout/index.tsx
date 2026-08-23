import type { ReactNode } from 'react';
import type { UserMessageNavigationItem } from '../thread-user-message-navigation-rail';
import type { ThreadLayout, ThreadTurn } from './thread-virtualizer';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { ArrowDown } from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ThreadUserMessageNavigationRail } from '../thread-user-message-navigation-rail';
import { buildThreadLayout, preserveAnchorDistance, visibleThreadRange } from './thread-virtualizer';
import './style.css';

const DEFAULT_TURN_HEIGHT = 72;
const FOLLOW_THRESHOLD = 24;
const TURN_GAP = 16;
const jumpToBottomButtonClass = 'thread-scroll-to-bottom absolute left-1/2 z-[2] grid size-8 -translate-x-1/2 place-items-center rounded-full border border-border-subtle bg-surface text-text-secondary';
const threadContentClass = 'thread-scroll-content flex-[1_0_auto] px-[max(16px,calc((100%_-_720px)/2))] pt-4 pb-4 [&>[data-thread-turn]]:flex';

export interface ThreadNavigation {
  items: UserMessageNavigationItem[];
  onBookmarkChange: (item: UserMessageNavigationItem, bookmarked: boolean) => void;
}

export function ThreadScrollLayout<T extends ThreadTurn>({ children, footer, navigation, turns }: {
  children: (turn: T) => ReactNode;
  footer?: ReactNode;
  navigation?: ThreadNavigation;
  turns: T[];
}) {
  const hasFooter = footer != null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const previousLayoutRef = useRef<ThreadLayout | null>(null);
  const previousTurnKeysRef = useRef<string[]>([]);
  const anchorKeyRef = useRef<string | null>(null);
  const followsBottomRef = useRef(true);
  const footerRef = useRef<HTMLDivElement>(null);
  const previousFooterHeightRef = useRef(0);
  const lastScrollDistanceFromBottomRef = useRef(0);
  const pendingScrollPreservationRef = useRef<{ distanceFromBottomPx: number; scrollHeightPx: number } | null>(null);
  const measuredHeightsRef = useRef<Map<string, number>>(new Map());
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(() => new Map());
  const [footerHeightPx, setFooterHeightPx] = useState(0);
  const [scrollMetrics, setScrollMetrics] = useState({ distanceFromBottomPx: 0, viewportHeightPx: 0 });
  const setScrollRef = useCallback((element: HTMLDivElement | null) => {
    scrollRef.current = element;
    setScrollElement(current => current === element ? current : element);
  }, []);
  const getScrollElement = useCallback(() => scrollElement, [scrollElement]);
  const layout = useMemo(() => buildThreadLayout(turns, measuredHeights, TURN_GAP, DEFAULT_TURN_HEIGHT), [measuredHeights, turns]);
  const range = scrollMetrics.viewportHeightPx > 0
    ? visibleThreadRange({ distanceFromBottomPx: scrollMetrics.distanceFromBottomPx, layout, overscanCount: 2, viewportHeightPx: scrollMetrics.viewportHeightPx })
    : { endIndex: turns.length, startIndex: 0 };
  const visibleTurns = turns.slice(range.startIndex, range.endIndex);
  const navigationItemsByTurnKey = useMemo(() => new Map(navigation?.items.map(item => [item.turnKey, item])), [navigation?.items]);
  const topSpacerPx = range.startIndex === 0 ? 0 : layout.totalHeightPx - layout.bottomOffsetsPx[range.startIndex]! - layout.heightsPx[range.startIndex]!;
  const bottomSpacerPx = range.endIndex === 0 ? 0 : layout.bottomOffsetsPx[range.endIndex - 1]!;
  const responseSpacerHeightPx = hasFooter ? footerHeightPx + 16 : null;
  const showJumpToBottom = shouldShowJumpToBottom({
    isScrolledFromBottom: scrollMetrics.distanceFromBottomPx > FOLLOW_THRESHOLD,
    responseSpacerHeightPx,
    scrollDistanceFromBottomPx: scrollMetrics.distanceFromBottomPx,
  });

  const updateScrollState = useCallback((element: HTMLElement) => {
    const distance = distanceFromBottom(element);
    lastScrollDistanceFromBottomRef.current = distance;
    const followsBottom = distance <= FOLLOW_THRESHOLD;
    followsBottomRef.current = followsBottom;
    setScrollMetrics(current => current.distanceFromBottomPx === distance && current.viewportHeightPx === element.clientHeight
      ? current
      : { distanceFromBottomPx: distance, viewportHeightPx: element.clientHeight });
  }, []);

  const preserveScrollPositionForNextLayout = useCallback(() => {
    const element = scrollRef.current;
    if (element == null || pendingScrollPreservationRef.current != null)
      return;
    const snapshot = { distanceFromBottomPx: lastScrollDistanceFromBottomRef.current, scrollHeightPx: element.scrollHeight };
    pendingScrollPreservationRef.current = snapshot;
    window.requestAnimationFrame(() => {
      if (pendingScrollPreservationRef.current !== snapshot)
        return;
      pendingScrollPreservationRef.current = null;
      if (scrollRef.current !== element || element.scrollHeight === snapshot.scrollHeightPx)
        return;
      element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - snapshot.distanceFromBottomPx);
      updateScrollState(element);
    });
  }, [updateScrollState]);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element == null)
      return;

    const previousLayout = previousLayoutRef.current;
    const sameTurns = previousTurnKeysRef.current.length === layout.turnKeys.length
      && previousTurnKeysRef.current.every((key, index) => key === layout.turnKeys[index]);
    if (pendingScrollPreservationRef.current == null && followsBottomRef.current) {
      element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    }
    else if (pendingScrollPreservationRef.current == null && sameTurns && previousLayout != null && anchorKeyRef.current != null) {
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
  }, [layout]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element == null || typeof ResizeObserver === 'undefined')
      return;

    const observer = new ResizeObserver((entries) => {
      const next = new Map(measuredHeightsRef.current);
      let changed = false;
      for (const entry of entries) {
        const key = entry.target.getAttribute('data-thread-turn');
        const height = Math.ceil(entry.contentRect.height);
        if (key != null && height > 0 && next.get(key) !== height) {
          next.set(key, height);
          changed = true;
        }
      }
      if (!changed)
        return;
      measuredHeightsRef.current = next;
      preserveScrollPositionForNextLayout();
      setMeasuredHeights(next);
    });
    element.querySelectorAll<HTMLElement>('[data-thread-turn]').forEach(turn => observer.observe(turn));
    return () => observer.disconnect();
  }, [preserveScrollPositionForNextLayout, range.endIndex, range.startIndex, turns]);

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
    setScrollMetrics({ distanceFromBottomPx: 0, viewportHeightPx: element.clientHeight });
  };
  const scrollToUserMessage = useCallback((item: UserMessageNavigationItem, behavior: ScrollBehavior) => {
    const element = scrollRef.current;
    const index = layout.turnIndexByKey.get(item.turnKey);
    if (element == null || index == null)
      return;
    const reveal = () => {
      const turn = [...element.querySelectorAll<HTMLElement>('[data-thread-user-message-id]')].find(target => target.dataset.threadUserMessageId === item.id);
      if (turn == null)
        return;
      turn.scrollIntoView({ behavior, block: 'start' });
      if (behavior === 'smooth' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        turn.querySelector<HTMLElement>('[data-user-message-bubble]')?.animate?.([{ backgroundColor: 'color-mix(in srgb, var(--foreground) 14%, transparent)' }, { backgroundColor: 'color-mix(in srgb, var(--foreground) 14%, transparent)', offset: 0.35 }, { backgroundColor: 'transparent' }], { duration: 1400, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    };
    const isMounted = [...element.querySelectorAll<HTMLElement>('[data-thread-user-message-id]')].some(target => target.dataset.threadUserMessageId === item.id);
    if (!isMounted) {
      const topOffsetPx = layout.totalHeightPx - layout.bottomOffsetsPx[index]! - layout.heightsPx[index]!;
      element.scrollTop = Math.max(0, Math.min(element.scrollHeight - element.clientHeight, topOffsetPx));
      updateScrollState(element);
    }
    window.requestAnimationFrame(reveal);
  }, [layout, updateScrollState]);
  const handleScroll = (element: HTMLElement) => {
    scrollRef.current = element;
    const distance = distanceFromBottom(element);
    const nextRange = visibleThreadRange({ distanceFromBottomPx: distance, layout, overscanCount: 2, viewportHeightPx: element.clientHeight });
    anchorKeyRef.current = layout.turnKeys[nextRange.startIndex] ?? null;
    updateScrollState(element);
  };
  const jumpToBottomButton = showJumpToBottom && (
    <button
      aria-label="Jump to latest"
      className={cn(
        jumpToBottomButtonClass,
        footer ? 'bottom-[calc(100%+24px)]' : 'bottom-[var(--thread-scroll-padding-bottom,32px)]',
      )}
      onClick={scrollToBottom}
      title="Jump to latest"
      type="button"
    >
      <ArrowDown aria-hidden="true" size={16} />
    </button>
  );

  return (
    <>
      <div
        aria-live="polite"
        className="thread-scroll-layout scroll-pb-[var(--thread-scroll-padding-bottom,32px)]"
        onScroll={event => handleScroll(event.currentTarget)}
        ref={setScrollRef}
        role="log"
      >
        <div className="thread-scroll-surface flex min-h-full flex-col" data-thread-scroll-surface>
          <div className={threadContentClass} data-thread-user-message-navigation-content style={footer ? { paddingBottom: footerHeightPx + 16 } : undefined}>
            <div aria-hidden="true" style={{ height: topSpacerPx }} />
            {visibleTurns.map((turn, index) => (
              <div data-thread-turn={turn.key} data-thread-user-message-id={navigationItemsByTurnKey.get(turn.key)?.id} key={turn.key} style={{ marginBottom: index === visibleTurns.length - 1 ? 0 : TURN_GAP }}>
                {children(turn)}
              </div>
            ))}
            <div aria-hidden="true" style={{ height: bottomSpacerPx }} />
          </div>
          {footer && (
            <div className="thread-scroll-footer sticky bottom-0 z-[1] mt-auto flex-none bg-surface pb-4" ref={footerRef}>
              {jumpToBottomButton}
              {footer}
            </div>
          )}
        </div>
      </div>
      {navigation && <ThreadUserMessageNavigationRail getScrollElement={getScrollElement} items={navigation.items} onBookmarkChange={navigation.onBookmarkChange} onNavigate={scrollToUserMessage} />}
      {!footer && jumpToBottomButton}
    </>
  );
}

function distanceFromBottom(element: HTMLElement | null) {
  if (element == null)
    return 0;
  return Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
}

function shouldShowJumpToBottom({ isScrolledFromBottom, responseSpacerHeightPx, scrollDistanceFromBottomPx }: {
  isScrolledFromBottom: boolean;
  responseSpacerHeightPx: null | number;
  scrollDistanceFromBottomPx: number;
}) {
  return responseSpacerHeightPx == null
    ? isScrolledFromBottom
    : scrollDistanceFromBottomPx > responseSpacerHeightPx + FOLLOW_THRESHOLD;
}
