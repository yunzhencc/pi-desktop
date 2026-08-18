export const SIDEBAR_DEFAULT_WIDTH = 275;
export const SIDEBAR_MAX_WIDTH = 520;
export const SIDEBAR_MIN_WIDTH = 240;

export function shouldCollapseSidebar(width: number): boolean {
  return width < SIDEBAR_MIN_WIDTH / 2;
}

export function clampSidebarWidth(width: number, viewportWidth: number): number {
  return Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(width, SIDEBAR_MAX_WIDTH, viewportWidth - SIDEBAR_MIN_WIDTH),
  );
}

export function readSidebarWidth(storedWidth: string | null, viewportWidth: number): number {
  const width = storedWidth === null ? Number.NaN : Number(storedWidth);
  return clampSidebarWidth(
    Number.isFinite(width) ? width : SIDEBAR_DEFAULT_WIDTH,
    viewportWidth,
  );
}
