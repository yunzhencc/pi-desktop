import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

describe('chat composer toolbar styles', () => {
  it('uses Codex’s compact composer toolbar density and ghost hover surface', () => {
    const toolbarRule = styles.match(/\.new-conversation-toolbar\s*\{([\s\S]*?)\}/)?.[1];
    const triggerRule = styles.match(/\.new-conversation-toolbar-project-trigger\s*\{([\s\S]*?)\}/)?.[1];

    expect(toolbarRule).toContain('min-height: 40px;');
    expect(toolbarRule).toContain('gap: 8px;');
    expect(toolbarRule).toContain('padding: 0 8px;');
    expect(triggerRule).toContain('height: 28px;');
    expect(triggerRule).toContain('gap: 6px;');
    expect(triggerRule).toContain('padding: 0 12px;');
    expect(styles).toMatch(/\.new-conversation-toolbar-project-trigger:hover,\s*\.new-conversation-toolbar-project-trigger:focus-visible,\s*\.new-conversation-toolbar-project-trigger\[aria-expanded='true'\]\s*\{\s*background: color-mix\(in srgb, var\(--foreground\) 5%, transparent\);/);
  });

  it('gives every new-conversation context item the same Codex ghost hover', () => {
    const itemRule = styles.match(/\.new-conversation-toolbar-item\s*\{([\s\S]*?)\}/)?.[1];

    expect(itemRule).toContain('height: 28px;');
    expect(itemRule).toContain('padding: 0 12px;');
    expect(styles).toMatch(/\.new-conversation-toolbar-item:hover\s*\{\s*background: color-mix\(in srgb, var\(--foreground\) 5%, transparent\);/);
  });
});
