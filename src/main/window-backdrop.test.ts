import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

describe('macOS window backdrop', () => {
  it('uses an opaque fallback while an inactive window is unfocused', () => {
    expect(source).toContain('? nativeTheme.shouldUseDarkColors ? \'#000000\' : \'#f9f9f9\'');
    expect(source).toContain('mainWindow.setVibrancy(opaque ? null : \'menu\');');
    expect(source).toContain('mainWindow.on(\'focus\', syncWindowBackdrop);');
    expect(source).toContain('mainWindow.on(\'blur\', syncWindowBackdrop);');
    expect(source).toContain('mainWindow.on(\'show\', syncWindowBackdrop);');
    expect(source).toContain('mainWindow.on(\'hide\', syncWindowBackdrop);');
    expect(source).toContain('syncWindowBackdrop();');
  });
});
