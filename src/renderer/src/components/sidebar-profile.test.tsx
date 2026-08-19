import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import { SidebarProfile } from './sidebar-profile';
import { getProfileInitials } from './sidebar-profile-utils';

describe('getProfileInitials', () => {
  it('uses the first two words for the footer avatar', () => {
    expect(getProfileInitials('Wang Xingkang')).toBe('WX');
  });

  it('falls back to the first character for a single username', () => {
    expect(getProfileInitials('wangxingkang')).toBe('W');
  });

  it('renders Chinese profile-menu copy for the Chinese locale', () => {
    const markup = renderToStaticMarkup(
      <IntlProvider locale="zh-CN" messages={{ 'profile.help': '打开帮助菜单', 'profile.logOut': '退出登录', 'profile.settings': '设置' }}>
        <SidebarProfile name="Wang Xingkang" />
      </IntlProvider>,
    );

    expect(markup).toContain('设置');
    expect(markup).toContain('退出登录');
    expect(markup).toContain('打开帮助菜单');
    expect(markup).toContain('sidebar-profile-menu-identity');
  });
});
