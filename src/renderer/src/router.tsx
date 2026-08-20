import type { RouterHistory } from '@tanstack/react-router';
import { createHashHistory, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

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
