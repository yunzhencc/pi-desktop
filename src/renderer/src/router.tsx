import type { RouterHistory } from '@tanstack/react-router';
import { createHashHistory, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { App } from './App';
import { AppearanceSettingsPage } from './components/appearance-settings-page';

export const settingsAppearancePath = '/settings/appearance';

const rootRoute = createRootRoute({ component: App });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => null,
});
const appearanceSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: settingsAppearancePath,
  component: AppearanceSettingsPage,
});
const routeTree = rootRoute.addChildren([indexRoute, appearanceSettingsRoute]);

export function createAppRouter(history: RouterHistory = getDefaultHistory()) {
  return createRouter({ history, routeTree });
}

export const router = createAppRouter();

function getDefaultHistory(): RouterHistory {
  return typeof window === 'undefined'
    ? createMemoryHistory({ initialEntries: ['/'] })
    : createHashHistory();
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
