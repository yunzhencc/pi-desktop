import { describe, expect, it } from 'vitest';
import { getToolbarInset } from './toolbar-inset';

describe('getToolbarInset', () => {
  it('uses Codex’s titlebar-safe inset', () => {
    expect(getToolbarInset({ isFullscreen: true, isMac: true })).toBe(8);
    expect(getToolbarInset({ isFullscreen: false, isMac: true })).toBe(92);
    expect(getToolbarInset({ isFullscreen: false, isMac: false })).toBe(8);
  });
});
