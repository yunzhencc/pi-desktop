import { describe, expect, it } from 'vitest';
import {
  clampRightPanelWidth,
  readRightPanelWidth,
  shouldAutoCloseRightPanel,
  shouldCloseRightPanel,
  writeRightPanelWidth,
} from './right-panel';

describe('right panel width', () => {
  it('keeps Codex’s 320px minimum and 352px main-content reserve', () => {
    expect(clampRightPanelWidth(100, 1000)).toBe(320);
    expect(clampRightPanelWidth(900, 1000)).toBe(648);
  });

  it('uses Codex’s adaptive 600px default when no width was persisted', () => {
    expect(readRightPanelWidth(null, 1000, 800)).toBe(640);
  });

  it('stores a ratio so the panel follows the available main content width', () => {
    const stored = writeRightPanelWidth(480, 1000);

    expect(readRightPanelWidth(String(stored), 1200, 800)).toBeCloseTo(577.56, 2);
  });

  it('uses Codex’s 960px compact breakpoint', () => {
    expect(shouldAutoCloseRightPanel(960)).toBe(true);
    expect(shouldAutoCloseRightPanel(961)).toBe(false);
  });

  it('closes after dragging below Codex’s 160px threshold', () => {
    expect(shouldCloseRightPanel(159)).toBe(true);
    expect(shouldCloseRightPanel(160)).toBe(false);
  });
});
