import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/renderer/src/features/conversation/components/markdown-message/style.css'), 'utf8');

describe('markdown message styles', () => {
  it('inherits Codex chat font variables instead of hard-coding message size', () => {
    expect(styles).toContain('--markdown-font-size: var(--codex-chat-font-size, 16px);');
    expect(styles).toContain('--markdown-line-height: calc(var(--markdown-font-size) + 8px);');
    expect(styles).toContain('color: var(--codex-color-text, var(--foreground));');
  });

  it('keeps tables aligned with Codex wide-block table styling', () => {
    expect(styles).toContain('width: var(--markdown-table-width);');
    expect(styles).toContain('margin-inline: var(--markdown-table-margin);');
    expect(styles).toContain('border-collapse: separate;');
    expect(styles).toContain('.markdown-message-table-container:not(:hover):not(:focus-within) .markdown-message-table-actions');
    expect(styles).not.toContain('border-radius: 8px;\n}\n\n.markdown-message-table {');
  });

  it('keeps list and blockquote spacing close to Codex markdown rules', () => {
    expect(styles).toContain('.markdown-message-list {\n  margin: 0;');
    expect(styles).toContain('.markdown-message-list-item > .markdown-message-paragraph + .markdown-message-paragraph');
    expect(styles).toContain('.markdown-message-blockquote::after');
    expect(styles).toContain('left: 0;');
  });
});
