import type { RouterHistory } from '@tanstack/react-router';
import { createHashHistory, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { App } from './App';
import { AppearanceSettingsPage } from './components/appearance-settings-page';
import { GeneralSettingsPage } from './components/general-settings-page';
import { KeyboardShortcutsPage } from './components/keyboard-shortcuts-page';
import { HomePage } from './pages/home';

export const settingsAppearancePath = '/settings/appearance';
export const settingsGeneralPath = '/settings/general';
export const settingsKeyboardShortcutsPath = '/settings/keyboard-shortcuts';

const rootRoute = createRootRoute({ component: App });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});
const appearanceSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: settingsAppearancePath,
  component: AppearanceSettingsPage,
});
const generalSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: settingsGeneralPath,
  component: GeneralSettingsPage,
});
const keyboardShortcutsSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: settingsKeyboardShortcutsPath,
  component: KeyboardShortcutsPage,
});
const routeTree = rootRoute.addChildren([indexRoute, generalSettingsRoute, appearanceSettingsRoute, keyboardShortcutsSettingsRoute]);

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
