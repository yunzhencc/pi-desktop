import { useAppLocale } from '@renderer/features/app/i18n';
import { GeneralSettings } from '../general';

export function GeneralPage() {
  const { localePreference, setLocale } = useAppLocale();

  return <GeneralSettings locale={localePreference} onLocaleChange={setLocale} />;
}
