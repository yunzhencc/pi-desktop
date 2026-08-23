// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  findShortcutConflict,
  readShortcutBindings,
  shortcutDefinitions,
  writeShortcutBindings,
} from './shortcut-settings';

describe('shortcut settings', () => {
  it('uses the existing application shortcuts as defaults', () => {
    expect(readShortcutBindings(null)).toEqual({
      focusSettingsSearch: ['Mod+F'],
      goBack: ['Mod+['],
      goForward: ['Mod+]'],
      newConversation: ['Mod+N', 'Mod+Shift+O'],
      openSettings: ['Mod+,'],
      toggleSessionPin: ['Mod+Shift+P'],
      toggleSidebar: ['Mod+B'],
    });
    expect(shortcutDefinitions.map(definition => definition.id)).toEqual([
      'newConversation',
      'toggleSidebar',
      'openSettings',
      'focusSettingsSearch',
      'toggleSessionPin',
      'goBack',
      'goForward',
    ]);
  });

  it('persists only valid custom bindings and falls back for invalid stored data', () => {
    const bindings = {
      focusSettingsSearch: ['Mod+F'],
      goBack: ['Mod+['],
      goForward: ['Mod+]'],
      newConversation: ['Mod+J'],
      openSettings: ['Mod+,'],
      toggleSessionPin: ['Mod+Shift+P'],
      toggleSidebar: [],
    };

    expect(readShortcutBindings(writeShortcutBindings(bindings))).toEqual(bindings);
    expect(readShortcutBindings('{bad json')).toEqual(readShortcutBindings(null));
    expect(readShortcutBindings('{"newConversation":["Not+A+Shortcut"]}')).toEqual(readShortcutBindings(null));
    expect(readShortcutBindings('{"focusSettingsSearch":["Mod+F"],"newConversation":["C"],"openSettings":["Mod+,"],"toggleSessionPin":["Mod+Shift+P"],"toggleSidebar":["Mod+B"]}')).toEqual(readShortcutBindings(null));
  });

  it('keeps existing custom bindings when newer shortcuts are absent from storage', () => {
    expect(readShortcutBindings('{"focusSettingsSearch":["Mod+F"],"newConversation":["Mod+J"],"openSettings":["Mod+,"],"toggleSessionPin":["Mod+Shift+P"],"toggleSidebar":["Mod+B"]}')).toMatchObject({
      goBack: ['Mod+['],
      goForward: ['Mod+]'],
      newConversation: ['Mod+J'],
    });
  });

  it('blocks a shortcut already assigned to another command', () => {
    const bindings = readShortcutBindings(null);

    expect(findShortcutConflict(bindings, 'openSettings', 'mod+b')).toBe('toggleSidebar');
    expect(findShortcutConflict(bindings, 'newConversation', 'Mod+N')).toBeUndefined();
    expect(findShortcutConflict(bindings, 'openSettings', 'Mod+J')).toBeUndefined();
  });
});
