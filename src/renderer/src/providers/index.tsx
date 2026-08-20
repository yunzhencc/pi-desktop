import { I18nProvider } from '@renderer/features/i18n';
import React from 'react';
import { ThemeProvider } from './theme';

interface ProvidersProps {
  children: React.ReactNode;
};

export function Providers(props: ProvidersProps) {
  return (
    <ThemeProvider>
      <I18nProvider>{props.children}</I18nProvider>
    </ThemeProvider>
  );
}
