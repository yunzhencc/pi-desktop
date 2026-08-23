import { HoverCard, HoverCardContent, HoverCardTrigger } from '@pi-desktop/shadcn-ui/components/hover-card';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIntl } from 'react-intl';
import './style.css';

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
  const [mounted, setMounted] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const [scrubbedId, setScrubbedId] = useState<string>();
  const scrubbingRef = useRef(false);

  useEffect(() => {
    if (items.length < 4)
      return;
    const idle = window.requestIdleCallback?.(() => setMounted(true), { timeout: 2000 });
    const timeout = idle == null ? window.setTimeout(setMounted, 0, true) : undefined;
    return () => {
      if (idle != null)
        window.cancelIdleCallback?.(idle);
      if (timeout != null)
        window.clearTimeout(timeout);
    };
  }, [items.length]);

  useEffect(() => {
    const element = getScrollElement();
    if (!mounted || element == null || typeof IntersectionObserver === 'undefined')
      return;
    const knownIds = new Set(items.map(item => item.id));
    const intersecting = new Set<string>();
    const apply = () => {
      const ordered = items.map(item => item.id);
      const first = ordered.findIndex(id => intersecting.has(id));
      const last = ordered.findLastIndex(id => intersecting.has(id));
      setVisibleIds(first < 0 || last < 0 ? new Set() : new Set(ordered.slice(first, last + 1)));
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.threadUserMessageId;
        if (id && knownIds.has(id))
          entry.isIntersecting ? intersecting.add(id) : intersecting.delete(id);
      }
      apply();
    }, { root: element, rootMargin: '-16px 0px 0px 0px' });
    const observe = () => element.querySelectorAll<HTMLElement>('[data-thread-user-message-id]').forEach((target) => {
      if (target.dataset.threadUserMessageId && knownIds.has(target.dataset.threadUserMessageId))
        observer.observe(target);
    });
    const mutations = new MutationObserver(observe);
    mutations.observe(element, { childList: true, subtree: true });
    observe();
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [getScrollElement, items, mounted]);

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
  if (!mounted || items.length < 4 || portalRoot == null)
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
