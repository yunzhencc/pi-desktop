import type { ReactNode } from 'react';
import { useState } from 'react';
import { IntlProvider } from 'react-intl';
import { LocaleContext } from './context';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, messages, readLocale } from './locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [currentLocale, setCurrentLocale] = useState(() => readLocale(
    typeof window === 'undefined' ? null : localStorage.getItem(LOCALE_STORAGE_KEY),
  ));
  const setLocale = (nextLocale: typeof currentLocale) => {
    setCurrentLocale(nextLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  };

  return (
    <LocaleContext value={{ locale: currentLocale, setLocale }}>
      <IntlProvider defaultLocale={DEFAULT_LOCALE} locale={currentLocale} messages={messages[currentLocale]}>
        {children}
      </IntlProvider>
    </LocaleContext>
  );
}
