import { ShortcutSettingsProvider } from '@renderer/features/app/hotkeys';
import { I18nProvider } from '@renderer/features/app/i18n';
import { ThemeProvider } from '@renderer/features/app/theme';
import { RouterProvider } from '@tanstack/react-router';
import React from 'react';
import { router } from './router';

export function App() {
  React.useEffect(
    () => {
      if (import.meta.env.DEV) {
        void import('react-grab');
      }
    },
    [],
  );

  React.useEffect(() => {
    if (import.meta.env.DEV) {
      void import('react-scan').then(({ scan }) => {
        scan({ enabled: true });
      });
    }
  }, []);

  return (
    <I18nProvider>
      <ThemeProvider>
        <ShortcutSettingsProvider>
          <RouterProvider router={router} />
        </ShortcutSettingsProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
