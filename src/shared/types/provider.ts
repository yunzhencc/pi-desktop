import type { PrimaryScopeEnum } from '../config';

export type ProviderId = string;
export type ModelPickerScope = typeof PrimaryScopeEnum.valueType;

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
