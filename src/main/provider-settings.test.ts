import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProviderSettings } from './provider-settings';

const directories: string[] = [];

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'pi-desktop-providers-'));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { force: true, recursive: true })));
});

describe('provider settings', () => {
  it('defaults to ChatGPT as the primary provider', async () => {
    const root = await tempDirectory();
    const settings = new ProviderSettings(join(root, 'userData'), { agentDir: join(root, 'agent'), cwd: root });

    await expect(settings.snapshot()).resolves.toMatchObject({
      modelPickerScope: 'primary-provider',
      primaryProvider: 'openai-codex',
    });
  });

  it('stores API keys through Pi native auth', async () => {
    const root = await tempDirectory();
    const settings = new ProviderSettings(join(root, 'userData'), { agentDir: join(root, 'agent'), cwd: root });

    const snapshot = await settings.saveApiKey('deepseek', 'sk-test');

    expect(snapshot.connectedProviders).toContainEqual(expect.objectContaining({ configured: true, id: 'deepseek' }));
  });
});
