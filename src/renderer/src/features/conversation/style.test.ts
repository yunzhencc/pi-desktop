import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/renderer/src/features/conversation/style.css'), 'utf8');
const markdownStyles = readFileSync(resolve(process.cwd(), 'src/renderer/src/features/conversation/components/markdown-message/style.css'), 'utf8');

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

  it('keeps the latest assistant reply metadata visible with toolbar sizing', () => {
    const footerRule = styles.match(/\.chat-message-assistant-footer\s*\{([\s\S]*?)\}/)?.[1];

    expect(footerRule).toContain('min-height: 28px;');
    expect(footerRule).toContain('gap: 4px;');
    expect(footerRule).toContain('margin-top: 4px;');
    expect(footerRule).not.toContain('transform');
    expect(styles).toMatch(/\.chat-message-assistant-footer\.is-latest \.chat-message-assistant-timestamp,\s*\.chat-message-assistant:focus-within \.chat-message-assistant-timestamp\s*\{[\s\S]*?opacity: 1;/);
  });

  it('animates the thinking placeholder label with reduced-motion fallback', () => {
    const labelRule = styles.match(/\.chat-worked-for-label\.is-running\s*\{([\s\S]*?)\}/)?.[1];

    expect(labelRule).toContain('background-clip: text;');
    expect(labelRule).toContain('animation: chat-worked-for-shimmer 1.8s ease-in-out infinite;');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps Codex-like turn spacing on the shared conversation surface', () => {
    const pageRule = styles.match(/\.chat-page\s*\{([\s\S]*?)\}/)?.[1];
    const messageRule = styles.match(/\.chat-message\s*\{([\s\S]*?)\}/)?.[1];
    const assistantRule = styles.match(/\.chat-message-assistant\s*\{([\s\S]*?)\}/)?.[1];
    const activityTurnRule = styles.match(/\.chat-activity-turn,\s*\.chat-worked-for\s*\{([\s\S]*?)\}/)?.[1];
    const activityContentRule = styles.match(/\.chat-activity-turn-content\s*\{([\s\S]*?)\}/)?.[1];
    const headingRule = markdownStyles.match(/\.markdown-message-heading\s*\{([\s\S]*?)\}/)?.[1];

    expect(pageRule).toContain('--codex-chat-font-size: 14px;');
    expect(pageRule).toContain('--codex-chat-code-font-size: 13px;');
    expect(pageRule).toContain('--conversation-item-gap: 16px;');
    expect(pageRule).toContain('--conversation-grouped-item-gap: 8px;');
    expect(messageRule).toContain('font-size: var(--codex-chat-font-size, 14px);');
    expect(messageRule).toContain('line-height: calc(var(--codex-chat-font-size, 14px) + 8px);');
    expect(assistantRule).toContain('padding: 0;');
    expect(activityTurnRule).toContain('gap: var(--conversation-grouped-item-gap, 8px);');
    expect(activityContentRule).toContain('gap: var(--conversation-grouped-item-gap, 8px);');
    expect(activityContentRule).not.toContain('margin-top');
    expect(headingRule).toContain('margin: var(--conversation-grouped-item-gap, 8px) 0;');
  });
});
