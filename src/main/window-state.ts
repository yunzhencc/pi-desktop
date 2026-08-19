import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const PRIMARY_WINDOW_MINIMUM_SIZE = { width: 480, height: 600 };

const PRIMARY_WINDOW_DEFAULT_SIZE = { width: 1280, height: 820 };

export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrimaryWindowState extends DisplayBounds {
  isMaximized: boolean;
}

export function getPrimaryWindowBounds(
  savedState: PrimaryWindowState | null,
  displayBounds: DisplayBounds[],
  platform: NodeJS.Platform,
  primaryDisplayBounds = displayBounds[0],
): Partial<PrimaryWindowState> {
  if (savedState) {
    const restoredState = {
      ...savedState,
      width: Math.max(savedState.width, PRIMARY_WINDOW_MINIMUM_SIZE.width),
      height: Math.max(savedState.height, PRIMARY_WINDOW_MINIMUM_SIZE.height),
    };
    const isVisible = displayBounds.some(display => (
      restoredState.x < display.x + display.width
      && restoredState.x + restoredState.width > display.x
      && restoredState.y < display.y + display.height
      && restoredState.y + restoredState.height > display.y
    ));
    if (isVisible)
      return restoredState;
  }

  if (platform !== 'win32' || !primaryDisplayBounds)
    return PRIMARY_WINDOW_DEFAULT_SIZE;

  const display = primaryDisplayBounds;
  const width = Math.max(PRIMARY_WINDOW_MINIMUM_SIZE.width, Math.min(PRIMARY_WINDOW_DEFAULT_SIZE.width, Math.round(display.width * 0.85)));
  const height = Math.max(PRIMARY_WINDOW_MINIMUM_SIZE.height, Math.min(PRIMARY_WINDOW_DEFAULT_SIZE.height, Math.round(display.height * 0.8)));
  return {
    x: display.x + Math.round((display.width - width) / 2),
    y: display.y + Math.round((display.height - height) / 2),
    width,
    height,
  };
}

export function readPrimaryWindowState(filePath: string): PrimaryWindowState | null {
  try {
    const value: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!isPrimaryWindowState(value))
      return null;
    return value;
  }
  catch {
    return null;
  }
}

export function writePrimaryWindowState(filePath: string, state: PrimaryWindowState): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(state));
}

function isPrimaryWindowState(value: unknown): value is PrimaryWindowState {
  if (!value || typeof value !== 'object')
    return false;
  const state = value as Record<string, unknown>;
  return ['x', 'y', 'width', 'height'].every(key => typeof state[key] === 'number' && Number.isFinite(state[key]))
    && typeof state.isMaximized === 'boolean';
}
