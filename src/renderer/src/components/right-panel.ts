export const RIGHT_PANEL_DEFAULT_WIDTH = 600;
export const RIGHT_PANEL_MIN_WIDTH = 320;
export const RIGHT_PANEL_MAIN_CONTENT_RESERVE = 352;
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

export function getExpandedRightPanelWidth(mainContentWidth: number): number {
  return Math.max(RIGHT_PANEL_MIN_WIDTH, mainContentWidth);
}

export function getRightPanelHeaderWidth(
  isExpanded: boolean,
  panelWidth: number,
  shellWidth: number,
  headerLeftWidth: number,
): number {
  return isExpanded ? Math.max(0, shellWidth - headerLeftWidth) : panelWidth;
}

export function getRightPanelExpansionAfterToggle(isOpen: boolean, isExpanded: boolean): boolean {
  return isOpen ? false : isExpanded;
}

function getDefaultRightPanelWidth(mainContentWidth: number, shellHeight: number): number {
  return Math.max(
    RIGHT_PANEL_MIN_WIDTH,
    Math.min(shellHeight * 1.6, mainContentWidth - 500),
    Math.min(640, mainContentWidth - RIGHT_PANEL_MAIN_CONTENT_RESERVE),
  );
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
  shellHeight: number,
): number {
  const storedValue = storedWidth === null ? Number.NaN : Number(storedWidth);
  const ratio = Number.isFinite(storedValue)
    ? storedValue <= 1 ? Math.max(0, Math.min(1, storedValue)) : writeRightPanelWidth(storedValue, mainContentWidth)
    : writeRightPanelWidth(getDefaultRightPanelWidth(mainContentWidth, shellHeight), mainContentWidth);

  const maximum = getRightPanelMaximum(mainContentWidth);
  return clampRightPanelWidth(
    RIGHT_PANEL_MIN_WIDTH + ratio * (maximum - RIGHT_PANEL_MIN_WIDTH),
    mainContentWidth,
  );
}
