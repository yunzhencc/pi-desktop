import type { ReactNode } from 'react';
import type { ShortcutBindings, ShortcutId } from './shortcut-settings';
import { createContext, use, useMemo, useState } from 'react';
import {
  getDefaultShortcutBindings,
  readShortcutBindings,
  SHORTCUT_STORAGE_KEY,
  writeShortcutBindings,
} from './shortcut-settings';

interface ShortcutSettingsContextValue {
  appendShortcut: (commandId: ShortcutId, hotkey: string) => void;
  bindings: ShortcutBindings;
  removeShortcut: (commandId: ShortcutId, index: number) => void;
  resetAllShortcuts: () => void;
  resetShortcut: (commandId: ShortcutId) => void;
  updateShortcut: (commandId: ShortcutId, index: number, hotkey: string) => void;
}

const ShortcutSettingsContext = createContext<ShortcutSettingsContextValue | null>(null);

export function ShortcutSettingsProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState(() => readShortcutBindings(localStorage.getItem(SHORTCUT_STORAGE_KEY)));
  const updateBindings = (updater: (current: ShortcutBindings) => ShortcutBindings) => {
    setBindings((current) => {
      const next = updater(current);
      localStorage.setItem(SHORTCUT_STORAGE_KEY, writeShortcutBindings(next));
      return next;
    });
  };
  const value = useMemo<ShortcutSettingsContextValue>(() => ({
    appendShortcut: (commandId, hotkey) => updateBindings(current => ({ ...current, [commandId]: [...current[commandId], hotkey] })),
    bindings,
    removeShortcut: (commandId, index) => updateBindings(current => ({
      ...current,
      [commandId]: current[commandId].filter((_, bindingIndex) => bindingIndex !== index),
    })),
    resetAllShortcuts: () => updateBindings(() => getDefaultShortcutBindings()),
    resetShortcut: commandId => updateBindings((current) => {
      const defaults = getDefaultShortcutBindings();
      return { ...current, [commandId]: defaults[commandId] };
    }),
    updateShortcut: (commandId, index, hotkey) => updateBindings(current => ({
      ...current,
      [commandId]: current[commandId].map((binding, bindingIndex) => bindingIndex === index ? hotkey : binding),
    })),
  }), [bindings]);

  return <ShortcutSettingsContext value={value}>{children}</ShortcutSettingsContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShortcutSettings() {
  const value = use(ShortcutSettingsContext);
  if (!value)
    throw new Error('useShortcutSettings must be used within ShortcutSettingsProvider');
  return value;
}
