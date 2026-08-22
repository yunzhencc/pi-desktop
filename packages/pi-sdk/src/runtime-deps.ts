import type { RuntimeSupervisorOptions } from './runtime-supervisor.ts';
import { join, resolve } from 'node:path';
import { getAgentDir, ModelRuntime } from '@earendil-works/pi-coding-agent';
import { CustomProviderStore } from './custom-provider-store.ts';

export interface RuntimeDependencies {
  readonly agentDir: string;
  readonly modelRuntime: ModelRuntime;
  readonly customProviderStore: CustomProviderStore;
}

export async function createRuntimeDependencies(options: RuntimeSupervisorOptions = {}): Promise<RuntimeDependencies> {
  const agentDir = resolve(options.agentDir ?? getAgentDir());
  const modelsJsonPath = join(agentDir, 'models.json');
  const modelRuntime
    = options.modelRuntime
      ?? await ModelRuntime.create({
        authPath: join(agentDir, 'auth.json'),
        modelsPath: modelsJsonPath,
        allowModelNetwork: false,
      });
  const customProviderStore = options.customProviderStore ?? new CustomProviderStore(modelsJsonPath);
  return {
    agentDir,
    modelRuntime,
    customProviderStore,
  };
}
