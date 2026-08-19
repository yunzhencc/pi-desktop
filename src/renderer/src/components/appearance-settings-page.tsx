import { useTheme } from 'next-themes';
import { useAppLocale } from '../providers/i18n';
import { readAppearanceTheme } from './appearance-settings';
import { SettingsView } from './settings-view';

export function AppearanceSettingsPage() {
  const { setTheme, theme } = useTheme();
  const { locale, setLocale } = useAppLocale();

  return (
    <SettingsView
      locale={locale}
      onLocaleChange={setLocale}
      onThemeChange={setTheme}
      theme={readAppearanceTheme(theme ?? 'system')}
    />
  );
}
