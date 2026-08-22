import { describe, expect, it } from 'vitest';
import { readClipboardFilePaths } from './clipboard-file-paths';

describe('readClipboardFilePaths', () => {
  it('reads Finder file URLs even when another clipboard format is unavailable', () => {
    const read = (format: string) => {
      if (format === 'public.file-url')
        return 'file:///Users/example/Desktop/brief%20with%20space.pdf';
      throw new Error('format unavailable');
    };

    expect(readClipboardFilePaths(read)).toEqual(['/Users/example/Desktop/brief with space.pdf']);
  });

  it('deduplicates valid URLs and ignores malformed values', () => {
    const read = () => 'file:///tmp/brief.pdf\nnot-a-url\nfile:///tmp/brief.pdf\nfile://%';

    expect(readClipboardFilePaths(read)).toEqual(['/tmp/brief.pdf']);
  });
});
