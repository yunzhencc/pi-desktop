import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createAppRouter, settingsAppearancePath, settingsGeneralPath, settingsKeyboardShortcutsPath } from './router';

describe('app routes', () => {
  it('builds General and Appearance settings routes', () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }));

    expect(settingsAppearancePath).toBe('/settings/appearance');
    expect(router.buildLocation({ to: settingsAppearancePath }).pathname).toBe(settingsAppearancePath);
    expect(settingsGeneralPath).toBe('/settings/general');
    expect(router.buildLocation({ to: settingsGeneralPath }).pathname).toBe(settingsGeneralPath);
    expect(settingsKeyboardShortcutsPath).toBe('/settings/keyboard-shortcuts');
    expect(router.buildLocation({ to: settingsKeyboardShortcutsPath }).pathname).toBe(settingsKeyboardShortcutsPath);
  });
});
