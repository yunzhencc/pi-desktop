import type { AppearanceTheme } from '../types';
import { ThemeEnum } from '../types';

export function readAppearanceTheme(value: string | null): AppearanceTheme {
  return ThemeEnum.has(value) ? value : ThemeEnum.System;
}

export function resolveAppearanceTheme(theme: AppearanceTheme, systemPrefersDark: boolean): 'light' | 'dark' {
  return theme === ThemeEnum.System ? (systemPrefersDark ? ThemeEnum.Dark : ThemeEnum.Light) : theme;
}
