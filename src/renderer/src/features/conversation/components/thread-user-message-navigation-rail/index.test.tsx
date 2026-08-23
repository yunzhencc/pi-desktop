// @vitest-environment jsdom

import type { UserMessageNavigationItem } from '.';
import { messages } from '@renderer/features/app/i18n/locale';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreadUserMessageNavigationRail } from '.';

const items: UserMessageNavigationItem[] = Array.from({ length: 4 }, (_, index) => ({
  entryId: `user-${index}`,
  id: `user-${index}`,
  isBookmarked: false,
  label: `Prompt ${index + 1}`,
  response: `Response ${index + 1}`,
  turnKey: `turn-${index}`,
}));

function Rail({ navigationItems = items, onNavigate = vi.fn(), onBookmarkChange = vi.fn() }: {
  navigationItems?: UserMessageNavigationItem[];
  onBookmarkChange?: (item: UserMessageNavigationItem, bookmarked: boolean) => void;
  onNavigate?: (item: UserMessageNavigationItem, behavior: ScrollBehavior) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (scrollElement == null || contentElement == null)
      return;
    const rect = (left: number, width: number) => ({ bottom: 0, height: 0, left, right: left + width, top: 0, width, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    Object.defineProperty(scrollElement, 'offsetWidth', { configurable: true, value: 800 });
    scrollElement.getBoundingClientRect = () => rect(0, 800);
    contentElement.style.paddingLeft = '64px';
    contentElement.getBoundingClientRect = () => rect(0, 800);
  }, []);
  return (
    <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
      <div>
        <div ref={scrollRef}>
          <div data-thread-user-message-navigation-content ref={contentRef}>
            {navigationItems.map(item => <div data-thread-user-message-id={item.id} key={item.id} />)}
          </div>
        </div>
        <ThreadUserMessageNavigationRail getScrollElement={() => scrollRef.current} items={navigationItems} onBookmarkChange={onBookmarkChange} onNavigate={onNavigate} />
      </div>
    </IntlProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('thread user message navigation rail', () => {
  it('stays hidden until there are four user messages', () => {
    render(<Rail navigationItems={items.slice(0, 3)} />);

    expect(screen.queryByRole('navigation', { name: '用户消息' })).toBeNull();
  });

  it('jumps smoothly when a marker is clicked', () => {
    const onNavigate = vi.fn();
    render(<Rail onNavigate={onNavigate} />);

    expect(screen.getAllByRole('button', { name: /跳转到第/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: '跳转到第 2 条用户消息' }));

    expect(onNavigate).toHaveBeenCalledWith(items[1], 'smooth');
  });

  it('supports Alt+Down user-message navigation', () => {
    const onNavigate = vi.fn();
    render(<Rail onNavigate={onNavigate} />);

    fireEvent.keyDown(document, { altKey: true, key: 'ArrowDown' });

    expect(onNavigate).toHaveBeenCalledWith(items[0], 'smooth');
  });

  it('initially marks the latest user message as current', () => {
    render(<Rail />);

    expect(screen.getByRole('button', { name: '跳转到第 4 条用户消息' })).toHaveAttribute('aria-current', 'true');
  });

  it('marks the visible user message as current', () => {
    let notify: IntersectionObserverCallback | undefined;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }

      disconnect() {}
      observe() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = '0px';
      thresholds = [];
    });
    const { container } = render(<Rail />);

    const target = container.querySelector<HTMLElement>('[data-thread-user-message-id="user-1"]')!;
    act(() => notify?.([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver));

    expect(screen.getByRole('button', { name: '跳转到第 2 条用户消息' })).toHaveAttribute('aria-current', 'true');
  });

  it('keeps the last selection when no observed message intersects', () => {
    let notify: IntersectionObserverCallback | undefined;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }

      disconnect() {}
      observe() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = '0px';
      thresholds = [];
    });
    const { container } = render(<Rail />);
    const target = container.querySelector<HTMLElement>('[data-thread-user-message-id="user-1"]')!;

    act(() => notify?.([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => notify?.([{ isIntersecting: false, target } as IntersectionObserverEntry], {} as IntersectionObserver));

    expect(screen.getByRole('button', { name: '跳转到第 2 条用户消息' })).toHaveAttribute('aria-current', 'true');
  });

  it('unobserves virtualized turns that leave the DOM', async () => {
    const unobserve = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      disconnect() {}
      observe() {}
      unobserve = unobserve;
      takeRecords() { return []; }
      root = null;
      rootMargin = '0px';
      thresholds = [];
    });
    const { container } = render(<Rail />);
    const target = container.querySelector<HTMLElement>('[data-thread-user-message-id="user-1"]')!;

    target.remove();

    await waitFor(() => expect(unobserve).toHaveBeenCalledWith(target));
  });
});
