// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '../providers/i18n';
import { GeneralSettingsView, SettingsSidebar, SettingsView } from './settings-view';

const { hotkeys } = vi.hoisted(() => ({ hotkeys: new Map<string, () => void>() }));

vi.mock('@tanstack/react-hotkeys', () => ({
  useHotkey: (key: string, handler: () => void) => hotkeys.set(key, handler),
}));

describe('settings view', () => {
  afterEach(() => {
    cleanup();
    hotkeys.clear();
  });

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
          'settings.language': '语言',
          'settings.theme': '主题',
        }}
      >
        <SettingsView onThemeChange={onThemeChange} theme="system" />
      </IntlProvider>,
    );

    expect(screen.getByRole('heading', { name: '外观' })).not.toBeNull();
    expect(screen.getByRole('radiogroup', { name: '主题' })).not.toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '语言' })).toBeNull();

    fireEvent.click(screen.getByLabelText('深色'));
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('opens an accessible language option list from General settings', () => {
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
          'settings.general': '常规',
          'settings.language': '语言',
          'settings.theme': '主题',
        }}
      >
        <GeneralSettingsView locale="zh-CN" onLocaleChange={onLocaleChange} />
      </IntlProvider>,
    );

    expect(screen.getByRole('heading', { name: '常规' })).not.toBeNull();

    fireEvent.click(screen.getByRole('combobox', { name: '语言' }));
    expect(screen.getByRole('listbox')).not.toBeNull();

    const englishOption = screen.getByRole('option', { name: '英语' });
    fireEvent.pointerDown(englishOption);
    fireEvent.click(englishOption);
    expect(onLocaleChange).toHaveBeenCalledWith('en');
  });

  it('uses Personal as the Chinese settings category', () => {
    const { container } = render(
      <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
        <SettingsSidebar activePath="/settings/general" onClose={vi.fn()} onNavigate={vi.fn()} />
      </IntlProvider>,
    );

    expect(screen.getByText('个人')).not.toBeNull();
    expect(container.querySelector('svg.lucide-settings')).not.toBeNull();
    expect(container.querySelector('svg.lucide-sliders-horizontal')).toBeNull();
    expect(container.querySelector('svg.lucide-sun')).not.toBeNull();
    expect(container.querySelector('svg.lucide-paintbrush')).toBeNull();
  });

  it('searches setting content and navigates to the matched panel', () => {
    const onNavigate = vi.fn();

    render(
      <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
        <SettingsSidebar activePath="/settings/general" onClose={vi.fn()} onNavigate={onNavigate} />
      </IntlProvider>,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索设置' }), { target: { value: '主题' } });
    fireEvent.click(screen.getByRole('button', { name: '主题，外观' }));

    expect(onNavigate).toHaveBeenCalledWith('/settings/appearance');
  });

  it('clears settings search with Escape', () => {
    render(
      <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
        <SettingsSidebar activePath="/settings/general" onClose={vi.fn()} onNavigate={vi.fn()} />
      </IntlProvider>,
    );

    const search = screen.getByRole('searchbox', { name: '搜索设置' }) as HTMLInputElement;
    fireEvent.change(search, { target: { value: '主题' } });
    fireEvent.keyDown(search, { key: 'Escape' });

    expect(search.value).toBe('');
    expect(screen.getByRole('button', { name: '外观' })).not.toBeNull();
  });

  it('shows the app clear button for a populated search input', () => {
    render(
      <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
        <SettingsSidebar activePath="/settings/general" onClose={vi.fn()} onNavigate={vi.fn()} />
      </IntlProvider>,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索设置' }), { target: { value: '你好' } });

    expect(screen.getByRole('button', { name: '清除设置搜索' })).not.toBeNull();
  });

  it('focuses settings search with the find shortcut', () => {
    render(
      <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
        <SettingsSidebar activePath="/settings/general" onClose={vi.fn()} onNavigate={vi.fn()} />
      </IntlProvider>,
    );

    const search = screen.getByRole('searchbox', { name: '搜索设置' });
    hotkeys.get('Mod+F')?.();

    expect(document.activeElement).toBe(search);
  });

  it('opens the highlighted search result with Enter', () => {
    const onNavigate = vi.fn();

    render(
      <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
        <SettingsSidebar activePath="/settings/general" onClose={vi.fn()} onNavigate={onNavigate} />
      </IntlProvider>,
    );

    const search = screen.getByRole('searchbox', { name: '搜索设置' });
    fireEvent.change(search, { target: { value: '主题' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onNavigate).toHaveBeenCalledWith('/settings/appearance');
  });
});
