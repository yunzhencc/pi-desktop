import type { AppLocale } from './locale';
import { createContext, use } from 'react';

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useAppLocale() {
  const value = use(LocaleContext);
  if (!value)
    throw new Error('useAppLocale must be used within I18nProvider');

  return value;
}
