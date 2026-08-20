interface ToolbarInsetOptions {
  isFullscreen: boolean;
  isMac: boolean;
}

export function getToolbarInset({ isFullscreen, isMac }: ToolbarInsetOptions): number {
  return isMac && !isFullscreen ? 92 : 8;
}
