import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

describe('message interaction affordances', () => {
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
