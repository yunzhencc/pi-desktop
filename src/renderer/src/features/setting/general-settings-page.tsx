import { useAppLocale } from '@renderer/features/i18n';
import { GeneralSettings } from './general';

export function GeneralSettingsPage() {
  const { locale, setLocale } = useAppLocale();

  return <GeneralSettings locale={locale} onLocaleChange={setLocale} />;
}
