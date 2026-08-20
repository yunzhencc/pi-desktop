import { describe, expect, it } from 'vitest';
import { clampSidebarWidth, readSidebarWidth, shouldCollapseSidebar } from '../utils';

describe('clampSidebarWidth', () => {
  it('matches Codex sidebar bounds', () => {
    expect(clampSidebarWidth(100, 1000)).toBe(240);
    expect(clampSidebarWidth(600, 1000)).toBe(520);
    expect(clampSidebarWidth(500, 600)).toBe(360);
  });
});

describe('readSidebarWidth', () => {
  it('uses Codex’s 275px default when no width was persisted', () => {
    expect(readSidebarWidth(null, 1000)).toBe(275);
  });
});

describe('sidebar collapse threshold', () => {
  it('matches Codex’s 120px drag-to-collapse threshold', () => {
    expect(shouldCollapseSidebar(119)).toBe(true);
    expect(shouldCollapseSidebar(120)).toBe(false);
  });
});
