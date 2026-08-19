// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function transcriptViewport() {
  const viewport = screen.getByRole('log').querySelector<HTMLElement>('[data-overlayscrollbars-viewport]');
  if (viewport == null)
    throw new Error('Transcript viewport is not initialized');
  return viewport;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('thread scroll layout', () => {
  it('uses an overlay scrollbar viewport for the transcript', () => {
    render(<Transcript turns={[{ key: 'first' }]} />);

    expect(screen.getByRole('log').querySelector('[data-overlayscrollbars-viewport]')).not.toBeNull();
  });

  it('keeps the footer and transcript in one full-height scroll surface', () => {
    render(<Transcript footer={<div>Composer</div>} turns={[{ key: 'first' }]} />);

    const surface = screen.getByRole('log').querySelector('[data-thread-scroll-surface]');
    expect(surface?.querySelector('[data-thread-turn="first"]')).not.toBeNull();
    expect(surface?.contains(screen.getByText('Composer'))).toBe(true);
  });

  it('reserves transcript space for the measured footer height', () => {
    let notify: ResizeObserverCallback | undefined;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback;
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    });
    render(<Transcript footer={<div>Composer</div>} turns={[{ key: 'first' }]} />);

    act(() => notify?.([{ contentRect: { height: 88 } } as ResizeObserverEntry], {} as ResizeObserver));

    expect(screen.getByRole('log').querySelector<HTMLElement>('.thread-scroll-content')?.style.paddingBottom).toBe('104px');
  });

  it('preserves the reader position when the footer grows', () => {
    let notify: ResizeObserverCallback | undefined;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback;
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    });
    render(<Transcript footer={<div>Composer</div>} turns={[{ key: 'first' }]} />);
    const transcript = transcriptViewport();
    setScrollMetrics(transcript, 300);
    transcript.scrollTop = 100;
    fireEvent.scroll(transcript);

    act(() => notify?.([{ contentRect: { height: 88 } } as ResizeObserverEntry], {} as ResizeObserver));

    expect(transcript.scrollTop).toBe(188);
  });

  it('does not force the reader back to bottom after they scroll away', () => {
    const { rerender } = render(<Transcript turns={[{ key: 'first' }, { key: 'second' }]} />);
    const transcript = transcriptViewport();
    setScrollMetrics(transcript, 260);
    transcript.scrollTop = 20;
    fireEvent.scroll(transcript);

    setScrollMetrics(transcript, 332);
    rerender(<Transcript turns={[{ key: 'first' }, { key: 'second' }, { key: 'third' }]} />);

    expect(transcript.scrollTop).toBe(20);
  });

  it('pins new content to the bottom while the reader is at the bottom', () => {
    const { rerender } = render(<Transcript turns={[{ key: 'first' }, { key: 'second' }]} />);
    const transcript = transcriptViewport();
    setScrollMetrics(transcript, 260);
    transcript.scrollTop = 160;
    fireEvent.scroll(transcript);

    setScrollMetrics(transcript, 332);
    rerender(<Transcript turns={[{ key: 'first' }, { key: 'second' }, { key: 'third' }]} />);

    expect(transcript.scrollTop).toBe(232);
  });

  it('lets the reader jump back to the latest turn after scrolling away', () => {
    render(<Transcript turns={[{ key: 'first' }, { key: 'second' }]} />);
    const transcript = transcriptViewport();
    setScrollMetrics(transcript, 260);
    transcript.scrollTop = 20;
    fireEvent.scroll(transcript);

    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));

    expect(transcript.scrollTop).toBe(160);
  });

  it('anchors the jump button above the composer footer', () => {
    const { container } = render(<Transcript footer={<div>Composer</div>} turns={[{ key: 'first' }, { key: 'second' }]} />);
    const transcript = transcriptViewport();
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
      const transcript = transcriptViewport();
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
