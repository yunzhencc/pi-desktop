export interface ThreadTurn {
  key: string;
  estimatedHeightPx?: number;
}

export interface ThreadLayout {
  bottomOffsetsPx: number[];
  heightsPx: number[];
  totalHeightPx: number;
  turnIndexByKey: Map<string, number>;
  turnKeys: string[];
}

export interface ThreadRange {
  endIndex: number;
  startIndex: number;
}

export function buildThreadLayout(turns: ThreadTurn[], measuredHeights: ReadonlyMap<string, number>, gapPx: number, defaultHeightPx: number): ThreadLayout {
  const heightsPx = turns.map(turn => measuredHeights.get(turn.key) ?? turn.estimatedHeightPx ?? defaultHeightPx);
  const totalHeightPx = heightsPx.reduce((total, height) => total + height, Math.max(0, turns.length - 1) * gapPx);
  let topOffsetPx = 0;
  const bottomOffsetsPx = heightsPx.map((height) => {
    const bottomOffsetPx = totalHeightPx - topOffsetPx - height;
    topOffsetPx += height + gapPx;
    return bottomOffsetPx;
  });

  return {
    bottomOffsetsPx,
    heightsPx,
    totalHeightPx,
    turnIndexByKey: new Map(turns.map((turn, index) => [turn.key, index])),
    turnKeys: turns.map(turn => turn.key),
  };
}

export function visibleThreadRange({ distanceFromBottomPx, layout, overscanCount, viewportHeightPx }: {
  distanceFromBottomPx: number;
  layout: ThreadLayout;
  overscanCount: number;
  viewportHeightPx: number;
}): ThreadRange {
  const { totalHeightPx, turnKeys } = layout;
  if (turnKeys.length === 0)
    return { endIndex: 0, startIndex: 0 };

  const distance = Math.min(Math.max(0, distanceFromBottomPx), totalHeightPx);
  const viewportEnd = Math.min(totalHeightPx, distance + Math.max(0, viewportHeightPx));
  const startIndex = firstIndex(layout, index => layout.bottomOffsetsPx[index]! <= viewportEnd);
  const endIndex = firstIndex(layout, index => layout.bottomOffsetsPx[index]! + layout.heightsPx[index]! <= distance);

  return {
    endIndex: Math.min(turnKeys.length, Math.max(startIndex + 1, endIndex) + overscanCount),
    startIndex: Math.max(0, startIndex - overscanCount),
  };
}

export function preserveAnchorDistance({ anchorKey, distanceFromBottomPx, nextLayout, previousLayout }: {
  anchorKey: string;
  distanceFromBottomPx: number;
  nextLayout: ThreadLayout;
  previousLayout: ThreadLayout;
}): number | null {
  const previousIndex = previousLayout.turnIndexByKey.get(anchorKey);
  const nextIndex = nextLayout.turnIndexByKey.get(anchorKey);
  if (previousIndex == null || nextIndex == null)
    return null;

  const previousTopDistance = previousLayout.bottomOffsetsPx[previousIndex]! + previousLayout.heightsPx[previousIndex]!;
  const nextTopDistance = nextLayout.bottomOffsetsPx[nextIndex]! + nextLayout.heightsPx[nextIndex]!;
  return Math.max(0, distanceFromBottomPx + nextTopDistance - previousTopDistance);
}

function firstIndex(layout: ThreadLayout, matches: (index: number) => boolean) {
  let high = layout.turnKeys.length;
  let low = 0;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (matches(middle))
      high = middle;
    else
      low = middle + 1;
  }
  return low;
}
