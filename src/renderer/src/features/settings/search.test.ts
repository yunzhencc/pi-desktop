import { describe, expect, it } from 'vitest';
import { fuzzyScore, searchSettings } from './search';

const messages: Record<string, string> = {
  'appearance.dark': '深色',
  'appearance.light': '浅色',
  'appearance.system': '系统',
  'providers.deepseek.title': 'DeepSeek',
  'providers.title': '模型提供商',
  'settings.appearance': '外观',
  'settings.chinese': '中文',
  'settings.english': '英语',
  'settings.general': '个人',
  'settings.language': '语言',
  'settings.theme': '主题',
  'shortcut.newConversation.title': '新建聊天',
  'shortcut.openSettings.title': '打开设置',
  'shortcut.toggleSessionPin.title': '切换会话置顶',
  'shortcut.toggleSidebar.title': '切换边栏',
  'shortcuts.title': '键盘快捷键',
};

const formatMessage = ({ id }: { id: string }) => messages[id] ?? id;

describe('settings search', () => {
  it('finds a panel by setting content', () => {
    expect(searchSettings('主题', formatMessage)[0]).toMatchObject({
      label: '主题',
      panel: '外观',
      path: '/settings/appearance',
    });
  });

  it('ranks direct panel matches before content matches', () => {
    expect(searchSettings('键盘', formatMessage)[0]).toMatchObject({
      label: '键盘快捷键',
      path: '/settings/keyboard-shortcuts',
      priority: 0,
    });
  });

  it('scores fuzzy matches without matching unrelated text', () => {
    expect(fuzzyScore('Keyboard shortcuts', 'ks')).toBeGreaterThan(0);
    expect(fuzzyScore('Keyboard shortcuts', 'zz')).toBe(0);
  });
});
