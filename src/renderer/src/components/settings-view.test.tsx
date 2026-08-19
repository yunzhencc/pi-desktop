// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { SettingsView } from './settings-view';

describe('settings view', () => {
  it('renders the settings copy in Chinese when the active locale is Chinese', () => {
    const onThemeChange = vi.fn();

    render(
      <IntlProvider
        locale="zh-CN"
        messages={{
          'appearance.dark': '深色',
          'appearance.light': '浅色',
          'appearance.system': '系统',
          'settings.appearance': '外观',
          'settings.theme': '主题',
        }}
      >
        <SettingsView onThemeChange={onThemeChange} theme="system" />
      </IntlProvider>,
    );

    expect(screen.getByRole('heading', { name: '外观' })).not.toBeNull();
    expect(screen.getByRole('radiogroup', { name: '主题' })).not.toBeNull();

    fireEvent.click(screen.getByLabelText('深色'));
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('offers only Chinese and English language choices', () => {
    const onLocaleChange = vi.fn();

    render(
      <IntlProvider
        locale="zh-CN"
        messages={{
          'appearance.dark': '深色',
          'appearance.light': '浅色',
          'appearance.system': '系统',
          'settings.appearance': '外观',
          'settings.chinese': '中文',
          'settings.english': '英语',
          'settings.language': '语言',
          'settings.theme': '主题',
        }}
      >
        <SettingsView locale="zh-CN" onLocaleChange={onLocaleChange} onThemeChange={vi.fn()} theme="system" />
      </IntlProvider>,
    );

    expect(screen.getByRole('radiogroup', { name: '语言' })).not.toBeNull();
    fireEvent.click(screen.getByLabelText('英语'));
    expect(onLocaleChange).toHaveBeenCalledWith('en');
  });
});
