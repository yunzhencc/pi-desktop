import { AppearanceSettingsPage } from '@renderer/features/settings';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/appearance')({
  component: AppearanceSettingsPage,
});
