import type { SessionDriver } from './types.ts';
import { RuntimeSupervisor } from './runtime-supervisor.ts';

export class PiSdkDriver implements SessionDriver {
  runtimeSupervisor: RuntimeSupervisor;

  constructor() {
    this.runtimeSupervisor = new RuntimeSupervisor();
  }
}

export function createPiSdkDriver() {
  return new PiSdkDriver();
}
