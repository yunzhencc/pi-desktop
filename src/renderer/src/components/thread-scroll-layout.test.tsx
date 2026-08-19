// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThreadScrollLayout } from './thread-scroll-layout';

function Transcript({ footer, turns }: { footer?: React.ReactNode; turns: { key: string }[] }) {
  return <ThreadScrollLayout footer={footer} turns={turns}>{turn => <article>{turn.key}</article>}</ThreadScrollLayout>;
}

function setScrollMetrics(element: HTMLElement, scrollHeight: number) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: scrollHeight },
  });
}

afterEach(cleanup);

describe('thread scroll layout', () => {
  it('does not force the reader back to bottom after they scroll away', () => {
    const { rerender } = render(<Transcript turns={[{ key: 'first' }, { key: 'second' }]} />);
    const transcript = screen.getByRole('log');
    setScrollMetrics(transcript, 260);
    transcript.scrollTop = 20;
    fireEvent.scroll(transcript);

    setScrollMetrics(transcript, 332);
    rerender(<Transcript turns={[{ key: 'first' }, { key: 'second' }, { key: 'third' }]} />);

    expect(transcript.scrollTop).toBe(20);
  });

  it('pins new content to the bottom while the reader is at the bottom', () => {
    const { rerender } = render(<Transcript turns={[{ key: 'first' }, { key: 'second' }]} />);
    const transcript = screen.getByRole('log');
    setScrollMetrics(transcript, 260);
    transcript.scrollTop = 160;
    fireEvent.scroll(transcript);

    setScrollMetrics(transcript, 332);
    rerender(<Transcript turns={[{ key: 'first' }, { key: 'second' }, { key: 'third' }]} />);

    expect(transcript.scrollTop).toBe(232);
  });

  it('lets the reader jump back to the latest turn after scrolling away', () => {
    render(<Transcript turns={[{ key: 'first' }, { key: 'second' }]} />);
    const transcript = screen.getByRole('log');
    setScrollMetrics(transcript, 260);
    transcript.scrollTop = 20;
    fireEvent.scroll(transcript);

    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));

    expect(transcript.scrollTop).toBe(160);
  });

  it('anchors the jump button above the composer footer', () => {
    const { container } = render(<Transcript footer={<div>Composer</div>} turns={[{ key: 'first' }, { key: 'second' }]} />);
    const transcript = screen.getByRole('log');
    setScrollMetrics(transcript, 260);
    transcript.scrollTop = 20;
    fireEvent.scroll(transcript);

    expect(container.querySelector('.thread-scroll-footer')?.contains(screen.getByRole('button', { name: 'Jump to latest' }))).toBe(true);
  });

  it('renders the turns reached after scrolling away from the bottom', () => {
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    const originalScrollTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop');
    const scrollTops = new WeakMap<HTMLElement, number>();
    Object.defineProperties(HTMLElement.prototype, {
      clientHeight: { configurable: true, get: () => 100 },
      scrollHeight: { configurable: true, get: () => 864 },
      scrollTop: {
        configurable: true,
        get(this: HTMLElement) { return scrollTops.get(this) ?? 0; },
        set(this: HTMLElement, value: number) { scrollTops.set(this, value); },
      },
    });

    try {
      render(<Transcript turns={Array.from({ length: 10 }, (_, index) => ({ key: `turn-${index}` }))} />);
      const transcript = screen.getByRole('log');
      transcript.scrollTop = 0;
      fireEvent.scroll(transcript);

      expect(screen.getByText('turn-0')).not.toBeNull();
    }
    finally {
      for (const [name, descriptor] of Object.entries({ clientHeight: originalClientHeight, scrollHeight: originalScrollHeight, scrollTop: originalScrollTop })) {
        if (descriptor)
          Object.defineProperty(HTMLElement.prototype, name, descriptor);
        else
          delete (HTMLElement.prototype as Record<string, unknown>)[name];
      }
    }
  });
});
