import { describe, expect, it } from 'vitest';
import { getPrimaryWindowBounds } from './window-state';

describe('getPrimaryWindowBounds', () => {
  const displays = [
    { x: 0, y: 0, width: 1440, height: 900 },
    { x: 1440, y: 0, width: 1440, height: 900 },
  ];

  it('restores saved bounds that overlap an available display', () => {
    expect(getPrimaryWindowBounds({ x: 1300, y: 40, width: 600, height: 700, isMaximized: true }, displays, 'darwin')).toEqual({
      x: 1300,
      y: 40,
      width: 600,
      height: 700,
      isMaximized: true,
    });
  });

  it('uses the Codex default when saved bounds are off every display', () => {
    expect(getPrimaryWindowBounds({ x: 4000, y: 0, width: 900, height: 670, isMaximized: false }, displays, 'darwin')).toEqual({
      width: 1280,
      height: 820,
    });
  });

  it('clamps restored bounds to the Codex minimum size', () => {
    expect(getPrimaryWindowBounds({ x: 0, y: 0, width: 300, height: 400, isMaximized: false }, displays, 'darwin')).toEqual({
      x: 0,
      y: 0,
      width: 480,
      height: 600,
      isMaximized: false,
    });
  });

  it('uses the Windows work-area default and centers it', () => {
    expect(getPrimaryWindowBounds(null, displays, 'win32')).toEqual({
      x: 108,
      y: 90,
      width: 1224,
      height: 720,
    });
  });

  it('uses the primary display rather than the display-list order on Windows', () => {
    expect(getPrimaryWindowBounds(null, displays, 'win32', displays[1])).toEqual({
      x: 1548,
      y: 90,
      width: 1224,
      height: 720,
    });
  });
});
