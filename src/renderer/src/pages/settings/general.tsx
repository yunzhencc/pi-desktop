import { GeneralSettingsPage } from '@renderer/features/settings';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/general')({
  component: GeneralSettingsPage,
});
