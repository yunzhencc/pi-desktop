import { describe, expect, it } from 'vitest';
import { readAppearanceTheme, resolveAppearanceTheme } from './appearance-settings';

describe('appearance theme', () => {
  it('accepts only Codex theme preferences', () => {
    expect(readAppearanceTheme('dark')).toBe('dark');
    expect(readAppearanceTheme('invalid')).toBe('system');
  });

  it('resolves the system preference from the OS color scheme', () => {
    expect(resolveAppearanceTheme('system', true)).toBe('dark');
    expect(resolveAppearanceTheme('system', false)).toBe('light');
    expect(resolveAppearanceTheme('light', true)).toBe('light');
  });
});
