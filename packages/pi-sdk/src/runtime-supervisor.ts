import type {
  ResolvedPaths,
  RuntimeContext,
  RuntimeDependencies,
  RuntimeModelRecord,
  RuntimeProviderRecord,
  RuntimeResourceDriver,
  RuntimeSupervisorOptions,
} from './types.ts';
import { DefaultPackageManager } from '@earendil-works/pi-coding-agent';
import { createSettingsManagerWithoutNpmPackages, isGlobalNpmLookupError } from './npm-package-fallback.ts';
import { createRuntimeDependencies } from './runtime-deps.ts';

export class RuntimeSupervisor implements RuntimeResourceDriver {
  private dependenciesPromise: Promise<RuntimeDependencies> | undefined;
  private readonly options: RuntimeSupervisorOptions;

  constructor(options: RuntimeSupervisorOptions = {}) {
    this.options = options;
  }

  private dependencies(): Promise<RuntimeDependencies> {
    return (this.dependenciesPromise ??= createRuntimeDependencies(this.options));
  }

  async buildSnapshot() {
    const [providers] = await Promise.all([
      this.buildProviderRecords(),
      this.buildModelRecords(),
    ]);

    // eslint-disable-next-line no-console
    console.log(providers);
  }

  private async resolveRuntimePaths(context: RuntimeContext): Promise<ResolvedPaths> {
    try {
      return await context.packageManager.resolve();
    }
    catch (error) {
      if (!isGlobalNpmLookupError(error)) {
        throw error;
      }

      const fallbackSettingsManager = createSettingsManagerWithoutNpmPackages(context.settingsManager);

      if (!fallbackSettingsManager) {
        throw error;
      }

      const { agentDir } = await this.dependencies();
      const fallbackPackageManager = new DefaultPackageManager({
        cwd: context.workspace.path,
        agentDir,
        settingsManager: fallbackSettingsManager,
      });
      return fallbackPackageManager.resolve();
    }
  }

  private async buildProviderRecords(): Promise<RuntimeProviderRecord[]> {
    const { modelRuntime } = await this.dependencies();

    return Promise.all(
      modelRuntime
        .getProviders()
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(async (provider) => {
          const status = await modelRuntime.checkAuth(provider.id);

          const result: RuntimeProviderRecord = {
            id: provider.id,
            name: provider.name ?? provider.id,
            hasAuth: Boolean(status),
            authType: (provider.auth?.oauth ? 'oauth' : (provider.auth?.apiKey ? 'api_key' : 'none')),
            authSource: (status?.source ?? 'none') as RuntimeProviderRecord['authSource'],
            oauthSupported: Boolean(provider.auth?.oauth),
            apiKeySetupSupported: Boolean(provider.auth?.apiKey),
          };

          return result;
        }),
    );
  }

  private async buildModelRecords(): Promise<RuntimeModelRecord[]> {
    const { modelRuntime } = await this.dependencies();

    await modelRuntime.refresh();

    const availableKeys = new Set(
      (await modelRuntime.getAvailable()).map(model => `${model.provider}:${model.id}`),
    );
    const providers = new Map((await this.buildProviderRecords()).map(provider => [provider.id, provider]));

    return modelRuntime.getModels().map<RuntimeModelRecord>((model) => {
      const provider = providers.get(model.provider);

      return {
        providerId: model.provider,
        providerName: provider?.name ?? model.provider,
        modelId: model.id,
        label: model.name,
        available: availableKeys.has(`${model.provider}:${model.id}`),
        authType: provider?.authType ?? 'none',
        reasoning: Boolean(model.reasoning),
        supportsImages: model.input.includes('image'),
      };
    }).sort((left, right) =>
      left.providerId === right.providerId
        ? left.modelId.localeCompare(right.modelId)
        : left.providerId.localeCompare(right.providerId),
    );
  }
}
