import { BasicLayout } from '@renderer/features/layout';
import { createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: BasicLayout,
});
