import { KeyboardShortcutsPage } from '@renderer/features/settings';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/keyboard-shortcuts')({
  component: KeyboardShortcutsPage,
});
