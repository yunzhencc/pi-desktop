// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThreadScrollLayout } from './thread-scroll-layout';

function Transcript({ turns }: { turns: { key: string }[] }) {
  return <ThreadScrollLayout turns={turns}>{turn => <article>{turn.key}</article>}</ThreadScrollLayout>;
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
});
