import { describe, expect, it } from 'vitest';
import { readRightPanelWidth } from './right-panel';

describe('right panel width', () => {
  it('keeps Codex’s regular panel width on wide windows', () => {
    expect(readRightPanelWidth(null, 2700)).toBe(600);
  });
});
