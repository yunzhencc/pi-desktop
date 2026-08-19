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
});
