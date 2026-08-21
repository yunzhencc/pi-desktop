import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrimaryScopeEnum } from '@shared/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_ERROR_CHATGPT_UNSUPPORTED_REGION } from '../shared/provider-errors';
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
      modelPickerScope: PrimaryScopeEnum.Primary,
      primaryProvider: 'openai-codex',
    });
  });

  it('stores API keys through Pi native auth', async () => {
    const root = await tempDirectory();
    const settings = new ProviderSettings(join(root, 'userData'), { agentDir: join(root, 'agent'), cwd: root });

    const snapshot = await settings.saveApiKey('deepseek', 'sk-test');

    expect(snapshot.connectedProviders).toContainEqual(expect.objectContaining({ configured: true, id: 'deepseek' }));
  });

  it('detects OpenCode Go from Pi native models', async () => {
    const root = await tempDirectory();
    const agentDir = join(root, 'agent');
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, 'models.json'), `${JSON.stringify({
      providers: {
        'opencode-go': {
          api: 'openai-completions',
          apiKey: '!node -e "process.stdout.write(\'sk-test\')"',
          baseUrl: 'https://opencode.ai/zen/go/v1',
          models: [{ id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code' }],
          name: 'OpenCode Go',
        },
      },
    })}\n`);
    await writeFile(join(agentDir, 'settings.json'), `${JSON.stringify({
      defaultModel: 'kimi-k2.7-code',
      defaultProvider: 'opencode-go',
    })}\n`);
    const settings = new ProviderSettings(join(root, 'userData'), { agentDir, cwd: root });

    const snapshot = await settings.snapshot();
    const provider = snapshot.connectedProviders.find(provider => provider.id === 'opencode-go');

    expect(provider).toBeTruthy();
    expect(provider?.name).toBe('OpenCode Go');
    expect(provider?.models).toContainEqual(expect.objectContaining({ id: 'kimi-k2.7-code' }));
    expect(snapshot.defaultModel).toEqual({ modelId: 'kimi-k2.7-code', providerId: 'opencode-go' });
  });

  it('keeps built-in OpenCode providers in the supported scope', async () => {
    const root = await tempDirectory();
    const settings = new ProviderSettings(join(root, 'userData'), { agentDir: join(root, 'agent'), cwd: root });

    const snapshot = await settings.snapshot();
    const provider = snapshot.availableProviders.find(provider => provider.id === 'opencode');

    expect(provider).toBeTruthy();
    expect(provider?.name).toBe('OpenCode Zen');
  });

  it('uses the Pi SDK provider catalog instead of a first-version hardcoded list', async () => {
    const root = await tempDirectory();
    const settings = new ProviderSettings(join(root, 'userData'), { agentDir: join(root, 'agent'), cwd: root });

    const snapshot = await settings.snapshot();

    expect(snapshot.availableProviders.some(provider => provider.id === 'amazon-bedrock')).toBe(true);
  });

  it('skips models.json providers backed by direct API keys like pi-web', async () => {
    const root = await tempDirectory();
    const agentDir = join(root, 'agent');
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, 'models.json'), `${JSON.stringify({
      providers: {
        'custom-key': {
          api: 'openai-completions',
          apiKey: 'sk-test',
          baseUrl: 'https://example.com/v1',
          models: [{ id: 'custom-model', name: 'Custom Model' }],
          name: 'Custom Key',
        },
      },
    })}\n`);
    const settings = new ProviderSettings(join(root, 'userData'), { agentDir, cwd: root });

    const snapshot = await settings.snapshot();

    expect(snapshot.availableProviders.some(provider => provider.id === 'custom-key')).toBe(false);
  });

  it('opens the ChatGPT browser login without requiring in-app credential input', async () => {
    const root = await tempDirectory();
    const openExternal = vi.fn();
    const login = vi.fn(async (_providerId, _type, interaction: {
      notify: (event: unknown) => void | Promise<void>;
      prompt: (prompt: { options?: readonly { id: string; label: string }[]; signal?: AbortSignal; type: string }) => Promise<string>;
    }) => {
      await expect(interaction.prompt({
        options: [
          { id: 'browser', label: 'Browser login (default)' },
          { id: 'device_code', label: 'Device code login (headless)' },
        ],
        type: 'select',
      })).resolves.toBe('browser');
      await interaction.notify({ type: 'auth_url', url: 'https://chatgpt.com/oauth' });

      const abort = new AbortController();
      let settled = false;
      const manualPrompt = interaction.prompt({ signal: abort.signal, type: 'manual_code' })
        .finally(() => {
          settled = true;
        });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(settled).toBe(false);
      abort.abort();
      await manualPrompt.catch(() => undefined);
    });
    const settings = new ProviderSettings(join(root, 'userData'), {
      createServices: async () => ({
        modelRuntime: {
          getAvailable: async () => [],
          getProviderAuthStatus: () => ({ configured: true }),
          getProviders: () => [{ auth: { oauth: true }, id: 'openai-codex', name: 'OpenAI Codex' }],
          login,
        },
        settingsManager: {
          getDefaultModel: () => undefined,
          getDefaultProvider: () => undefined,
          getEnabledModels: () => [],
          setDefaultModelAndProvider: vi.fn(),
        },
      }),
      openExternal,
    });

    await settings.loginChatGPT();

    expect(login).toHaveBeenCalledWith('openai-codex', 'oauth', expect.any(Object));
    expect(openExternal).toHaveBeenCalledWith('https://chatgpt.com/oauth');
  });

  it('reports unsupported OpenAI regions clearly', async () => {
    const root = await tempDirectory();
    const settings = new ProviderSettings(join(root, 'userData'), {
      createServices: async () => ({
        modelRuntime: {
          getAvailable: async () => [],
          getProviderAuthStatus: () => ({ configured: false }),
          getProviders: () => [],
          login: async () => {
            throw new Error('OpenAI Codex token exchange failed (403): {"error":{"code":"unsupported_country_region_territory"}}');
          },
        },
        settingsManager: {
          getDefaultModel: () => undefined,
          getDefaultProvider: () => undefined,
          getEnabledModels: () => [],
          setDefaultModelAndProvider: vi.fn(),
        },
      }),
    });

    await expect(settings.loginChatGPT()).rejects.toThrow(PROVIDER_ERROR_CHATGPT_UNSUPPORTED_REGION);
  });
});
