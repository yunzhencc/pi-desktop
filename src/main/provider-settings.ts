import type { ModelPickerScope, ProviderId, ProviderModelSnapshot, ProviderSnapshot, ProvidersSnapshot } from '@shared/types';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { PrimaryScopeEnum } from '@shared/config';
import { PROVIDER_ERROR_CHATGPT_UNSUPPORTED_REGION } from '../shared/provider-errors';

interface ProviderPreferences {
  modelPickerScope: ModelPickerScope;
  primaryProvider: ProviderId;
}

interface ProviderSettingsOptions {
  agentDir?: string;
  createServices?: () => Promise<ProviderSettingsServices>;
  cwd?: string;
  openExternal?: (url: string) => Promise<void>;
}

const defaultPreferences: ProviderPreferences = {
  modelPickerScope: PrimaryScopeEnum.Primary,
  primaryProvider: 'openai-codex',
};

const oauthProviderIds = new Set(['anthropic', 'github-copilot', 'openai-codex']);

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
    const enabledAvailableModels = await this.enabledModels(modelRuntime, settingsManager.getEnabledModels());
    const providers: ProviderSnapshot[] = [];
    for (const provider of modelRuntime.getProviders() as RuntimeProviderLike[]) {
      const id = provider.id;
      const status = await modelRuntime.getProviderAuthStatus(id);
      if (!isVisibleProvider(provider, status))
        continue;
      const models = enabledAvailableModels.filter(model => model.provider === id).map(toModelSnapshot);
      providers.push({
        authType: provider?.auth?.oauth ? 'oauth' as const : 'api_key' as const,
        configured: Boolean(status.configured) || models.length > 0,
        id,
        models,
        name: providerDisplayName(provider),
        primary: preferences.primaryProvider === id,
      });
    }
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
    await this.assertApiKeyProvider(providerId);
    await this.writeApiKey(providerId, apiKey.trim());
    if ((await this.readPreferences()).primaryProvider === providerId)
      await this.setDefaultToFirstProviderModel(providerId);
    return this.snapshot();
  }

  async removeProvider(providerId: ProviderId): Promise<ProvidersSnapshot> {
    await this.assertApiKeyProvider(providerId);
    const auth = await this.readAuth();
    delete auth[providerId];
    await this.writeAuth(auth);
    return this.snapshot();
  }

  async loginChatGPT(): Promise<ProvidersSnapshot> {
    const { modelRuntime } = await this.createServices();
    try {
      await modelRuntime.login('openai-codex', 'oauth', {
        notify: async (event: unknown) => {
          if (isRecord(event) && event.type === 'auth_url' && typeof event.url === 'string')
            await this.options.openExternal?.(event.url);
        },
        prompt: promptForChatGPTLogin,
      });
    }
    catch (error) {
      if (isUnsupportedOpenAIRegionError(error)) {
        throw new Error(PROVIDER_ERROR_CHATGPT_UNSUPPORTED_REGION);
      }
      throw error;
    }
    return this.snapshot();
  }

  async setPrimaryProvider(providerId: ProviderId): Promise<ProvidersSnapshot> {
    await this.assertProvider(providerId);
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

  private async assertApiKeyProvider(providerId: ProviderId): Promise<void> {
    const { modelRuntime } = await this.createServices();
    const provider = (modelRuntime.getProviders() as RuntimeProviderLike[]).find(provider => provider.id === providerId);
    const status = provider ? await modelRuntime.getProviderAuthStatus(provider.id) : undefined;
    if (!provider?.auth?.apiKey || !status || !isVisibleProvider(provider, status))
      throw new TypeError('无效的模型供应商');
  }

  private async assertProvider(providerId: ProviderId): Promise<void> {
    const { modelRuntime } = await this.createServices();
    const provider = (modelRuntime.getProviders() as RuntimeProviderLike[]).find(provider => provider.id === providerId);
    const status = provider ? await modelRuntime.getProviderAuthStatus(provider.id) : undefined;
    if (!provider || !status || !isVisibleProvider(provider, status))
      throw new TypeError('无效的模型供应商');
  }

  private async createServices() {
    if (this.options.createServices)
      return this.options.createServices();
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

  private async enabledModels(modelRuntime: ModelRuntimeLike, enabledModels: unknown): Promise<ModelLike[]> {
    const available = await modelRuntime.getAvailable();
    const enabled = Array.isArray(enabledModels) ? enabledModels.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : [];
    if (!enabled.length)
      return available;
    const { resolveModelScopeWithDiagnostics } = await import('@earendil-works/pi-coding-agent');
    const { scopedModels } = await resolveModelScopeWithDiagnostics(enabled, { getAvailable: async () => available });
    return scopedModels.length ? scopedModels.map((scoped: { model: ModelLike }) => scoped.model) : available;
  }

  private async readPreferences(): Promise<ProviderPreferences> {
    try {
      const parsed = JSON.parse(await readFile(this.preferencesPath, 'utf8')) as Partial<ProviderPreferences>;
      return {
        modelPickerScope: parsed.modelPickerScope === PrimaryScopeEnum.All ? PrimaryScopeEnum.All : defaultPreferences.modelPickerScope,
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

interface ModelRuntimeLike {
  getAvailable: () => Promise<ModelLike[]>;
  getProviderAuthStatus: (providerId: string) => Promise<ProviderAuthStatusLike> | ProviderAuthStatusLike;
  getProviders: () => RuntimeProviderLike[];
  login: (providerId: string, type: 'oauth', interaction: AuthInteractionLike) => Promise<unknown>;
}

interface SettingsManagerLike {
  getDefaultModel: () => unknown;
  getDefaultProvider: () => unknown;
  getEnabledModels: () => unknown;
  setDefaultModelAndProvider: (providerId: string, modelId: string) => void;
}

interface ProviderSettingsServices {
  modelRuntime: ModelRuntimeLike;
  settingsManager: SettingsManagerLike;
}

type AuthPromptLike = {
  signal?: AbortSignal;
} & ({
  options: readonly { id: string; label: string }[];
  type: 'select';
} | {
  type: 'manual_code' | 'secret' | 'text';
});

interface AuthInteractionLike {
  notify: (event: unknown) => void | Promise<void>;
  prompt: (prompt: AuthPromptLike) => Promise<string>;
  signal?: AbortSignal;
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isModelPickerScope(value: unknown): value is ModelPickerScope {
  return PrimaryScopeEnum.has(value);
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

interface RuntimeProviderLike {
  auth?: {
    apiKey?: unknown;
    oauth?: unknown;
  };
  id: string;
  name?: string;
}

interface ProviderAuthStatusLike {
  configured?: unknown;
  source?: unknown;
}

function isVisibleProvider(provider: RuntimeProviderLike, status: ProviderAuthStatusLike): boolean {
  if (provider.id === 'openai-codex')
    return true;
  if (oauthProviderIds.has(provider.id) || !provider.auth?.apiKey)
    return false;
  return status.source !== 'models_json_key';
}

function providerDisplayName(provider: RuntimeProviderLike): string {
  if (provider.id === 'openai-codex')
    return 'ChatGPT';
  if (provider.id === 'deepseek')
    return 'DeepSeek';
  return provider.name ?? provider.id;
}

function promptForChatGPTLogin(prompt: AuthPromptLike): Promise<string> {
  if (prompt.type === 'select')
    return Promise.resolve(prompt.options.find(option => option.label.toLocaleLowerCase().includes('browser'))?.id ?? prompt.options[0]?.id ?? '');
  if (prompt.type === 'manual_code')
    return waitForPromptAbort(prompt.signal);
  return Promise.reject(new Error('ChatGPT 登录不支持在应用内输入凭据'));
}

function waitForPromptAbort(signal?: AbortSignal): Promise<string> {
  return new Promise((_resolve, reject) => {
    const abort = () => reject(new Error('Login cancelled'));
    if (!signal)
      return;
    if (signal.aborted)
      abort();
    else
      signal.addEventListener('abort', abort, { once: true });
  });
}

function isUnsupportedOpenAIRegionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('unsupported_country_region_territory');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
