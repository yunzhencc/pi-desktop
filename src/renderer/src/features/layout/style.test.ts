import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/renderer/src/features/layout/style.css'), 'utf8');

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
});
