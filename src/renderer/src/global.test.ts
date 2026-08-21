import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./global.css', import.meta.url), 'utf8');
const chatComposerStyles = readFileSync(new URL('./features/conversation/components/chat-composer/style.css', import.meta.url), 'utf8');

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

  it('uses Codex’s compact composer toolbar density and ghost hover surface', () => {
    const toolbarRule = chatComposerStyles.match(/\.new-conversation-toolbar\s*\{([\s\S]*?)\}/)?.[1];
    const triggerRule = chatComposerStyles.match(/\.new-conversation-toolbar-project-trigger\s*\{([\s\S]*?)\}/)?.[1];

    expect(toolbarRule).toContain('min-height: 40px;');
    expect(toolbarRule).toContain('gap: 8px;');
    expect(toolbarRule).toContain('padding: 0 8px;');
    expect(triggerRule).toContain('height: 28px;');
    expect(triggerRule).toContain('gap: 6px;');
    expect(triggerRule).toContain('padding: 0 12px;');
    expect(chatComposerStyles).toMatch(/\.new-conversation-toolbar-project-trigger:hover,\s*\.new-conversation-toolbar-project-trigger:focus-visible,\s*\.new-conversation-toolbar-project-trigger\[aria-expanded='true'\]\s*\{\s*background: color-mix\(in srgb, var\(--foreground\) 5%, transparent\);/);
  });

  it('gives every new-conversation context item the same Codex ghost hover', () => {
    const itemRule = chatComposerStyles.match(/\.new-conversation-toolbar-item\s*\{([\s\S]*?)\}/)?.[1];

    expect(itemRule).toContain('height: 28px;');
    expect(itemRule).toContain('padding: 0 12px;');
    expect(chatComposerStyles).toMatch(/\.new-conversation-toolbar-item:hover\s*\{\s*background: color-mix\(in srgb, var\(--foreground\) 5%, transparent\);/);
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
