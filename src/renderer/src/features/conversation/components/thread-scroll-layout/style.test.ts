// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const threadStyles = readFileSync(resolve(process.cwd(), 'src/renderer/src/features/conversation/components/thread-scroll-layout/style.css'), 'utf8');
const overlayStyles = readFileSync(resolve(process.cwd(), 'node_modules/overlayscrollbars/styles/overlayscrollbars.css'), 'utf8');

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe('thread scroll layout styles', () => {
  it('keeps the OverlayScrollbars host pinned between the header and composer', () => {
    for (const styles of [threadStyles, overlayStyles]) {
      const style = document.createElement('style');
      style.textContent = styles;
      document.head.append(style);
    }

    const host = document.createElement('div');
    host.className = 'thread-scroll-layout';
    host.dataset.overlayscrollbars = 'host';
    document.body.append(host);

    expect(getComputedStyle(host).position).toBe('absolute');
  });
});
