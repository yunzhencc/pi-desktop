export type AppearanceTheme = 'system' | 'light' | 'dark';

export function readAppearanceTheme(value: string | null): AppearanceTheme {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveAppearanceTheme(theme: AppearanceTheme, systemPrefersDark: boolean): 'light' | 'dark' {
  return theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;
}
