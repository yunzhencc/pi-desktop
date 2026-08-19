import { normalizeHotkey, parseHotkey, validateHotkey } from '@tanstack/react-hotkeys';

export const SHORTCUT_STORAGE_KEY = 'pi-desktop:shortcut-bindings:v1';

export const shortcutDefinitions = [
  { description: 'shortcut.newConversation.description', id: 'newConversation', title: 'shortcut.newConversation.title' },
  { description: 'shortcut.toggleSidebar.description', id: 'toggleSidebar', title: 'shortcut.toggleSidebar.title' },
  { description: 'shortcut.openSettings.description', id: 'openSettings', title: 'shortcut.openSettings.title' },
  { description: 'shortcut.focusSettingsSearch.description', id: 'focusSettingsSearch', title: 'shortcut.focusSettingsSearch.title' },
] as const;

export type ShortcutId = (typeof shortcutDefinitions)[number]['id'];
export type ShortcutBindings = Record<ShortcutId, string[]>;

const defaultShortcutBindings: ShortcutBindings = {
  focusSettingsSearch: ['Mod+F'],
  newConversation: ['Mod+N', 'Mod+Shift+O'],
  openSettings: ['Mod+,'],
  toggleSidebar: ['Mod+B'],
};

export function readShortcutBindings(value: string | null): ShortcutBindings {
  if (!value)
    return cloneDefaults();

  try {
    const parsed = JSON.parse(value) as Partial<ShortcutBindings>;
    if (!parsed || typeof parsed !== 'object' || !shortcutDefinitions.every(({ id }) => isValidBindingList(parsed[id]))) {
      return cloneDefaults();
    }

    return Object.fromEntries(shortcutDefinitions.map(({ id }) => [id, parsed[id]!.map(normalizeHotkey)])) as ShortcutBindings;
  }
  catch {
    return cloneDefaults();
  }
}

export function writeShortcutBindings(bindings: ShortcutBindings) {
  return JSON.stringify(bindings);
}

export function findShortcutConflict(bindings: ShortcutBindings, commandId: ShortcutId, hotkey: string) {
  const normalized = normalizeHotkey(hotkey);
  return shortcutDefinitions.find(({ id }) => bindings[id].some(binding => normalizeHotkey(binding) === normalized))?.id;
}

export function hasCustomShortcutBindings(bindings: ShortcutBindings) {
  return writeShortcutBindings(bindings) !== writeShortcutBindings(defaultShortcutBindings);
}

export function isShortcutAllowed(hotkey: string) {
  const { alt, ctrl, meta } = parseHotkey(hotkey);
  return alt || ctrl || meta;
}

export function getDefaultShortcutBindings() {
  return cloneDefaults();
}

function cloneDefaults(): ShortcutBindings {
  return Object.fromEntries(shortcutDefinitions.map(({ id }) => [id, [...defaultShortcutBindings[id]]])) as ShortcutBindings;
}

function isValidBindingList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(binding => typeof binding === 'string' && validateHotkey(binding).valid && isShortcutAllowed(binding));
}
