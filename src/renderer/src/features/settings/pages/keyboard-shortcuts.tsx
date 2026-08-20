import { useShortcutSettings } from '@renderer/features/app/hotkeys';
import { KeyboardShortcutsView } from '../keyboard-shortcuts-settings';

export function KeyboardShortcutsPage() {
  const { appendShortcut, bindings, removeShortcut, resetAllShortcuts, resetShortcut, updateShortcut } = useShortcutSettings();
  return <KeyboardShortcutsView bindings={bindings} onAppend={appendShortcut} onRemove={removeShortcut} onReset={resetShortcut} onResetAll={resetAllShortcuts} onUpdate={updateShortcut} />;
}
