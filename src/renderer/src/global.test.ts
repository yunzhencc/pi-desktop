import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./global.css', import.meta.url), 'utf8');

describe('app shell surfaces', () => {
  it('keeps the Electron sidebar translucent over the native window material', () => {
    const sidebarRule = styles.match(/\.app-shell-left-panel\s*\{([\s\S]*?)\}/)?.[1];

    expect(sidebarRule).toContain('background: var(--surface-tertiary);');
    expect(styles).toMatch(/\.app-shell-left-panel\s*\{\s*background:\s*color-mix\([^}]*transparent/);
  });

  it('uses the theme sidebar color without transparency while the window is unfocused', () => {
    const opaqueSidebarRule = styles.match(/html\.electron-opaque \.app-shell-left-panel\s*\{([\s\S]*?)\}/)?.[1];

    expect(opaqueSidebarRule).toContain('background: var(--surface-tertiary);');
  });

  it('uses the light window underlay for an unfocused light sidebar', () => {
    const lightOpaqueSidebarRule = styles.match(/html:not\(\.dark\)\.electron-opaque \.app-shell-left-panel\s*\{([\s\S]*?)\}/)?.[1];

    expect(lightOpaqueSidebarRule).toContain('background: #fafafa;');
  });

  it('keeps the light right panel bounded at the window edge', () => {
    const rightPanelRule = styles.match(/\.app-shell-right-panel\s*\{([\s\S]*?)\}/)?.[1];

    expect(rightPanelRule).toContain('border-inline-end: 1px solid var(--border-subtle);');
  });

  it('highlights only the active settings navigation item', () => {
    const navigationRule = styles.match(/\.settings-back-button,\s*\.settings-navigation-item\s*\{([\s\S]*?)\}/)?.[1];
    const activeNavigationRule = styles.match(/\.settings-navigation-item\[aria-current='page'\]\s*\{([\s\S]*?)\}/)?.[1];

    expect(navigationRule).not.toContain('background:');
    expect(activeNavigationRule).toContain('background: color-mix(in srgb, var(--foreground) 8%, transparent);');
  });

  it('leaves a one-pixel gap between adjacent settings navigation items', () => {
    expect(styles).toMatch(/\.settings-navigation-item \+ \.settings-navigation-item\s*\{\s*margin-top: 1px;/);
  });

  it('uses Codex settings typography and semantic colors', () => {
    const titleRule = styles.match(/\.settings-navigation-title\s*\{([\s\S]*?)\}/)?.[1];
    const backRule = styles.match(/\.settings-back-button\s*\{([\s\S]*?)\}/)?.[1];
    const itemRule = styles.match(/\.settings-back-button,\s*\.settings-navigation-item\s*\{([\s\S]*?)\}/)?.[1];

    expect(titleRule).toContain('font-size: 14px;');
    expect(titleRule).toContain('font-weight: 400;');
    expect(titleRule).toContain('color: var(--text-tertiary);');
    expect(backRule).toContain('font-size: 14px;');
    expect(backRule).toContain('font-weight: 400;');
    expect(backRule).toContain('color: var(--text-tertiary);');
    expect(itemRule).toContain('height: 28px;');
    expect(itemRule).toContain('font-size: 14px;');
  });

  it('uses Codex’s compact workspace-picker dimensions', () => {
    const popoverRule = styles.match(/\.project-picker-popover\s*\{([\s\S]*?)\}/)?.[1];
    const listRule = styles.match(/\.project-picker-command \[cmdk-list\]\s*\{([\s\S]*?)\}/)?.[1];
    const itemRule = styles.match(/\.project-picker-command \[cmdk-item\]\s*\{([\s\S]*?)\}/)?.[1];

    expect(popoverRule).toContain('min-width: 260px;');
    expect(popoverRule).toContain('border-radius: 12px;');
    expect(popoverRule).toContain('max-height: min(350px, calc(100vh - 16px));');
    expect(listRule).toContain('max-height: calc((1lh + 10px) * 5);');
    expect(itemRule).toContain('font-size: 13px;');
  });

  it('uses Codex’s compact composer toolbar density and ghost hover surface', () => {
    const toolbarRule = styles.match(/\.new-conversation-toolbar\s*\{([\s\S]*?)\}/)?.[1];
    const triggerRule = styles.match(/\.new-conversation-toolbar-project-trigger\s*\{([\s\S]*?)\}/)?.[1];

    expect(toolbarRule).toContain('min-height: 40px;');
    expect(toolbarRule).toContain('gap: 8px;');
    expect(toolbarRule).toContain('padding: 0 8px;');
    expect(triggerRule).toContain('height: 28px;');
    expect(triggerRule).toContain('gap: 6px;');
    expect(triggerRule).toContain('padding: 0 12px;');
    expect(styles).toMatch(/\.new-conversation-toolbar-project-trigger\[aria-expanded='true'\]\s*\{\s*background: color-mix\(in srgb, var\(--foreground\) 5%, transparent\);/);
  });

  it('gives every new-conversation context item the same Codex ghost hover', () => {
    const itemRule = styles.match(/\.new-conversation-toolbar-item\s*\{([\s\S]*?)\}/)?.[1];

    expect(itemRule).toContain('height: 28px;');
    expect(itemRule).toContain('padding: 0 12px;');
    expect(styles).toMatch(/\.new-conversation-toolbar-item:hover\s*\{\s*background: color-mix\(in srgb, var\(--foreground\) 5%, transparent\);/);
  });

  it('reveals user message metadata only on hover or keyboard focus', () => {
    const footerRule = styles.match(/\.chat-message-user-footer\s*\{([\s\S]*?)\}/)?.[1];

    expect(footerRule).toContain('opacity: 0;');
    expect(footerRule).toContain('pointer-events: none;');
    expect(styles).toMatch(/\.chat-message-user:hover \.chat-message-user-footer,\s*\.chat-message-user:has\(\.chat-message-user-copy:focus-visible\) \.chat-message-user-footer\s*\{[\s\S]*?opacity: 1;/);
  });

  it('reserves the user message metadata row before hover', () => {
    const footerRule = styles.match(/\.chat-message-user-footer\s*\{([\s\S]*?)\}/)?.[1];
    const revealedRule = styles.match(/\.chat-message-user:hover \.chat-message-user-footer,\s*\.chat-message-user:has\(\.chat-message-user-copy:focus-visible\) \.chat-message-user-footer\s*\{([\s\S]*?)\}/)?.[1];

    expect(footerRule).toContain('height: 20px;');
    expect(footerRule).toContain('margin-top: 4px;');
    expect(footerRule).not.toContain('max-height');
    expect(revealedRule).not.toContain('margin-top');
  });
});
