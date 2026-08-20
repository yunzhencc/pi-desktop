import { ProvidersPage } from '@renderer/features/settings';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/providers')({
  component: ProvidersPage,
});
