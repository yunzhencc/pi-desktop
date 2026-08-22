// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownMessage } from './';

vi.mock('shiki', () => ({
  codeToHtml: vi.fn((code: string) => Promise.resolve(`<pre class="shiki"><code>${code}</code></pre>`)),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('markdown message', () => {
  it('renders GFM tables and copies them as TSV', () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<MarkdownMessage>{'| Name | Value |\n| --- | ---: |\n| alpha | 1 |'}</MarkdownMessage>);

    expect(screen.getByRole('columnheader', { name: 'Name' })).not.toBeNull();
    expect(screen.getByRole('cell', { name: '1' }).style.textAlign).toBe('right');

    fireEvent.click(screen.getByRole('button', { name: 'Copy table' }));
    expect(writeText).toHaveBeenCalledWith('Name\tValue\nalpha\t1');
  });

  it('renders code block actions and previews HTML blocks', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<MarkdownMessage>{'```html\n<strong>Hello</strong>\n```'}</MarkdownMessage>);

    await waitFor(() => expect(document.querySelector('.shiki')).not.toBeNull());
    expect(screen.getByText('html')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(writeText).toHaveBeenCalledWith('<strong>Hello</strong>');

    fireEvent.click(screen.getByRole('button', { name: 'Preview code' }));
    const preview = screen.getByTitle('html preview') as HTMLIFrameElement;
    expect(preview.srcdoc).toBe('<strong>Hello</strong>');
  });

  it('renders math without exposing raw delimiters', () => {
    const { container } = render(<MarkdownMessage>{'Inline $E=mc^2$.\n\n$$\na^2+b^2=c^2\n$$'}</MarkdownMessage>);

    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(1);
    expect(screen.queryByText('$E=mc^2$')).toBeNull();
  });
});
