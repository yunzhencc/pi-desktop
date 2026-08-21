import type { AppLocale } from '@renderer/features/app/i18n';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pi-desktop/shadcn-ui/components/select';
import { LocaleEnum } from '@renderer/features/app/i18n';
import { useIntl } from 'react-intl';

interface GeneralSettingsProps {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
}

export function GeneralSettings({ locale, onLocaleChange }: GeneralSettingsProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="h-full min-h-0 overflow-y-auto pt-[46px]">
      <section className="mx-auto w-full min-w-0 max-w-3xl px-8 pt-[22px] pb-12" aria-labelledby="general-settings-title">
        <h1 className="text-xl font-semibold tracking-normal" id="general-settings-title">{formatMessage({ id: 'settings.general' })}</h1>
        <div className="mt-8 flex flex-col gap-4">
          <h2 className="text-sm font-semibold">{formatMessage({ id: 'settings.language' })}</h2>
          <label className="flex min-h-10 items-center justify-between rounded-md border border-border-subtle py-2 pr-2.5 pl-3 text-sm text-foreground">
            <span>{formatMessage({ id: 'settings.language' })}</span>
            <Select
              items={LocaleEnum.items.map(locale => ({ label: formatMessage({ id: locale.label }), value: locale.value }))}
              onValueChange={value => onLocaleChange(value as AppLocale)}
              value={locale}
            >
              <SelectTrigger aria-label={formatMessage({ id: 'settings.language' })} className="min-w-32 bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] font-[inherit] text-inherit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                <SelectGroup>
                  {LocaleEnum.items.map(locale => (
                    <SelectItem key={locale.value} value={locale.value}>
                      {formatMessage({ id: locale.label })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        </div>
      </section>
    </div>
  );
}
