import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/renderer/src/features/conversation/style.css'), 'utf8');

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

  it('animates the running work indicator with reduced-motion fallback', () => {
    const dotRule = styles.match(/\.chat-worked-for-dot\s*\{([\s\S]*?)\}/)?.[1];

    expect(dotRule).toContain('animation: chat-worked-for-dot 1.2s ease-in-out infinite;');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
