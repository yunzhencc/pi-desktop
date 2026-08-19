import { describe, expect, it } from 'vitest';
import {
  clampRightPanelWidth,
  getExpandedRightPanelWidth,
  getRightPanelExpansionAfterToggle,
  getRightPanelHeaderWidth,
  getRightPanelWidthMode,
  readRightPanelWidth,
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

  it('uses the entire main-content width when expanded', () => {
    expect(getExpandedRightPanelWidth(648)).toBe(648);
    expect(getExpandedRightPanelWidth(200)).toBe(320);
  });

  it('keeps the full-width panel controls inside the shell after the left toolbar reserve', () => {
    expect(getRightPanelHeaderWidth(true, 900, 900, 124)).toBe(776);
    expect(getRightPanelHeaderWidth(false, 396, 900, 240)).toBe(396);
  });

  it('clears full-width mode when the panel is hidden', () => {
    expect(getRightPanelExpansionAfterToggle(true, true)).toBe(false);
    expect(getRightPanelExpansionAfterToggle(false, false)).toBe(false);
  });

  it('uses Codex’s full mode without a panel divider', () => {
    expect(getRightPanelWidthMode(true)).toBe('full');
    expect(getRightPanelWidthMode(false)).toBe('regular');
  });

  it('stores a ratio so the panel follows the available main content width', () => {
    const stored = writeRightPanelWidth(480, 1000);

    expect(readRightPanelWidth(String(stored), 1200, 800)).toBeCloseTo(577.56, 2);
  });

  it('closes after dragging below Codex’s 160px threshold', () => {
    expect(shouldCloseRightPanel(159)).toBe(true);
    expect(shouldCloseRightPanel(160)).toBe(false);
  });
});
