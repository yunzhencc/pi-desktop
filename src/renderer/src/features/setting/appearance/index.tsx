import { ToggleTheme } from '@renderer/features/theme';
import { useIntl } from 'react-intl';

export function AppearanceSettings() {
  const { formatMessage } = useIntl();

  return (
    <div className="settings-view">
      <section className="settings-content" aria-labelledby="appearance-settings-title">
        <h1 id="appearance-settings-title">{formatMessage({ id: 'settings.appearance' })}</h1>
        <div className="settings-section">
          <h2>{formatMessage({ id: 'settings.theme' })}</h2>
          <ToggleTheme />
        </div>
      </section>
    </div>
  );
}
