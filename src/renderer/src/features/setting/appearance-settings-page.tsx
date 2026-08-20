import { useTheme } from 'next-themes';
import { readAppearanceTheme } from './appearance-settings';
import { SettingsView } from './settings-view';

export function AppearanceSettingsPage() {
  const { setTheme, theme } = useTheme();

  return (
    <SettingsView
      onThemeChange={setTheme}
      theme={readAppearanceTheme(theme ?? 'system')}
    />
  );
}
