import * as React from 'react';
import { I18nProvider } from './i18n';
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
