import { describe, expect, it } from 'vitest';
import {
  canGoBack,
  canGoForward,
  createAppHistory,
  currentAppLocation,
  moveAppHistory,
  pushAppHistory,
} from './app-history';

describe('application history', () => {
  it('restores a task after navigating back from settings', () => {
    const task = { kind: 'session' as const, sessionPath: '/sessions/weather.jsonl', workspacePath: '/projects/weather' };
    const settings = { kind: 'settings' as const, path: '/settings/appearance' };
    const history = pushAppHistory(createAppHistory(task), settings);

    expect(canGoBack(history)).toBe(true);
    expect(canGoForward(history)).toBe(false);
    expect(currentAppLocation(moveAppHistory(history, -1))).toEqual(task);
  });

  it('drops the forward branch after a new navigation', () => {
    const task = { kind: 'session' as const, sessionPath: '/sessions/weather.jsonl', workspacePath: '/projects/weather' };
    const settings = { kind: 'settings' as const, path: '/settings/appearance' };
    const shortcutSettings = { kind: 'settings' as const, path: '/settings/keyboard-shortcuts' };
    const history = pushAppHistory(moveAppHistory(pushAppHistory(createAppHistory(task), settings), -1), shortcutSettings);

    expect(currentAppLocation(history)).toEqual(shortcutSettings);
    expect(canGoForward(history)).toBe(false);
    expect(moveAppHistory(history, 1)).toEqual(history);
  });
});
