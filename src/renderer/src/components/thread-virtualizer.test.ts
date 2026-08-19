import { describe, expect, it } from 'vitest';
import { buildThreadLayout, preserveAnchorDistance, visibleThreadRange } from './thread-virtualizer';

describe('thread virtualizer', () => {
  it('uses measured heights and returns an overscanned bottom-anchored range', () => {
    const layout = buildThreadLayout(
      [{ key: 'one' }, { key: 'two' }, { key: 'three' }],
      new Map([['two', 80]]),
      10,
      40,
    );

    expect(layout.totalHeightPx).toBe(180);
    expect(visibleThreadRange({ distanceFromBottomPx: 0, layout, overscanCount: 1, viewportHeightPx: 50 })).toEqual({ endIndex: 3, startIndex: 0 });
  });

  it('keeps the anchor turn at the same visual position after a height change', () => {
    const previous = buildThreadLayout([{ key: 'one' }, { key: 'two' }], new Map(), 8, 40);
    const next = buildThreadLayout([{ key: 'one' }, { key: 'two' }], new Map([['two', 80]]), 8, 40);

    expect(preserveAnchorDistance({ anchorKey: 'one', distanceFromBottomPx: 12, nextLayout: next, previousLayout: previous })).toBe(52);
  });
});
