import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import * as React from 'react';
import { readAppearanceTheme } from '../setting/appearance-settings';

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

function NativeThemeSourceSync() {
  const { theme } = useTheme();

  React.useEffect(() => {
    void window.api.windowControls.setThemeSource(readAppearanceTheme(theme ?? 'system'));
  }, [theme]);

  return null;
}
