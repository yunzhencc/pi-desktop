import { describe, expect, it } from 'vitest';
import { ThemeEnum } from '../types';
import { readAppearanceTheme, resolveAppearanceTheme } from './';

describe('appearance theme', () => {
  it('accepts only Codex theme preferences', () => {
    expect(readAppearanceTheme(ThemeEnum.Dark)).toBe(ThemeEnum.Dark);
    expect(readAppearanceTheme('invalid')).toBe(ThemeEnum.System);
  });

  it('resolves the system preference from the OS color scheme', () => {
    expect(resolveAppearanceTheme(ThemeEnum.System, true)).toBe(ThemeEnum.Dark);
    expect(resolveAppearanceTheme(ThemeEnum.System, false)).toBe(ThemeEnum.Light);
    expect(resolveAppearanceTheme(ThemeEnum.Light, true)).toBe(ThemeEnum.Light);
  });
});
