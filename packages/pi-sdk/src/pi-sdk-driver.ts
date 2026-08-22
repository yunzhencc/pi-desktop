import type { ModelRuntime } from '@earendil-works/pi-coding-agent';
import type { RuntimeSupervisorOptions } from './runtime-supervisor.ts';
import type { PiSdkDriverOptions, SyncWorkspaceResult } from './session-supervisor.ts';
import type { GenerateThreadTitleOptions } from './thread-title-generator.ts';
import type { CreateSessionOptions, ForkSessionOptions, ForkSessionResult, HostUiResponse, NavigateSessionTreeOptions, NavigateSessionTreeResult, SessionCatalogSnapshot, SessionDriver, SessionEventListener, SessionMessageInput, SessionModelSelection, SessionQueuedMessage, SessionRef, SessionSnapshot, SessionTreeSnapshot, Unsubscribe, WorkspaceCatalogSnapshot, WorkspaceId, WorkspaceRef } from './types.ts';
import { createRuntimeDependencies } from './runtime-deps.ts';
import { RuntimeSupervisor } from './runtime-supervisor.ts';
import {

  SessionSupervisor,

} from './session-supervisor.ts';
import { generateThreadTitle } from './thread-title-generator.ts';

export interface PiSdkDriverConfig extends PiSdkDriverOptions, RuntimeSupervisorOptions {}

export class PiSdkDriver implements SessionDriver {
  private readonly supervisorPromise: Promise<SessionSupervisor>;
  private readonly dependenciesPromise: ReturnType<typeof createRuntimeDependencies>;
  private readonly generateThreadTitleOverride:
    | ((workspace: WorkspaceRef, options: GenerateThreadTitleOptions) => Promise<string | null | undefined>)
    | undefined;

  readonly runtimeSupervisor: RuntimeSupervisor;

  constructor(options: PiSdkDriverConfig = {}) {
    this.generateThreadTitleOverride = options.generateThreadTitleOverride;
    this.dependenciesPromise = createRuntimeDependencies(options);
    this.supervisorPromise = this.dependenciesPromise.then(deps =>
      new SessionSupervisor({ ...options, modelRuntime: deps.modelRuntime }),
    );
    this.runtimeSupervisor = new RuntimeSupervisor({ ...options, dependenciesPromise: this.dependenciesPromise });
  }

  private supervisor(): Promise<SessionSupervisor> {
    return this.supervisorPromise;
  }

  async createSession(workspace: WorkspaceRef, options?: CreateSessionOptions): Promise<SessionSnapshot> {
    return (await this.supervisor()).createSession(workspace, options);
  }

  async validateForkSession(sourceRef: SessionRef, options: ForkSessionOptions): Promise<void> {
    return (await this.supervisor()).validateForkSession(sourceRef, options);
  }

  async forkSession(sourceRef: SessionRef, options: ForkSessionOptions): Promise<ForkSessionResult> {
    return (await this.supervisor()).forkSession(sourceRef, options);
  }

  async openSession(sessionRef: SessionRef): Promise<SessionSnapshot> {
    return (await this.supervisor()).openSession(sessionRef);
  }

  async archiveSession(sessionRef: SessionRef): Promise<void> {
    return (await this.supervisor()).archiveSession(sessionRef);
  }

  async unarchiveSession(sessionRef: SessionRef): Promise<void> {
    return (await this.supervisor()).unarchiveSession(sessionRef);
  }

  async sendUserMessage(sessionRef: SessionRef, input: SessionMessageInput): Promise<void> {
    return (await this.supervisor()).sendUserMessage(sessionRef, input);
  }

  async replaceQueuedMessages(sessionRef: SessionRef, messages: readonly SessionQueuedMessage[]): Promise<void> {
    return (await this.supervisor()).replaceQueuedMessages(sessionRef, messages);
  }

  async cancelCurrentRun(sessionRef: SessionRef): Promise<void> {
    return (await this.supervisor()).cancelCurrentRun(sessionRef);
  }

  async setSessionModel(sessionRef: SessionRef, selection: SessionModelSelection): Promise<void> {
    return (await this.supervisor()).setSessionModel(sessionRef, selection);
  }

  async setSessionThinkingLevel(sessionRef: SessionRef, thinkingLevel: string): Promise<void> {
    return (await this.supervisor()).setSessionThinkingLevel(sessionRef, thinkingLevel);
  }

  async renameSession(sessionRef: SessionRef, title: string): Promise<void> {
    return (await this.supervisor()).renameSession(sessionRef, title);
  }

  async compactSession(sessionRef: SessionRef, customInstructions?: string): Promise<void> {
    return (await this.supervisor()).compactSession(sessionRef, customInstructions);
  }

  async reloadSession(sessionRef: SessionRef): Promise<void> {
    return (await this.supervisor()).reloadSession(sessionRef);
  }

  async getSessionTree(sessionRef: SessionRef): Promise<SessionTreeSnapshot> {
    return (await this.supervisor()).getSessionTree(sessionRef);
  }

  navigateSessionTree(
    sessionRef: SessionRef,
    targetId: string,
    options?: NavigateSessionTreeOptions,
  ): Promise<NavigateSessionTreeResult> {
    return this.supervisor().then(supervisor => supervisor.navigateSessionTree(sessionRef, targetId, options));
  }

  getSessionCommands(sessionRef: SessionRef) {
    return this.supervisor().then(supervisor => supervisor.getSessionCommands(sessionRef));
  }

  async respondToHostUiRequest(sessionRef: SessionRef, response: HostUiResponse): Promise<void> {
    return (await this.supervisor()).respondToHostUiRequest(sessionRef, response);
  }

  subscribe(sessionRef: SessionRef, listener: SessionEventListener): Unsubscribe {
    let unsubscribe: Unsubscribe | undefined;
    let cancelled = false;
    void this.supervisor().then((supervisor) => {
      if (cancelled) {
        return;
      }
      unsubscribe = supervisor.subscribe(sessionRef, listener);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }

  async closeSession(sessionRef: SessionRef): Promise<void> {
    return (await this.supervisor()).closeSession(sessionRef);
  }

  async listWorkspaces(): Promise<WorkspaceCatalogSnapshot> {
    return (await this.supervisor()).listWorkspaces();
  }

  async listSessions(workspaceId?: WorkspaceId): Promise<SessionCatalogSnapshot> {
    return (await this.supervisor()).listSessions(workspaceId);
  }

  async syncWorkspace(path: string, displayName?: string): Promise<SyncWorkspaceResult> {
    return (await this.supervisor()).syncWorkspace(path, displayName);
  }

  async reconcileWorkspace(workspaceId: WorkspaceId): Promise<SyncWorkspaceResult | undefined> {
    return (await this.supervisor()).reconcileWorkspace(workspaceId);
  }

  async getSessionFilePath(sessionRef: SessionRef): Promise<string | undefined> {
    return (await this.supervisor()).getSessionFilePath(sessionRef);
  }

  async renameWorkspace(workspaceId: WorkspaceId, displayName: string) {
    return (await this.supervisor()).renameWorkspace(workspaceId, displayName);
  }

  async removeWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return (await this.supervisor()).removeWorkspace(workspaceId);
  }

  async getTranscript(sessionRef: SessionRef) {
    return (await this.supervisor()).getTranscript(sessionRef);
  }

  async getSessionSchemaInfo(sessionRef: SessionRef) {
    return (await this.supervisor()).getSessionSchemaInfo(sessionRef);
  }

  async generateThreadTitle(workspace: WorkspaceRef, options: GenerateThreadTitleOptions): Promise<string | null> {
    if (this.generateThreadTitleOverride) {
      const override = await this.generateThreadTitleOverride(workspace, options);
      if (override !== undefined) {
        return override;
      }
    }
    return generateThreadTitle(workspace, options, {
      ...(await this.threadTitleDeps()),
    });
  }

  private async threadTitleDeps(): Promise<{
    agentDir: string;
    modelRuntime: ModelRuntime;
  }> {
    const { agentDir, modelRuntime } = await this.dependenciesPromise;
    return { agentDir, modelRuntime };
  }
}

export function createPiSdkDriver(options?: PiSdkDriverConfig): PiSdkDriver {
  return new PiSdkDriver(options);
}
