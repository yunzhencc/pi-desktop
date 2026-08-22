// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const threadStyles = readFileSync(resolve(process.cwd(), 'src/renderer/src/features/conversation/components/thread-scroll-layout/style.css'), 'utf8');

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe('thread scroll layout styles', () => {
  it('matches Codex native thread scroll host behavior', () => {
    const style = document.createElement('style');
    style.textContent = threadStyles;
    document.head.append(style);

    const host = document.createElement('div');
    host.className = 'thread-scroll-layout';
    host.style.setProperty('--thread-scroll-padding-bottom', '124px');
    document.body.append(host);

    const computed = getComputedStyle(host);
    expect(computed.position).toBe('absolute');
    expect(computed.inset).toBe('46px 0 0');
    expect(computed.overflowX).toBe('hidden');
    expect(computed.overflowY).toBe('auto');
    expect(computed.overflowAnchor).toBe('none');
    expect(computed.scrollbarGutter).toBe('stable both-edges');
    expect(computed.scrollbarColor).toBe('var(--border) transparent');
    expect(threadStyles).toContain('.thread-scroll-layout:hover');
    expect(threadStyles).toContain('color-mix(in srgb, var(--foreground) 22%, transparent) transparent');
  });
});
