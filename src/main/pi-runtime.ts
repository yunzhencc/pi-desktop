import type { AttachmentStore } from './attachments';
import { join, resolve } from 'node:path';

export type TranscriptUpdate
  = | { done?: boolean; entryId?: string; text: string; timestamp?: number; type: 'assistant' }
    | { text: string; type: 'error' }
    | { sessionPath: string; type: 'session' }
    | { completedAtMs?: number; sessionPath?: string; startedAtMs?: number; status: 'running' | 'settled'; type: 'status'; workStatus?: WorkStatus }
    | { args?: unknown; output?: unknown; sessionPath?: string; status: 'completed' | 'failed' | 'running'; toolCallId: string; toolName: string; type: 'tool' };

type WorkStatus = 'stopped' | 'worked';
const workedForEntryType = 'pi-desktop-worked-for';

export interface PiSessionSummary {
  firstMessage: string;
  id: string;
  modifiedAt: string;
  path: string;
}

export interface PiSessionSnapshot {
  messages: Array<
    | { entryId: string; role: 'assistant' | 'user'; text: string; timestamp: number }
    | { args?: unknown; output?: unknown; role: 'tool'; status: 'completed' | 'failed' | 'running'; toolCallId: string; toolName: string }
    | { completedAtMs: number; role: 'work'; startedAtMs: number; status: WorkStatus }
  >;
  path: string;
}

interface PiSession {
  abort?: () => Promise<void>;
  editLastUserMessage?: () => Promise<{ cancelled: boolean; editorText?: string }>;
  forkAssistantMessage?: (entryId: string) => string | undefined;
  getLastAssistantEntryId?: () => string | undefined;
  getSessionPath?: () => string | undefined;
  isStreaming?: boolean;
  prompt: (text: string, options?: { images?: Array<{ type: 'image'; data: string; mimeType: string }>; streamingBehavior?: 'steer' }) => Promise<void>;
  recordWorkDuration?: (duration: { completedAtMs: number; startedAtMs: number; status: WorkStatus }) => void;
  subscribe: (listener: (event: unknown) => void) => () => void;
  dispose?: () => void;
}

type SessionFactory = (agentDir?: string, workspacePath?: string, sessionPath?: string) => Promise<PiSession>;
type SessionLister = (workspacePath: string, agentDir?: string) => Promise<PiSessionSummary[]>;

interface PiRuntimeOptions {
  agentDir?: string;
  createSession?: SessionFactory;
  listSessions?: SessionLister;
}

export class PiRuntime {
  #session: PiSession | undefined;
  #sessionUnsubscribe: (() => void) | undefined;
  #listeners = new Set<(update: TranscriptUpdate) => void>();
  #promptActive = false;
  #streamedAssistantText = '';
  #turnStartedAtMs: number | undefined;
  #abortRequested = false;
  #sessionPath: string | undefined;
  #workspacePath: string | undefined;
  private readonly agentDir: string | undefined;
  private readonly createSession: SessionFactory;
  private readonly listSessions: SessionLister;

  constructor(
    private readonly attachments: AttachmentStore,
    optionsOrCreateSession: PiRuntimeOptions | SessionFactory = createDefaultSession,
  ) {
    if (typeof optionsOrCreateSession === 'function') {
      this.createSession = optionsOrCreateSession;
      this.listSessions = listDefaultSessions;
    }
    else {
      this.agentDir = optionsOrCreateSession.agentDir;
      this.createSession = optionsOrCreateSession.createSession ?? createDefaultSession;
      this.listSessions = optionsOrCreateSession.listSessions ?? listDefaultSessions;
    }
  }

  subscribe(listener: (update: TranscriptUpdate) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  setWorkspace(path: string): void {
    if (!path.trim())
      throw new TypeError('工作区路径不能为空');
    if (this.#workspacePath === path)
      return;
    this.#workspacePath = path;
    this.#sessionPath = undefined;
    this.#resetSession();
  }

  clearWorkspace(): void {
    if (!this.#workspacePath)
      return;
    this.#workspacePath = undefined;
    this.#sessionPath = undefined;
    this.#resetSession();
  }

  startNewConversation(): void {
    this.#sessionPath = undefined;
    this.#resetSession();
  }

  refreshModelSettings(): void {
    this.#resetSession();
  }

  async listWorkspaceSessions(path: string): Promise<PiSessionSummary[]> {
    if (!path.trim())
      throw new TypeError('工作区路径不能为空');
    return this.listSessions(path, this.agentDir);
  }

  async openSession(path: string): Promise<PiSessionSnapshot> {
    if (!path.trim())
      throw new TypeError('会话路径不能为空');
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const session = SessionManager.open(path);
    this.#sessionPath = path;
    this.#resetSession();
    return {
      messages: toPiSessionMessages(session.getBranch()),
      path,
    };
  }

  async forkAssistantMessage(entryId: string): Promise<PiSessionSnapshot> {
    if (this.#promptActive || this.#session?.isStreaming)
      throw new Error('请等待当前回复完成后再创建分支');
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const path = this.#session?.forkAssistantMessage?.(entryId)
      ?? (this.#sessionPath ? SessionManager.open(this.#sessionPath).createBranchedSession(entryId) : undefined);
    if (!path)
      throw new Error('无法从该回复创建分支');
    const fork = SessionManager.open(path);
    this.#sessionPath = path;
    this.#resetSession();
    return { messages: toPiSessionMessages(fork.getBranch()), path };
  }

  #resetSession(): void {
    this.#sessionUnsubscribe?.();
    this.#session?.dispose?.();
    this.#session = undefined;
    this.#sessionUnsubscribe = undefined;
    this.#promptActive = false;
    this.#turnStartedAtMs = undefined;
    this.#abortRequested = false;
  }

  async send(prompt: string, attachmentIds: string[]): Promise<void> {
    try {
      const attachments = await this.attachments.toPrompt(attachmentIds);
      const session = await this.#getSession();
      const options = {
        ...(attachments.images.length ? { images: attachments.images } : {}),
        ...(this.#promptActive || session.isStreaming ? { streamingBehavior: 'steer' as const } : {}),
      };
      const startsTurn = !this.#promptActive && !session.isStreaming;
      this.#promptActive = true;
      if (startsTurn) {
        this.#turnStartedAtMs = Date.now();
        this.#abortRequested = false;
        this.#emit({ ...this.#sessionMetadata(), startedAtMs: this.#turnStartedAtMs, status: 'running', type: 'status' });
      }
      void Promise.resolve(session.prompt(`${prompt}${attachments.text ? `\n${attachments.text}` : ''}`, Object.keys(options).length ? options : undefined)).catch((error) => {
        if (!session.isStreaming)
          this.#settleTurn('worked');
        this.#emitError(error);
      });
    }
    catch (error) {
      this.#emitError(error);
      throw error;
    }
  }

  async editLastUserMessage(message?: string): Promise<string | undefined> {
    const session = await this.#getSession();
    if (this.#promptActive || session.isStreaming)
      throw new Error('请等待当前回复完成后再编辑消息');
    if (!session.editLastUserMessage)
      throw new Error('当前 Pi 会话不支持编辑消息');

    const result = await session.editLastUserMessage();
    if (result.cancelled)
      return undefined;
    this.#streamedAssistantText = '';
    if (message != null) {
      await this.send(message, []);
      return message;
    }
    return result.editorText;
  }

  dispose(): void {
    this.#sessionUnsubscribe?.();
    this.#session?.dispose?.();
    this.#listeners.clear();
    this.#session = undefined;
    this.#sessionUnsubscribe = undefined;
    this.#promptActive = false;
    this.#turnStartedAtMs = undefined;
    this.#abortRequested = false;
  }

  async abort(): Promise<void> {
    const session = this.#session;
    if (session == null || (!this.#promptActive && !session.isStreaming))
      return;

    if (session.abort == null) {
      this.#settleTurn('stopped');
      return;
    }

    try {
      this.#abortRequested = true;
      await session.abort();
    }
    catch (error) {
      this.#settleTurn('stopped');
      this.#emitError(error);
      throw error;
    }
  }

  async #getSession(): Promise<PiSession> {
    if (this.#session)
      return this.#session;
    if (!this.#workspacePath)
      throw new Error('请先选择工作区');

    const session = await this.createSession(this.agentDir, this.#workspacePath, this.#sessionPath);
    this.#sessionUnsubscribe = session.subscribe(event => this.#handleEvent(event));
    this.#session = session;
    this.#sessionPath ??= session.getSessionPath?.();
    return session;
  }

  #handleEvent(event: unknown): void {
    if (isUserMessageEndEvent(event)) {
      const sessionPath = this.#sessionPath;
      if (sessionPath)
        queueMicrotask(() => this.#emit({ sessionPath, type: 'session' }));
      return;
    }
    if (isAgentSettledEvent(event)) {
      this.#settleTurn(this.#abortRequested ? 'stopped' : 'worked');
      return;
    }
    if (isAssistantMessageStartEvent(event)) {
      this.#streamedAssistantText = '';
      return;
    }
    if (isToolExecutionStartEvent(event)) {
      this.#emit({ args: event.args, ...this.#sessionMetadata(), status: 'running', toolCallId: event.toolCallId, toolName: event.toolName, type: 'tool' });
      return;
    }
    if (isToolExecutionEndEvent(event)) {
      this.#emit({ ...this.#sessionMetadata(), output: event.result, status: event.isError ? 'failed' : 'completed', toolCallId: event.toolCallId, toolName: event.toolName, type: 'tool' });
      return;
    }
    if (isAssistantTextDeltaEvent(event)) {
      this.#streamedAssistantText += event.assistantMessageEvent.delta;
      this.#emit({ done: false, text: this.#streamedAssistantText, type: 'assistant' });
      return;
    }
    if (!isAssistantMessageEvent(event))
      return;

    const snapshotText = event.message.content
      .filter(isTextContent)
      .map(content => content.text)
      .join('');
    const text = snapshotText || this.#streamedAssistantText;
    this.#streamedAssistantText = text;
    this.#emit({
      done: event.type === 'message_end',
      ...(event.type === 'message_end' ? { entryId: this.#session?.getLastAssistantEntryId?.(), timestamp: messageTimestamp(event.message) ?? Date.now() } : {}),
      text,
      type: 'assistant',
    });
  }

  #emitError(error: unknown): void {
    this.#emit({ type: 'error', text: error instanceof Error ? error.message : '无法发送消息。' });
  }

  #settleTurn(status: WorkStatus): void {
    const startedAtMs = this.#turnStartedAtMs;
    const completedAtMs = Date.now();
    this.#promptActive = false;
    this.#turnStartedAtMs = undefined;
    this.#abortRequested = false;
    if (startedAtMs != null)
      this.#session?.recordWorkDuration?.({ completedAtMs, startedAtMs, status });
    this.#emit({ ...this.#sessionMetadata(), completedAtMs, startedAtMs, status: 'settled', type: 'status', workStatus: status });
  }

  #sessionMetadata(): { sessionPath?: string } {
    return this.#sessionPath ? { sessionPath: this.#sessionPath } : {};
  }

  #emit(update: TranscriptUpdate): void {
    for (const listener of this.#listeners)
      listener(update);
  }
}

async function createDefaultSession(agentDir?: string, workspacePath?: string, sessionPath?: string): Promise<PiSession> {
  const { createAgentSessionFromServices, createAgentSessionServices, SessionManager } = await import('@earendil-works/pi-coding-agent');
  const services = await createAgentSessionServices({
    ...(agentDir ? { agentDir } : {}),
    cwd: workspacePath,
  });
  const model = await selectInitialModel(services);
  if (!model)
    throw new Error('请先在设置中接入模型供应商');
  const { session } = await createAgentSessionFromServices({
    services,
    ...(sessionPath ? { sessionManager: SessionManager.open(sessionPath, undefined, workspacePath) } : {}),
    model,
  });
  return {
    abort: () => session.abort(),
    dispose: () => session.dispose(),
    async editLastUserMessage() {
      const message = session.sessionManager.getBranch().findLast(entry => entry.type === 'message' && entry.message.role === 'user');
      return message ? session.navigateTree(message.id) : { cancelled: true };
    },
    forkAssistantMessage: entryId => session.sessionManager.createBranchedSession(entryId),
    getLastAssistantEntryId: () => session.sessionManager.getBranch().findLast(entry => entry.type === 'message' && entry.message.role === 'assistant')?.id,
    getSessionPath: () => session.sessionManager.getSessionFile(),
    get isStreaming() {
      return session.isStreaming;
    },
    prompt: (text, options) => session.prompt(text, options),
    recordWorkDuration: (duration) => {
      const assistantEntry = session.sessionManager.getBranch().findLast(entry => entry.type === 'message' && entry.message.role === 'assistant');
      session.sessionManager.appendCustomEntry(workedForEntryType, { ...duration, assistantEntryId: assistantEntry?.id });
    },
    subscribe: listener => session.subscribe(event => listener(event)),
  };
}

async function selectInitialModel(services: {
  modelRuntime: {
    getAvailable: () => Promise<Array<{ id: string; provider: string }>>;
    getModel: (provider: string, model: string) => unknown;
  };
  settingsManager: {
    getDefaultModel: () => unknown;
    getDefaultProvider: () => unknown;
  };
}): Promise<unknown> {
  const provider = services.settingsManager.getDefaultProvider();
  const modelId = services.settingsManager.getDefaultModel();
  const available = await services.modelRuntime.getAvailable();
  const configuredModel = typeof provider === 'string' && typeof modelId === 'string'
    ? available.find(model => model.provider === provider && model.id === modelId)
    : undefined;
  const selected = configuredModel ?? available[0];
  return selected ? services.modelRuntime.getModel(selected.provider, selected.id) : undefined;
}

async function listDefaultSessions(workspacePath: string, agentDir?: string): Promise<PiSessionSummary[]> {
  const { getAgentDir, SessionManager } = await import('@earendil-works/pi-coding-agent');
  const sessions = await SessionManager.list(workspacePath, getSessionDirectory(workspacePath, agentDir ?? getAgentDir()));
  return sessions.map(session => ({
    firstMessage: session.firstMessage,
    id: session.id,
    modifiedAt: session.modified.toISOString(),
    path: session.path,
  }));
}

function getSessionDirectory(workspacePath: string, agentDir: string): string {
  const safeWorkspacePath = resolve(workspacePath).replace(/^[\\/]/, '').replace(/[\\/:]/g, '-');
  return join(resolve(agentDir), 'sessions', `--${safeWorkspacePath}--`);
}

function isAssistantMessageEvent(event: unknown): event is { type: 'message_update' | 'message_end'; message: { content: unknown[] } } {
  if (!isRecord(event) || (event.type !== 'message_update' && event.type !== 'message_end') || !isRecord(event.message))
    return false;
  return event.message.role === 'assistant' && Array.isArray(event.message.content);
}

function isUserMessageEndEvent(event: unknown): event is { message: { role: 'user' }; type: 'message_end' } {
  return isRecord(event) && event.type === 'message_end' && isRecord(event.message) && event.message.role === 'user';
}

function isAssistantMessageStartEvent(event: unknown): event is { message: { role: 'assistant' }; type: 'message_start' } {
  return isRecord(event) && event.type === 'message_start' && isRecord(event.message) && event.message.role === 'assistant';
}

function isAgentSettledEvent(event: unknown): event is { type: 'agent_settled' } {
  return isRecord(event) && event.type === 'agent_settled';
}

function isAssistantTextDeltaEvent(event: unknown): event is { assistantMessageEvent: { delta: string; type: 'text_delta' }; type: 'message_update' } {
  return isRecord(event)
    && event.type === 'message_update'
    && isRecord(event.assistantMessageEvent)
    && event.assistantMessageEvent.type === 'text_delta'
    && typeof event.assistantMessageEvent.delta === 'string';
}

function isToolExecutionStartEvent(event: unknown): event is { args: unknown; toolCallId: string; toolName: string; type: 'tool_execution_start' } {
  return isRecord(event) && event.type === 'tool_execution_start' && typeof event.toolCallId === 'string' && typeof event.toolName === 'string';
}

function isToolExecutionEndEvent(event: unknown): event is { isError: boolean; result: unknown; toolCallId: string; toolName: string; type: 'tool_execution_end' } {
  return isRecord(event) && event.type === 'tool_execution_end' && typeof event.toolCallId === 'string' && typeof event.toolName === 'string' && typeof event.isError === 'boolean';
}

function isTextContent(content: unknown): content is { type: 'text'; text: string } {
  return isRecord(content) && content.type === 'text' && typeof content.text === 'string';
}

function toPiSessionMessages(entries: unknown[]): PiSessionSnapshot['messages'] {
  const persistedWork = new Map<string, Extract<PiSessionSnapshot['messages'][number], { role: 'work' }>>();
  const unattachedWork: Extract<PiSessionSnapshot['messages'][number], { role: 'work' }>[] = [];
  const toolResults = new Map<string, { output?: unknown; status: 'completed' | 'failed' }>();
  for (const entry of entries) {
    const toolResult = toPiToolResult(entry);
    if (toolResult != null)
      toolResults.set(toolResult.toolCallId, toolResult);
    const work = toPiWorkDuration(entry);
    if (work == null)
      continue;
    const { assistantEntryId, ...duration } = work;
    if (assistantEntryId)
      persistedWork.set(assistantEntryId, duration);
    else
      unattachedWork.push(duration);
  }

  let latestUserTimestamp: number | undefined;
  return entries.flatMap((entry) => {
    const message = toPiSessionMessage(entry);
    const tools = toPiToolCalls(entry, toolResults);
    if (message == null)
      return tools;
    if (message.role === 'user') {
      latestUserTimestamp = message.timestamp;
      return [message];
    }
    const work = persistedWork.get(message.entryId)
      ?? (latestUserTimestamp != null && latestUserTimestamp > 0 && message.timestamp > 0
        ? { completedAtMs: message.timestamp, role: 'work' as const, startedAtMs: latestUserTimestamp, status: 'worked' as const }
        : undefined);
    return work ? [work, message, ...tools] : [message, ...tools];
  }).concat(unattachedWork);
}

function toPiSessionMessage(entry: unknown): ({ entryId: string; role: 'assistant' | 'user'; text: string; timestamp: number }) | undefined {
  if (!isRecord(entry) || entry.type !== 'message' || !isRecord(entry.message))
    return undefined;
  const { message } = entry;
  if (message.role !== 'assistant' && message.role !== 'user')
    return undefined;
  const text = typeof message.content === 'string'
    ? message.content
    : Array.isArray(message.content) ? message.content.filter(isTextContent).map(content => content.text).join('') : '';
  if (!text)
    return undefined;
  return {
    entryId: typeof entry.id === 'string' ? entry.id : '',
    role: message.role,
    text,
    timestamp: typeof message.timestamp === 'number' ? message.timestamp : 0,
  };
}

function toPiToolCalls(entry: unknown, results: ReadonlyMap<string, { output?: unknown; status: 'completed' | 'failed' }>): Extract<PiSessionSnapshot['messages'][number], { role: 'tool' }>[] {
  if (!isRecord(entry) || entry.type !== 'message' || !isRecord(entry.message) || entry.message.role !== 'assistant' || !Array.isArray(entry.message.content))
    return [];
  return entry.message.content.flatMap((content) => {
    if (!isRecord(content) || content.type !== 'toolCall' || typeof content.id !== 'string' || typeof content.name !== 'string')
      return [];
    const result = results.get(content.id);
    return [{
      ...(Object.hasOwn(content, 'arguments') ? { args: content.arguments } : {}),
      ...(result?.output === undefined ? {} : { output: result.output }),
      role: 'tool' as const,
      status: result?.status ?? 'running',
      toolCallId: content.id,
      toolName: content.name,
    }];
  });
}

function toPiToolResult(entry: unknown): { output?: unknown; status: 'completed' | 'failed'; toolCallId: string } | undefined {
  if (!isRecord(entry) || entry.type !== 'message' || !isRecord(entry.message))
    return undefined;
  const { message } = entry;
  if (message.role !== 'toolResult' || typeof message.toolCallId !== 'string')
    return undefined;
  const output = typeof message.content === 'string'
    ? message.content
    : Array.isArray(message.content) ? message.content.filter(isTextContent).map(content => content.text).join('') : message.details;
  return { ...(output === undefined ? {} : { output }), status: message.isError === true ? 'failed' : 'completed', toolCallId: message.toolCallId };
}

function toPiWorkDuration(entry: unknown): (Extract<PiSessionSnapshot['messages'][number], { role: 'work' }> & { assistantEntryId?: string }) | undefined {
  if (!isRecord(entry) || entry.type !== 'custom' || entry.customType !== workedForEntryType || !isRecord(entry.data))
    return undefined;
  const { assistantEntryId, completedAtMs, startedAtMs, status } = entry.data;
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs) || (status !== 'stopped' && status !== 'worked'))
    return undefined;
  return {
    ...(typeof assistantEntryId === 'string' ? { assistantEntryId } : {}),
    completedAtMs,
    role: 'work',
    startedAtMs,
    status,
  };
}

function messageTimestamp(message: unknown): number | undefined {
  return isRecord(message) && typeof message.timestamp === 'number' ? message.timestamp : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
