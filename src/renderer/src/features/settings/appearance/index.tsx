import { ToggleTheme } from '@renderer/features/app/theme';
import { useIntl } from 'react-intl';

export function AppearanceSettings() {
  const { formatMessage } = useIntl();

  return (
    <div className="h-full min-h-0 overflow-y-auto pt-[46px]">
      <section className="mx-auto w-full min-w-0 max-w-3xl px-8 pt-[22px] pb-12" aria-labelledby="appearance-settings-title">
        <h1 className="text-xl font-semibold tracking-normal" id="appearance-settings-title">{formatMessage({ id: 'settings.appearance' })}</h1>
        <div className="mt-8 flex flex-col gap-4">
          <h2 className="text-sm font-semibold">{formatMessage({ id: 'settings.theme' })}</h2>
          <ToggleTheme />
        </div>
      </section>
    </div>
  );
}
