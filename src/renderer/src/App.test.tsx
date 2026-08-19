// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { messages } from './providers/i18n/locale';

vi.mock('@tanstack/react-hotkeys', () => ({ useHotkey: () => {} }));
vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: '/' } }),
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
});
