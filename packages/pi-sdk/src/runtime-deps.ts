import type { RuntimeDependencies, RuntimeSupervisorOptions } from './types';
import { join, resolve } from 'node:path';
import { getAgentDir, ModelRuntime } from '@earendil-works/pi-coding-agent';

export async function createRuntimeDependencies(options: RuntimeSupervisorOptions = {}): Promise<RuntimeDependencies> {
  const agentDir = resolve(options.agentDir ?? getAgentDir());
  const modelRuntime = options.modelRuntime ?? await ModelRuntime.create({
    modelsPath: join(agentDir, 'models.json'),
    allowModelNetwork: false,
  });

  return {
    agentDir,
    modelRuntime,
  };
}
