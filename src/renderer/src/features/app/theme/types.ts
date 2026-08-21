import { Enum } from 'enum-plus';

export const ThemeEnum = Enum({
  System: { value: 'system', label: 'appearance.system' },
  Light: { value: 'light', label: 'appearance.light' },
  Dark: { value: 'dark', label: 'appearance.dark' },
});

export type AppearanceTheme = typeof ThemeEnum.valueType;
