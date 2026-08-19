import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DeepSeekSettings } from './deepseek-settings';

const directories: string[] = [];

async function settingsPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'pi-desktop-deepseek-'));
  directories.push(directory);
  return join(directory, 'deepseek.json');
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { force: true, recursive: true })));
});

describe('deepseek settings', () => {
  it('persists an encrypted DeepSeek key without exposing it in the snapshot', async () => {
    const path = await settingsPath();
    const crypto = {
      decryptString: (value: Buffer) => value.toString(),
      encryptString: (value: string) => Buffer.from(value),
    };
    const settings = new DeepSeekSettings(path, crypto);

    await settings.save('sk-secret', 'deepseek-v4-flash');

    expect(settings.snapshot()).toEqual({ configured: true, model: 'deepseek-v4-flash' });
    expect(await readFile(path, 'utf8')).not.toContain('sk-secret');
    await expect(new DeepSeekSettings(path, crypto).load()).resolves.toEqual({
      apiKey: 'sk-secret',
      model: 'deepseek-v4-flash',
    });
  });
});
