import type {
  DefaultPackageManager,
  DefaultResourceLoader,
  ModelRuntime,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';

export type WorkspaceId = string;

export type RuntimeAuthType = 'oauth' | 'api_key' | 'none';
export type RuntimeProviderAuthSource = 'none' | 'oauth' | 'auth_file' | 'env' | 'external';

export interface RuntimeModelRecord {
  readonly providerId: string;
  readonly providerName: string;
  readonly modelId: string;
  readonly label: string;
  readonly available: boolean;
  readonly authType: RuntimeAuthType;
  readonly reasoning: boolean;
  readonly supportsImages: boolean;
}

export interface RuntimeProviderRecord {
  readonly id: string;
  readonly name: string;
  readonly hasAuth: boolean;
  readonly authType: RuntimeAuthType;
  readonly authSource: RuntimeProviderAuthSource;
  readonly oauthSupported: boolean;
  readonly apiKeySetupSupported: boolean;
}

export interface WorkspaceRef {
  readonly workspaceId: WorkspaceId;
  readonly path: string;
  readonly displayName?: string;
}

type SourceScope = 'user' | 'project' | 'temporary';

export interface PathMetadata {
  source: string;
  scope: SourceScope;
  origin: 'package' | 'top-level';
  baseDir?: string;
}

export interface ResolvedResource {
  path: string;
  enabled: boolean;
  metadata: PathMetadata;
}

export interface ResolvedPaths {
  extensions: ResolvedResource[];
  skills: ResolvedResource[];
  prompts: ResolvedResource[];
  themes: ResolvedResource[];
}

export interface RuntimeResourceDriver {

}

export interface SessionDriver {

}

// -----------------------------------

export interface RuntimeSupervisorOptions {
  readonly agentDir?: string;
  readonly modelRuntime?: ModelRuntime;
}

export interface RuntimeDependencies {
  readonly agentDir: string;
  readonly modelRuntime: ModelRuntime;
}

export interface RuntimeContext {
  readonly workspace: WorkspaceRef;
  readonly settingsManager: SettingsManager;
  readonly packageManager: DefaultPackageManager;
  readonly resourceLoader: DefaultResourceLoader;
}
