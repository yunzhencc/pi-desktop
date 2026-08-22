import { readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mainRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function source(path: string): Promise<string> {
  return readFile(join(mainRoot, path), 'utf8');
}

describe('ipc registry boundaries', () => {
  it('keeps raw ipcMain registration inside the registry', async () => {
    const files = [
      'index.ts',
      'ipc/handlers/window-controls.ts',
      'ipc/handlers/providers.ts',
      'ipc/handlers/workspaces.ts',
      'ipc/handlers/sessions.ts',
      'ipc/handlers/composer.ts',
    ];

    await Promise.all(files.map(async (file) => {
      expect(await source(file), relative(mainRoot, join(mainRoot, file))).not.toMatch(/\bipcMain\.(?:handle|on)\(/);
    }));
  });

  it('uses IPC_CHANNELS for registered and sent channels', async () => {
    const files = [
      'index.ts',
      'ipc/handlers/window-controls.ts',
      'ipc/handlers/providers.ts',
      'ipc/handlers/workspaces.ts',
      'ipc/handlers/sessions.ts',
      'ipc/handlers/composer.ts',
    ];

    await Promise.all(files.map(async (file) => {
      const text = await source(file);
      expect(text, relative(mainRoot, join(mainRoot, file))).not.toMatch(/(?:registerHandler|registerListener|webContents\.send)\(\s*['"`]/);
    }));
  });
});
