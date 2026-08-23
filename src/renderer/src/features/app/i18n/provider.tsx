import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { LocaleContext } from './context';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, messages, readLocalePreference, resolveLocale } from './locale';

function readSystemLocales(): readonly string[] {
  if (typeof navigator === 'undefined')
    return [];

  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [localePreference, setLocalePreference] = useState(() => readLocalePreference(
    typeof window === 'undefined' ? null : localStorage.getItem(LOCALE_STORAGE_KEY),
  ));
  const [systemLocales, setSystemLocales] = useState(readSystemLocales);
  const currentLocale = resolveLocale(localePreference, systemLocales);

  useEffect(() => {
    const handleLanguageChange = () => setSystemLocales(readSystemLocales());
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  const setLocale = (nextPreference: typeof localePreference) => {
    setLocalePreference(nextPreference);
    if (nextPreference === null)
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    else
      localStorage.setItem(LOCALE_STORAGE_KEY, nextPreference);
  };

  return (
    <LocaleContext value={{ locale: currentLocale, localePreference, setLocale }}>
      <IntlProvider defaultLocale={DEFAULT_LOCALE} locale={currentLocale} messages={messages[currentLocale]}>
        {children}
      </IntlProvider>
    </LocaleContext>
  );
}
