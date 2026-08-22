// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { messages } from '@renderer/features/app/i18n/locale';
import { ShortcutSettingsProvider } from '@renderer/features/app/shortcuts';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BasicLayout } from './basic';

const { hotkeys, hotkeyOptions, navigate } = vi.hoisted(() => ({ hotkeys: new Map<string, () => void>(), hotkeyOptions: [] as Array<{ ignoreInputs?: boolean }>, navigate: vi.fn() }));

vi.mock('@tanstack/react-hotkeys', () => ({
  useHotkeys: (definitions: Array<{ hotkey: string; callback: () => void }>, options: { ignoreInputs?: boolean }) => {
    hotkeyOptions.push(options);
    definitions.forEach(({ callback, hotkey }) => hotkeys.set(hotkey, callback));
  },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  Outlet: () => null,
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: '/' } }),
}));

function getSessionItem(name: string) {
  const item = screen.getByText(name).closest('[data-slot="item"]');
  if (!(item instanceof HTMLElement))
    throw new Error(`Session item not found: ${name}`);
  return item;
}

type OpaqueSurfaceListener = (opaque: boolean) => void;

let opaqueSurfaceListener: OpaqueSurfaceListener | undefined;

function renderApp(locale: keyof typeof messages = 'en') {
  return render(
    <IntlProvider locale={locale} messages={messages[locale]}>
      <ShortcutSettingsProvider>
        <BasicLayout />
      </ShortcutSettingsProvider>
    </IntlProvider>,
  );
}

describe('app window surface', () => {
  beforeEach(() => {
    hotkeys.clear();
    hotkeyOptions.length = 0;
    navigate.mockReset();
    opaqueSurfaceListener = undefined;
    document.documentElement.classList.remove('electron-opaque');
    Object.defineProperty(window, 'piApp', {
      configurable: true,
      value: {
        composer: {
          onUpdate: () => () => {},
        },
        windowControls: {
          getIsFullscreen: () => Promise.resolve(false),
          getIsOpaqueSurface: () => Promise.resolve(false),
          onFullscreenChange: () => () => {},
          onOpaqueSurfaceChange: (callback: OpaqueSurfaceListener) => {
            opaqueSurfaceListener = callback;
            return () => {};
          },
        },
        workspaces: {
          get: () => Promise.resolve({
            pinnedSessionPaths: [],
            selectedWorkspacePath: '/projects/weather',
            workspaces: [{ displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' }],
          }),
          pick: () => Promise.resolve({ pinnedSessionPaths: [], workspaces: [] }),
          select: () => Promise.resolve({ pinnedSessionPaths: [], workspaces: [] }),
        },
        sessions: {
          list: () => Promise.resolve([]),
          open: () => Promise.resolve({ session: { messages: [], path: '/sessions/default.jsonl' }, workspace: { pinnedSessionPaths: [], workspaces: [] } }),
          setPinned: () => Promise.resolve({ pinnedSessionPaths: [], workspaces: [] }),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('electron-opaque');
  });

  it('uses an opaque document surface while the macOS window is unfocused', async () => {
    renderApp('en');

    await waitFor(() => expect(opaqueSurfaceListener).toBeDefined());

    act(() => opaqueSurfaceListener?.(true));
    expect(document.documentElement.classList.contains('electron-opaque')).toBe(true);

    act(() => opaqueSurfaceListener?.(false));
    expect(document.documentElement.classList.contains('electron-opaque')).toBe(false);
  });

  it('shows Codex’s new-conversation controls outside settings', () => {
    renderApp('zh-CN');

    expect(screen.getByRole('button', { name: '新对话' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '快速聊天' })).toBeTruthy();
  });

  it('shows disabled application-history controls before any navigation', () => {
    renderApp('zh-CN');

    expect(screen.getByRole('button', { name: '后退' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '前进' }).hasAttribute('disabled')).toBe(true);
  });

  it('ignores a slower session navigation after a newer selection', async () => {
    const first = deferred<{ session: { messages: []; path: string }; workspace: { pinnedSessionPaths: []; workspaces: [] } }>();
    const second = deferred<{ session: { messages: []; path: string }; workspace: { pinnedSessionPaths: []; workspaces: [] } }>();
    const openedSessions: string[] = [];
    window.piApp.sessions.list = () => Promise.resolve([
      { firstMessage: 'First', id: 'first', modifiedAt: '2026-08-20T00:00:00.000Z', path: '/sessions/first.jsonl' },
      { firstMessage: 'Second', id: 'second', modifiedAt: '2026-08-20T00:00:00.000Z', path: '/sessions/second.jsonl' },
    ]);
    window.piApp.sessions.open = (_workspacePath, sessionPath) => sessionPath === '/sessions/first.jsonl' ? first.promise : second.promise;
    const onSessionChanged = (event: Event) => openedSessions.push((event as CustomEvent<{ path: string }>).detail.path);
    window.addEventListener('session-changed', onSessionChanged);

    renderApp('en');

    await screen.findByText('First');
    fireEvent.click(getSessionItem('First'));
    fireEvent.click(getSessionItem('Second'));
    await act(async () => second.resolve({ session: { messages: [], path: '/sessions/second.jsonl' }, workspace: { pinnedSessionPaths: [], workspaces: [] } }));
    await act(async () => first.resolve({ session: { messages: [], path: '/sessions/first.jsonl' }, workspace: { pinnedSessionPaths: [], workspaces: [] } }));

    expect(openedSessions).toEqual(['/sessions/second.jsonl']);
    window.removeEventListener('session-changed', onSessionChanged);
  });

  it('shows projects and an add-project entry in the sidebar', async () => {
    renderApp('en');

    await waitFor(() => expect(screen.getByText('weather')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Add project' })).toBeTruthy();
  });

  it('starts a new conversation after navigation reaches the home page', async () => {
    const onNewConversation = vi.fn();
    window.addEventListener('new-conversation', onNewConversation);
    navigate.mockImplementation(() => {
      expect(onNewConversation).not.toHaveBeenCalled();
      return Promise.resolve();
    });

    renderApp('en');
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));

    await waitFor(() => expect(onNewConversation).toHaveBeenCalledOnce());
    window.removeEventListener('new-conversation', onNewConversation);
  });

  it('opens settings with Codex’s shortcut', () => {
    renderApp('en');

    hotkeys.get('Mod+,')?.();
    expect(navigate).toHaveBeenCalledWith({ to: '/settings/general' });
  });

  it('toggles the current session pin with its shortcut', async () => {
    const session = { firstMessage: 'Forecast', id: 'session-1', modifiedAt: '2026-08-20T00:00:00.000Z', path: '/sessions/forecast.jsonl' };
    const open = vi.fn(() => Promise.resolve({ session: { messages: [], path: session.path }, workspace: { pinnedSessionPaths: [], workspaces: [] } }));
    window.piApp.sessions.list = () => Promise.resolve([session]);
    window.piApp.sessions.open = open;
    window.piApp.sessions.setPinned = vi.fn(() => Promise.resolve({ pinnedSessionPaths: [session.path], workspaces: [] }));
    renderApp('en');

    await screen.findByText('Forecast');
    fireEvent.click(getSessionItem('Forecast'));
    await waitFor(() => expect(open).toHaveBeenCalled());
    hotkeys.get('Mod+Shift+P')?.();

    await waitFor(() => expect(window.piApp.sessions.setPinned).toHaveBeenCalledWith('/projects/weather', session.path, true));
  });

  it('does not register global shortcuts for focused inputs', () => {
    renderApp('en');

    expect(hotkeyOptions[0]).toMatchObject({ ignoreInputs: true });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
