// @vitest-environment jsdom

import type { UserMessageNavigationItem } from '.';
import { messages } from '@renderer/features/app/i18n/locale';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  return (
    <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
      <div>
        <div ref={scrollRef}>
          {navigationItems.map(item => <div data-thread-user-message-id={item.id} key={item.id} />)}
        </div>
        <ThreadUserMessageNavigationRail getScrollElement={() => scrollRef.current} items={navigationItems} onBookmarkChange={onBookmarkChange} onNavigate={onNavigate} />
      </div>
    </IntlProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('thread user message navigation rail', () => {
  it('stays hidden until there are four user messages', () => {
    render(<Rail navigationItems={items.slice(0, 3)} />);

    expect(screen.queryByRole('navigation', { name: '用户消息' })).toBeNull();
  });

  it('jumps smoothly when a marker is clicked', () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    render(<Rail onNavigate={onNavigate} />);
    act(() => vi.runAllTimers());

    expect(screen.getAllByRole('button', { name: /跳转到第/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: '跳转到第 2 条用户消息' }));

    expect(onNavigate).toHaveBeenCalledWith(items[1], 'smooth');
  });

  it('supports Alt+Down user-message navigation', () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    render(<Rail onNavigate={onNavigate} />);
    act(() => vi.runAllTimers());

    fireEvent.keyDown(document, { altKey: true, key: 'ArrowDown' });

    expect(onNavigate).toHaveBeenCalledWith(items[0], 'smooth');
  });

  it('marks the visible user message as current', () => {
    vi.useFakeTimers();
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
    act(() => vi.runAllTimers());

    const target = container.querySelector<HTMLElement>('[data-thread-user-message-id="user-1"]')!;
    act(() => notify?.([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver));

    expect(screen.getByRole('button', { name: '跳转到第 2 条用户消息' })).toHaveAttribute('aria-current', 'true');
  });
});
