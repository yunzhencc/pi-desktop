import { HoverCard, HoverCardContent, HoverCardTrigger } from '@pi-desktop/shadcn-ui/components/hover-card';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIntl } from 'react-intl';
import './style.css';

const NAVIGATION_GUTTER_PX = 48;
const NAVIGATION_CONTENT_SELECTOR = '[data-thread-user-message-navigation-content]';
const USER_MESSAGE_TURN_SELECTOR = '[data-thread-user-message-id]';

export interface UserMessageNavigationItem {
  entryId?: string;
  id: string;
  isBookmarked: boolean;
  label: string;
  response: string;
  turnKey: string;
}

interface ThreadUserMessageNavigationRailProps {
  getScrollElement: () => HTMLDivElement | null;
  items: UserMessageNavigationItem[];
  onBookmarkChange: (item: UserMessageNavigationItem, bookmarked: boolean) => void;
  onNavigate: (item: UserMessageNavigationItem, behavior: ScrollBehavior) => void;
}

export function ThreadUserMessageNavigationRail({ getScrollElement, items, onBookmarkChange, onNavigate }: ThreadUserMessageNavigationRailProps) {
  const { formatMessage } = useIntl();
  const [hasNavigationGutter, setHasNavigationGutter] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => {
    const lastId = items.at(-1)?.id;
    return new Set(lastId == null ? [] : [lastId]);
  });
  const [scrubbedId, setScrubbedId] = useState<string>();
  const scrubbingRef = useRef(false);
  const itemIds = items.map(item => item.id).join('\0');

  useEffect(() => {
    const element = getScrollElement();
    const content = element?.querySelector<HTMLElement>(NAVIGATION_CONTENT_SELECTOR);
    if (element == null || content == null)
      return;
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      const scrollRect = element.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const scale = element.offsetWidth > 0 ? scrollRect.width / element.offsetWidth : 1;
      const contentStartPx = (contentRect.left - scrollRect.left) / (scale > 0 ? scale : 1) + (Number.parseFloat(window.getComputedStyle(content).paddingLeft) || 0);
      const nextHasNavigationGutter = contentStartPx >= NAVIGATION_GUTTER_PX;
      setHasNavigationGutter(current => current === nextHasNavigationGutter ? current : nextHasNavigationGutter);
    };
    const scheduleUpdate = () => {
      frame ??= window.requestAnimationFrame(update);
    };
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(element);
    resizeObserver?.observe(content);
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(element.firstElementChild ?? element, { attributeFilter: ['style'], attributes: true });
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();
    return () => {
      if (frame != null)
        window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [getScrollElement]);

  useEffect(() => {
    const element = getScrollElement();
    if (!hasNavigationGutter || element == null || typeof IntersectionObserver === 'undefined')
      return;
    const orderedIds = itemIds === '' ? [] : itemIds.split('\0');
    const knownIds = new Set(orderedIds);
    const intersecting = new Set<string>();
    const itemIdByTarget = new Map<HTMLElement, string>();
    const observedTargets = new Set<HTMLElement>();
    const applySelection = () => {
      const first = orderedIds.findIndex(id => intersecting.has(id));
      const last = orderedIds.findLastIndex(id => intersecting.has(id));
      if (first < 0 || last < 0)
        return;
      const next = new Set(orderedIds.slice(first, last + 1));
      setVisibleIds(current => current.size === next.size && [...current].every(id => next.has(id)) ? current : next);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const id = itemIdByTarget.get(target);
        if (id != null)
          entry.isIntersecting ? intersecting.add(id) : intersecting.delete(id);
      }
      applySelection();
    }, { root: element, rootMargin: '-16px 0px 0px 0px' });
    const observeTargets = () => {
      const nextTargets = new Set<HTMLElement>();
      for (const target of element.querySelectorAll<HTMLElement>(USER_MESSAGE_TURN_SELECTOR)) {
        const id = target.dataset.threadUserMessageId;
        if (id == null || !knownIds.has(id))
          continue;
        nextTargets.add(target);
        const previousId = itemIdByTarget.get(target);
        if (previousId != null && previousId !== id)
          intersecting.delete(previousId);
        itemIdByTarget.set(target, id);
        if (!observedTargets.has(target)) {
          observer.observe(target);
          observedTargets.add(target);
        }
      }
      for (const target of observedTargets) {
        if (nextTargets.has(target))
          continue;
        const id = itemIdByTarget.get(target);
        if (id != null)
          intersecting.delete(id);
        itemIdByTarget.delete(target);
        observer.unobserve(target);
        observedTargets.delete(target);
      }
      applySelection();
    };
    const mutations = new MutationObserver((records) => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node instanceof HTMLElement && (node.matches(USER_MESSAGE_TURN_SELECTOR) || node.querySelector(USER_MESSAGE_TURN_SELECTOR) != null))))
        observeTargets();
    });
    mutations.observe(element, { childList: true, subtree: true });
    observeTargets();
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [getScrollElement, hasNavigationGutter, itemIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
        return;
      const index = items.findIndex(item => visibleIds.has(item.id));
      const target = items[index + (event.key === 'ArrowUp' ? -1 : 1)] ?? (event.key === 'ArrowUp' ? items.at(-1) : items[0]);
      if (target) {
        event.preventDefault();
        onNavigate(target, 'smooth');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [items, onNavigate, visibleIds]);

  const portalRoot = getScrollElement()?.parentElement ?? null;
  if (!hasNavigationGutter || items.length < 4 || portalRoot == null)
    return null;

  const navigateAtPoint = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-thread-user-message-navigation-item-id]');
    const item = items.find(candidate => candidate.id === target?.dataset.threadUserMessageNavigationItemId);
    if (item && item.id !== scrubbedId) {
      setScrubbedId(item.id);
      onNavigate(item, 'auto');
    }
  };
  const rail = (
    <nav
      aria-label={formatMessage({ defaultMessage: 'User messages', id: 'conversation.userMessageNavigation.ariaLabel' })}
      className="thread-user-message-navigation-rail"
      onPointerMove={(event) => {
        if (scrubbingRef.current)
          navigateAtPoint(event.clientX, event.clientY);
      }}
    >
      <div className="thread-user-message-navigation-list">
        {items.map((item, index) => (
          <HoverCard key={item.id}>
            <HoverCardTrigger
              className="thread-user-message-navigation-item flex h-2.5 w-9 shrink-0"
              closeDelay={0}
              data-current={visibleIds.has(item.id) || undefined}
              data-scrub-target={scrubbedId === item.id || undefined}
            >
              <button
                aria-current={visibleIds.has(item.id) || undefined}
                aria-label={formatMessage({ defaultMessage: 'Jump to user message {position}', id: 'conversation.userMessageNavigation.jump' }, { position: index + 1 })}
                className="thread-user-message-navigation-button"
                data-thread-user-message-navigation-item-id={item.id}
                onClick={() => {
                  if (scrubbingRef.current)
                    return;
                  onNavigate(item, 'smooth');
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0)
                    return;
                  scrubbingRef.current = true;
                  setScrubbedId(item.id);
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  onNavigate(item, 'auto');
                }}
                onPointerUp={(event) => {
                  scrubbingRef.current = false;
                  setScrubbedId(undefined);
                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                }}
                type="button"
              >
                <span className="thread-user-message-navigation-marker">
                  <span className="thread-user-message-navigation-marker-line" />
                  {item.isBookmarked && <span aria-hidden="true" className="thread-user-message-navigation-bookmark-dot" />}
                </span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              align="center"
              className="thread-user-message-navigation-preview"
              side="right"
              sideOffset={0}
            >
              <div className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="min-w-0 flex-1 truncate">{item.label || formatMessage({ defaultMessage: '(No content)', id: 'conversation.userMessageNavigation.noContent' })}</span>
                {item.entryId && (
                  <button
                    aria-label={formatMessage(item.isBookmarked
                      ? { defaultMessage: 'Remove bookmark from this message', id: 'conversation.userMessageNavigation.removeBookmark' }
                      : { defaultMessage: 'Bookmark this message', id: 'conversation.userMessageNavigation.bookmark' })}
                    aria-pressed={item.isBookmarked}
                    className="grid size-6 shrink-0 place-items-center rounded text-text-secondary hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      onBookmarkChange(item, !item.isBookmarked);
                    }}
                    type="button"
                  >
                    {item.isBookmarked ? <BookmarkCheck aria-hidden="true" size={14} /> : <Bookmark aria-hidden="true" size={14} />}
                  </button>
                )}
              </div>
              {item.response && <p className="mt-1 line-clamp-3 text-text-secondary">{item.response}</p>}
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
    </nav>
  );
  return createPortal(rail, portalRoot);
}
