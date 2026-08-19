// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './provider';

const setThemeSource = vi.fn();

describe('theme provider', () => {
  beforeEach(() => {
    localStorage.setItem('pi-desktop-theme', 'light');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        addEventListener: () => {},
        addListener: () => {},
        matches: false,
        removeEventListener: () => {},
        removeListener: () => {},
      }),
    });
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { windowControls: { setThemeSource } },
    });
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    setThemeSource.mockReset();
  });

  it('syncs a persisted light theme to the native window', async () => {
    render(<ThemeProvider><div /></ThemeProvider>);

    await waitFor(() => expect(setThemeSource).toHaveBeenCalledWith('light'));
  });
});
