import type { SettingsPath } from '@renderer/features/settings';

export type AppLocation
  = | { kind: 'home' }
    | { kind: 'settings'; path: SettingsPath }
    | { kind: 'session'; sessionPath: string; workspacePath: string };

export interface AppHistory {
  entries: AppLocation[];
  index: number;
}

export function createAppHistory(initial: AppLocation): AppHistory {
  return { entries: [initial], index: 0 };
}

export function currentAppLocation(history: AppHistory): AppLocation {
  return history.entries[history.index];
}

export function canGoBack(history: AppHistory) {
  return history.index > 0;
}

export function canGoForward(history: AppHistory) {
  return history.index < history.entries.length - 1;
}

export function moveAppHistory(history: AppHistory, direction: -1 | 1): AppHistory {
  const index = history.index + direction;
  return index < 0 || index >= history.entries.length ? history : { ...history, index };
}

export function pushAppHistory(history: AppHistory, location: AppLocation): AppHistory {
  if (sameLocation(currentAppLocation(history), location))
    return history;
  return { entries: [...history.entries.slice(0, history.index + 1), location], index: history.index + 1 };
}

function sameLocation(left: AppLocation, right: AppLocation) {
  return left.kind === right.kind
    && (left.kind !== 'settings' || right.kind !== 'settings' || left.path === right.path)
    && (left.kind !== 'session' || right.kind !== 'session' || (left.workspacePath === right.workspacePath && left.sessionPath === right.sessionPath));
}
