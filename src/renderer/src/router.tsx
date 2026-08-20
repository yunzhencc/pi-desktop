import type { RouterHistory } from '@tanstack/react-router';
import { ConversationPage } from '@renderer/features/conversation';
import { AppearanceSettingsPage, DeepSeekSettingsPage, GeneralSettingsPage, KeyboardShortcutsPage } from '@renderer/features/settings';
import { createHashHistory, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { App } from './App';

export const settingsAppearancePath = '/settings/appearance';
export const settingsGeneralPath = '/settings/general';
export const settingsKeyboardShortcutsPath = '/settings/keyboard-shortcuts';
export const settingsProvidersPath = '/settings/providers';

const rootRoute = createRootRoute({ component: App });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ConversationPage,
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
const providersSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: settingsProvidersPath,
  component: DeepSeekSettingsPage,
});
const routeTree = rootRoute.addChildren([indexRoute, generalSettingsRoute, appearanceSettingsRoute, keyboardShortcutsSettingsRoute, providersSettingsRoute]);

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
