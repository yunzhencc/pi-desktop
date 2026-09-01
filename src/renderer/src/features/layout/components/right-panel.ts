export const RIGHT_PANEL_MIN_WIDTH = 320;
const RIGHT_PANEL_DEFAULT_WIDTH = 600;
const RIGHT_PANEL_MAIN_CONTENT_RESERVE = 352;

export function shouldCloseRightPanel(width: number): boolean {
  return width < RIGHT_PANEL_MIN_WIDTH / 2;
}

function getRightPanelMaximum(mainContentWidth: number): number {
  return Math.max(RIGHT_PANEL_MIN_WIDTH, mainContentWidth - RIGHT_PANEL_MAIN_CONTENT_RESERVE);
}

export function clampRightPanelWidth(width: number, mainContentWidth: number): number {
  return Math.max(
    RIGHT_PANEL_MIN_WIDTH,
    Math.min(width, getRightPanelMaximum(mainContentWidth)),
  );
}

function getDefaultRightPanelWidth(mainContentWidth: number): number {
  return clampRightPanelWidth(RIGHT_PANEL_DEFAULT_WIDTH, mainContentWidth);
}

export function writeRightPanelWidth(width: number, mainContentWidth: number): number {
  const maximum = getRightPanelMaximum(mainContentWidth);
  return maximum === RIGHT_PANEL_MIN_WIDTH
    ? 0
    : (clampRightPanelWidth(width, mainContentWidth) - RIGHT_PANEL_MIN_WIDTH)
      / (maximum - RIGHT_PANEL_MIN_WIDTH);
}

export function readRightPanelWidth(
  storedWidth: string | null,
  mainContentWidth: number,
): number {
  const storedValue = storedWidth === null ? Number.NaN : Number(storedWidth);
  const ratio = Number.isFinite(storedValue)
    ? storedValue <= 1 ? Math.max(0, Math.min(1, storedValue)) : writeRightPanelWidth(storedValue, mainContentWidth)
    : writeRightPanelWidth(getDefaultRightPanelWidth(mainContentWidth), mainContentWidth);

  const maximum = getRightPanelMaximum(mainContentWidth);
  return clampRightPanelWidth(
    RIGHT_PANEL_MIN_WIDTH + ratio * (maximum - RIGHT_PANEL_MIN_WIDTH),
    mainContentWidth,
  );
}
