import { useAppLocale } from '@renderer/features/app/i18n';
import { GeneralSettings } from '../general';

export function GeneralPage() {
  const { locale, setLocale } = useAppLocale();

  return <GeneralSettings locale={locale} onLocaleChange={setLocale} />;
}
