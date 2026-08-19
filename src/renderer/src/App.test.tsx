// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { messages } from './providers/i18n/locale';

const { hotkeys, hotkeyOptions, navigate } = vi.hoisted(() => ({ hotkeys: new Map<string, () => void>(), hotkeyOptions: [] as Array<{ ignoreInputs?: boolean }>, navigate: vi.fn() }));

vi.mock('@tanstack/react-hotkeys', () => ({
  useHotkeys: (definitions: Array<{ hotkey: string; callback: () => void }>, options: { ignoreInputs?: boolean }) => {
    hotkeyOptions.push(options);
    definitions.forEach(({ callback, hotkey }) => hotkeys.set(hotkey, callback));
  },
}));
vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: '/' } }),
}));

type OpaqueSurfaceListener = (opaque: boolean) => void;

let opaqueSurfaceListener: OpaqueSurfaceListener | undefined;

describe('app window surface', () => {
  beforeEach(() => {
    hotkeys.clear();
    hotkeyOptions.length = 0;
    navigate.mockReset();
    opaqueSurfaceListener = undefined;
    document.documentElement.classList.remove('electron-opaque');
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
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
            selectedWorkspacePath: '/projects/weather',
            workspaces: [{ displayName: 'weather', lastOpenedAt: '2026-08-19T00:00:00.000Z', path: '/projects/weather' }],
          }),
          pick: () => Promise.resolve({ workspaces: [] }),
          select: () => Promise.resolve({ workspaces: [] }),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('electron-opaque');
  });

  it('uses an opaque document surface while the macOS window is unfocused', async () => {
    render(
      <IntlProvider
        locale="en"
        messages={messages.en}
      >
        <App />
      </IntlProvider>,
    );

    await waitFor(() => expect(opaqueSurfaceListener).toBeDefined());

    act(() => opaqueSurfaceListener?.(true));
    expect(document.documentElement.classList.contains('electron-opaque')).toBe(true);

    act(() => opaqueSurfaceListener?.(false));
    expect(document.documentElement.classList.contains('electron-opaque')).toBe(false);
  });

  it('shows Codex’s new-conversation controls outside settings', () => {
    render(
      <IntlProvider
        locale="zh-CN"
        messages={messages['zh-CN']}
      >
        <App />
      </IntlProvider>,
    );

    expect(screen.getByRole('button', { name: '新对话' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '快速聊天' })).toBeTruthy();
  });

  it('shows projects and an add-project entry in the sidebar', async () => {
    render(
      <IntlProvider locale="en" messages={messages.en}>
        <App />
      </IntlProvider>,
    );

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

    render(
      <IntlProvider locale="en" messages={messages.en}>
        <App />
      </IntlProvider>,
    );
    screen.getByRole('button', { name: 'New chat' }).click();

    await waitFor(() => expect(onNewConversation).toHaveBeenCalledOnce());
    window.removeEventListener('new-conversation', onNewConversation);
  });

  it('opens settings with Codex’s shortcut', () => {
    render(
      <IntlProvider locale="en" messages={messages.en}>
        <App />
      </IntlProvider>,
    );

    hotkeys.get('Mod+,')?.();
    expect(navigate).toHaveBeenCalledWith({ to: '/settings/general' });
  });

  it('does not register global shortcuts for focused inputs', () => {
    render(
      <IntlProvider locale="en" messages={messages.en}>
        <App />
      </IntlProvider>,
    );

    expect(hotkeyOptions[0]).toMatchObject({ ignoreInputs: true });
  });
});
