import { useAppLocale } from '@renderer/features/i18n';
import { GeneralSettingsView } from './settings-view';

export function GeneralSettingsPage() {
  const { locale, setLocale } = useAppLocale();

  return <GeneralSettingsView locale={locale} onLocaleChange={setLocale} />;
}
