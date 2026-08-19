import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import * as React from 'react';
import { readAppearanceTheme } from '../../components/appearance-settings';

interface ThemeProviderProps {
  children: React.ReactNode;
};

export function ThemeProvider(props: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      storageKey="pi-desktop-theme"
    >
      <NativeThemeSourceSync />
      {props.children}
    </NextThemesProvider>
  );
}

export function useOverlayScrollbarsTheme() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? 'os-theme-dark' : 'os-theme-light';
}

function NativeThemeSourceSync() {
  const { theme } = useTheme();

  React.useEffect(() => {
    void window.api.windowControls.setThemeSource(readAppearanceTheme(theme ?? 'system'));
  }, [theme]);

  return null;
}
