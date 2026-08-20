import { ShortcutSettingsProvider } from '@renderer/features/app/hotkeys';
import { I18nProvider } from '@renderer/features/app/i18n';
import { ThemeProvider } from '@renderer/features/app/theme';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { router } from './router';
import 'overlayscrollbars/overlayscrollbars.css';
import './global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <ShortcutSettingsProvider>
          <RouterProvider router={router} />
        </ShortcutSettingsProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
