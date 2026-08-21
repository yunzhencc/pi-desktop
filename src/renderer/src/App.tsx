import { I18nProvider } from '@renderer/features/app/i18n';
import { ShortcutSettingsProvider } from '@renderer/features/app/shortcuts';
import { ThemeProvider } from '@renderer/features/app/theme';
import { RouterProvider } from '@tanstack/react-router';
import React from 'react';
import { router } from './router';

export function App() {
  React.useEffect(
    () => {
      if (import.meta.env.DEV && import.meta.env.VITE_DEV_REACT_GRAB === 'open') {
        void import('react-grab');
      }
    },
    [],
  );

  React.useEffect(() => {
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_REACT_GRAB === 'open') {
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
