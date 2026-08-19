// @vitest-environment jsdom

import { act, render, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('@tanstack/react-hotkeys', () => ({ useHotkey: () => {} }));
vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
  useNavigate: () => vi.fn(),
  useRouterState: () => false,
}));

type OpaqueSurfaceListener = (opaque: boolean) => void;

let opaqueSurfaceListener: OpaqueSurfaceListener | undefined;

describe('app window surface', () => {
  beforeEach(() => {
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
      },
    });
  });

  afterEach(() => {
    document.documentElement.classList.remove('electron-opaque');
  });

  it('uses an opaque document surface while the macOS window is unfocused', async () => {
    render(
      <IntlProvider
        locale="en"
        messages={{
          'panel.show': 'Show panel',
          'panel.toggle': 'Toggle panel',
          'profile.logOut': 'Log out',
          'profile.settings': 'Settings',
          'resize.sidebar': 'Resize sidebar',
          'sidebar.hide': 'Hide sidebar',
          'sidebar.toggle': 'Toggle sidebar',
        }}
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
});
