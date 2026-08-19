// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTheme } from 'next-themes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useOverlayScrollbarsTheme } from './provider';

const setThemeSource = vi.fn();

function ScrollbarThemeControl() {
  const { setTheme } = useTheme();
  return (
    <>
      <output>{useOverlayScrollbarsTheme()}</output>
      <button onClick={() => setTheme('dark')} type="button">Dark</button>
    </>
  );
}

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

  it('switches the overlay scrollbar theme with the app theme', async () => {
    render(<ThemeProvider><ScrollbarThemeControl /></ThemeProvider>);

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('os-theme-light'));
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('os-theme-dark'));
  });
});
