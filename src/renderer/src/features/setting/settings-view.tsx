import type { AppLocale } from '@renderer/features/i18n';
import type { AppearanceTheme } from './appearance-settings';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pi-desktop/shadcn-ui/components/select';
import { ToggleTheme } from '@renderer/features/theme';
import { useIntl } from 'react-intl';

interface SettingsViewProps {
  onThemeChange: (theme: AppearanceTheme) => void;
  theme: AppearanceTheme;
}

export function SettingsView({ onThemeChange, theme }: SettingsViewProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="settings-view">
      <section className="settings-content" aria-labelledby="appearance-settings-title">
        <h1 id="appearance-settings-title">{formatMessage({ id: 'settings.appearance' })}</h1>
        <div className="settings-section">
          <h2>{formatMessage({ id: 'settings.theme' })}</h2>
          <ToggleTheme theme={theme} onThemeChange={onThemeChange} />
        </div>
      </section>
    </div>
  );
}

interface GeneralSettingsViewProps {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
}

export function GeneralSettingsView({ locale, onLocaleChange }: GeneralSettingsViewProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="settings-view">
      <section className="settings-content" aria-labelledby="general-settings-title">
        <h1 id="general-settings-title">{formatMessage({ id: 'settings.general' })}</h1>
        <div className="settings-section">
          <h2>{formatMessage({ id: 'settings.language' })}</h2>
          <label className="settings-field">
            <span>{formatMessage({ id: 'settings.language' })}</span>
            <Select
              items={[
                { label: formatMessage({ id: 'settings.chinese' }), value: 'zh-CN' },
                { label: formatMessage({ id: 'settings.english' }), value: 'en' },
              ]}
              onValueChange={value => onLocaleChange(value as AppLocale)}
              value={locale}
            >
              <SelectTrigger aria-label={formatMessage({ id: 'settings.language' })} className="settings-language-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value="zh-CN">{formatMessage({ id: 'settings.chinese' })}</SelectItem>
                  <SelectItem value="en">{formatMessage({ id: 'settings.english' })}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        </div>
      </section>
    </div>
  );
}
