// @vitest-environment jsdom

import { messages } from '@renderer/features/app/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsSidebar } from '../components/sidebar';
import { GeneralSettings } from '../general';
import { ProfilePage } from '../pages/profile';
import { AppearanceSettings } from './';

const { hotkeys, setTheme } = vi.hoisted(() => ({
  hotkeys: new Map<string, () => void>(),
  setTheme: vi.fn(),
}));

vi.mock('@tanstack/react-hotkeys', () => ({
  useHotkey: (key: string, handler: () => void) => hotkeys.set(key, handler),
  useHotkeys: (definitions: Array<{ hotkey: string; callback: () => void }>) => definitions.forEach(({ callback, hotkey }) => hotkeys.set(hotkey, callback)),
}));

vi.mock('@renderer/features/app/hotkeys', () => ({
  useShortcutSettings: () => ({
    bindings: {
      focusSettingsSearch: ['Mod+F'],
      newConversation: ['Mod+N', 'Mod+Shift+O'],
      openSettings: ['Mod+,'],
      toggleSidebar: ['Mod+B'],
    },
  }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    setTheme,
    theme: 'system',
  }),
}));

describe('settings view', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        sessions: {
          list: vi.fn(async (path: string) => path === '/repo' ? [{ firstMessage: 'Hello', id: 'session-1', modifiedAt: '2026-08-21T00:00:00.000Z', path: '/session-1' }] : []),
        },
        workspaces: {
          get: vi.fn(async () => ({
            pinnedSessionPaths: ['/session-1'],
            pinnedWorkspacePaths: ['/repo'],
            selectedWorkspacePath: '/repo',
            workspaces: [{ displayName: 'Repo', lastOpenedAt: '2026-08-21T00:00:00.000Z', path: '/repo' }],
          })),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    hotkeys.clear();
    setTheme.mockReset();
    delete (window as Partial<Window>).api;
  });

  it('renders the settings copy in Chinese when the active locale is Chinese', () => {
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
        <AppearanceSettings />
      </IntlProvider>,
    );

    expect(screen.getByRole('heading', { name: '外观' })).not.toBeNull();
    expect(screen.getByRole('radiogroup', { name: '主题' })).not.toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '语言' })).toBeNull();

    fireEvent.click(screen.getByLabelText('深色'));
    expect(setTheme).toHaveBeenCalledWith('dark');
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
          'profileStats.activeProjectsTitle': '最常用项目',
          'profileStats.activeProjectSessions': '当前项目会话',
          'profileStats.activityTitle': '会话活动',
          'profileStats.cumulative': '累计',
          'profileStats.daily': '每日',
          'profileStats.insightsTitle': '活动洞察',
          'profileStats.loading': '正在统计…',
          'profileStats.localOnly': '本地统计',
          'profileStats.localProfile': 'Pi 用户',
          'profileStats.noProjects': '暂无项目活动',
          'profileStats.pinnedProjects': '置顶项目',
          'profileStats.pinnedSessions': '置顶会话',
          'profileStats.projectRuns': '{runs} 次',
          'profileStats.projects': '项目',
          'profileStats.sessions': '会话',
          'profileStats.title': '统计',
          'profileStats.weekly': '每周',
        }}
      >
        <GeneralSettings locale="zh-CN" onLocaleChange={onLocaleChange} />
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

  it('shows local profile stats without account data', async () => {
    const { container } = render(
      <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
        <ProfilePage />
      </IntlProvider>,
    );

    expect(await screen.findByText('当前项目会话')).not.toBeNull();
    expect(screen.getAllByText('置顶项目')).toHaveLength(1);
    expect(screen.getAllByText('置顶会话')).toHaveLength(1);
    expect(screen.getByText('会话活动')).not.toBeNull();
    expect(screen.queryByText('活动洞察')).toBeNull();
    expect(screen.queryByText('最常用项目')).toBeNull();
    expect(container.querySelectorAll('.settings-profile-heatmap span')).toHaveLength(371);
  });

  it('uses Personal as the Chinese settings category', () => {
    const { container } = render(
      <IntlProvider locale="zh-CN" messages={messages['zh-CN']}>
        <SettingsSidebar activePath="/settings/general" onClose={vi.fn()} onNavigate={vi.fn()} />
      </IntlProvider>,
    );

    expect(screen.getByText('个人')).not.toBeNull();
    expect(screen.getByRole('button', { name: '个人资料' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '模型提供商' })).not.toBeNull();
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
