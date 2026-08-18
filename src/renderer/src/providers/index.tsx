import * as React from 'react';
import { ThemeProvider } from './theme';

interface ProvidersProps {
  children: React.ReactNode;
};

export function Providers(props: ProvidersProps) {
  return (
    <ThemeProvider>
      {props.children}
    </ThemeProvider>
  );
}
