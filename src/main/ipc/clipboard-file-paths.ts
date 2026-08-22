import { fileURLToPath } from 'node:url';

export function readClipboardFilePaths(read: (format: string) => string): string[] {
  const paths = new Set<string>();
  for (const format of ['public.file-url', 'text/uri-list']) {
    let values: string;
    try {
      values = read(format);
    }
    catch {
      continue;
    }
    for (const value of values.split(/\r?\n/)) {
      if (!value.startsWith('file:'))
        continue;
      try {
        paths.add(fileURLToPath(value));
      }
      catch {
        // Ignore malformed clipboard entries.
      }
    }
  }
  return [...paths];
}
