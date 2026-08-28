import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/renderer/src/features/conversation/components/chat-composer/index.tsx'), 'utf8');

describe('chat composer toolbar styles', () => {
  it('uses Codex’s compact composer toolbar density and ghost hover surface', () => {
    expect(source).toContain('min-h-10 items-center gap-2');
    expect(source).toContain('h-7 min-w-0 items-center gap-1.5');
    expect(source).toContain('px-3 text-left');
    expect(source).toContain('hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]');
  });

  it('gives every new-conversation context item the same Codex ghost hover', () => {
    expect(source).toContain('inline-flex h-7 items-center gap-1.5 rounded-full px-3');
  });
});
