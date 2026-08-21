import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

export const PROVIDER_IDS = ['openai-codex', 'deepseek', 'opencode'] as const;
export type ProviderId = typeof PROVIDER_IDS[number];
export type ModelPickerScope = 'primary-provider' | 'all-providers';

export interface ProviderModelSnapshot {
  id: string;
  name: string;
  providerId: ProviderId;
  reasoning: boolean;
  supportsImages: boolean;
}

export interface ProviderSnapshot {
  authType: 'api_key' | 'oauth';
  configured: boolean;
  id: ProviderId;
  models: ProviderModelSnapshot[];
  name: string;
  primary: boolean;
}

export interface ProvidersSnapshot {
  availableProviders: ProviderSnapshot[];
  connectedProviders: ProviderSnapshot[];
  defaultModel?: { modelId: string; providerId: ProviderId };
  modelPickerScope: ModelPickerScope;
  primaryProvider: ProviderId;
}

interface ProviderPreferences {
  modelPickerScope: ModelPickerScope;
  primaryProvider: ProviderId;
}

interface ProviderSettingsOptions {
  agentDir?: string;
  cwd?: string;
  openExternal?: (url: string) => Promise<void>;
}

const providerNames: Record<ProviderId, string> = {
  'deepseek': 'DeepSeek',
  'openai-codex': 'ChatGPT',
  'opencode': 'OpenCode',
};

const defaultPreferences: ProviderPreferences = {
  modelPickerScope: 'primary-provider',
  primaryProvider: 'openai-codex',
};

export class ProviderSettings {
  private readonly preferencesPath: string;

  constructor(
    userDataPath: string,
    private readonly options: ProviderSettingsOptions = {},
  ) {
    this.preferencesPath = join(userDataPath, 'model-providers.json');
  }

  async snapshot(): Promise<ProvidersSnapshot> {
    const [preferences, services] = await Promise.all([this.readPreferences(), this.createServices()]);
    const { modelRuntime, settingsManager } = services;
    const availableModels = await modelRuntime.getAvailable();
    const enabledModels = settingsManager.getEnabledModels();
    const enabledAvailableModels = this.enabledModels(availableModels, enabledModels);
    const providers = await Promise.all(PROVIDER_IDS.map(async (id) => {
      const provider = modelRuntime.getProvider(id);
      const status = await modelRuntime.getProviderAuthStatus(id);
      const models = enabledAvailableModels.filter(model => model.provider === id).map(toModelSnapshot);
      return {
        authType: provider?.auth?.oauth ? 'oauth' as const : 'api_key' as const,
        configured: Boolean(status.configured) || models.length > 0,
        id,
        models,
        name: providerNames[id],
        primary: preferences.primaryProvider === id,
      };
    }));
    const provider = settingsManager.getDefaultProvider();
    const model = settingsManager.getDefaultModel();

    return {
      availableProviders: providers,
      connectedProviders: providers.filter(provider => provider.configured),
      ...(isProviderId(provider) && typeof model === 'string' ? { defaultModel: { modelId: model, providerId: provider } } : {}),
      modelPickerScope: preferences.modelPickerScope,
      primaryProvider: preferences.primaryProvider,
    };
  }

  async saveApiKey(providerId: ProviderId, apiKey: string): Promise<ProvidersSnapshot> {
    if (!apiKey.trim())
      throw new TypeError('API Key 不能为空');
    await this.writeApiKey(providerId, apiKey.trim());
    if ((await this.readPreferences()).primaryProvider === providerId)
      await this.setDefaultToFirstProviderModel(providerId);
    return this.snapshot();
  }

  async removeProvider(providerId: ProviderId): Promise<ProvidersSnapshot> {
    const auth = await this.readAuth();
    delete auth[providerId];
    await this.writeAuth(auth);
    return this.snapshot();
  }

  async loginChatGPT(): Promise<ProvidersSnapshot> {
    const { modelRuntime } = await this.createServices();
    await modelRuntime.login('openai-codex', 'oauth', {
      notify: async (event: unknown) => {
        if (isRecord(event) && event.type === 'auth_url' && typeof event.url === 'string')
          await this.options.openExternal?.(event.url);
      },
      prompt: async () => {
        throw new Error('ChatGPT 登录不支持在应用内输入凭据');
      },
    });
    return this.snapshot();
  }

  async setPrimaryProvider(providerId: ProviderId): Promise<ProvidersSnapshot> {
    await this.writePreferences({ ...(await this.readPreferences()), primaryProvider: providerId });
    await this.setDefaultToFirstProviderModel(providerId);
    return this.snapshot();
  }

  async setModelPickerScope(modelPickerScope: ModelPickerScope): Promise<ProvidersSnapshot> {
    await this.writePreferences({ ...(await this.readPreferences()), modelPickerScope });
    return this.snapshot();
  }

  async setDefaultModel(providerId: ProviderId, modelId: string): Promise<ProvidersSnapshot> {
    const { modelRuntime, settingsManager } = await this.createServices();
    if (!(await modelRuntime.getAvailable()).some(model => model.provider === providerId && model.id === modelId))
      throw new TypeError('默认模型不可用');
    settingsManager.setDefaultModelAndProvider(providerId, modelId);
    return this.snapshot();
  }

  private async createServices() {
    const { createAgentSessionServices } = await import('@earendil-works/pi-coding-agent');
    return createAgentSessionServices({
      ...(this.options.agentDir ? { agentDir: this.options.agentDir } : {}),
      cwd: this.options.cwd ?? process.cwd(),
    });
  }

  private async authPath(): Promise<string> {
    if (this.options.agentDir)
      return join(this.options.agentDir, 'auth.json');
    const { getAgentDir } = await import('@earendil-works/pi-coding-agent');
    return join(getAgentDir(), 'auth.json');
  }

  private async readAuth(): Promise<Record<string, unknown>> {
    try {
      const parsed = JSON.parse(await readFile(await this.authPath(), 'utf8'));
      return isRecord(parsed) ? parsed : {};
    }
    catch {
      return {};
    }
  }

  private async writeApiKey(providerId: ProviderId, apiKey: string): Promise<void> {
    const auth = await this.readAuth();
    auth[providerId] = { key: apiKey, type: 'api_key' };
    await this.writeAuth(auth);
  }

  private async writeAuth(auth: Record<string, unknown>): Promise<void> {
    const path = await this.authPath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
  }

  private async setDefaultToFirstProviderModel(providerId: ProviderId): Promise<void> {
    const { modelRuntime, settingsManager } = await this.createServices();
    const model = (await modelRuntime.getAvailable()).find(model => model.provider === providerId);
    if (model)
      settingsManager.setDefaultModelAndProvider(providerId, model.id);
  }

  private enabledModels(models: ModelLike[], enabledModels: unknown): ModelLike[] {
    const enabled = Array.isArray(enabledModels) ? new Set(enabledModels.filter((value): value is string => typeof value === 'string')) : undefined;
    const scoped = models.filter((model) => {
      if (!isProviderId(model.provider))
        return false;
      return !enabled?.size || enabled.has(`${model.provider}/${model.id}`) || enabled.has(model.id);
    });
    return scoped.length ? scoped : models.filter(model => isProviderId(model.provider));
  }

  private async readPreferences(): Promise<ProviderPreferences> {
    try {
      const parsed = JSON.parse(await readFile(this.preferencesPath, 'utf8')) as Partial<ProviderPreferences>;
      return {
        modelPickerScope: parsed.modelPickerScope === 'all-providers' ? 'all-providers' : defaultPreferences.modelPickerScope,
        primaryProvider: isProviderId(parsed.primaryProvider) ? parsed.primaryProvider : defaultPreferences.primaryProvider,
      };
    }
    catch {
      return defaultPreferences;
    }
  }

  private async writePreferences(preferences: ProviderPreferences): Promise<void> {
    await mkdir(dirname(this.preferencesPath), { recursive: true });
    await writeFile(this.preferencesPath, `${JSON.stringify(preferences, null, 2)}\n`);
  }
}

interface ModelLike {
  id: string;
  input?: unknown;
  name?: string;
  provider: string;
  reasoning?: unknown;
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && PROVIDER_IDS.includes(value as ProviderId);
}

export function isModelPickerScope(value: unknown): value is ModelPickerScope {
  return value === 'primary-provider' || value === 'all-providers';
}

function toModelSnapshot(model: ModelLike): ProviderModelSnapshot {
  return {
    id: model.id,
    name: model.name ?? model.id,
    providerId: model.provider as ProviderId,
    reasoning: model.reasoning === true,
    supportsImages: Array.isArray(model.input) && model.input.includes('image'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
