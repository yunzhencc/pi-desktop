import type { PiSessionSnapshot, PiSessionSummary, PiUsageStats, PiWorkStatus, TranscriptUpdate } from '@shared/types';
import type { AttachmentStore } from './attachments';
import { join, resolve } from 'node:path';

const workedForEntryType = 'pi-desktop-worked-for';
const turnBookmarkEntryType = 'pi-desktop-turn-bookmark';

type WorkStatus = PiWorkStatus;

interface PiSession {
  abort?: () => Promise<void>;
  editLastUserMessage?: () => Promise<{ cancelled: boolean; editorText?: string }>;
  forkAssistantMessage?: (entryId: string) => string | undefined;
  getLastAssistantEntryId?: () => string | undefined;
  getLastUserEntryId?: () => string | undefined;
  getSessionPath?: () => string | undefined;
  isStreaming?: boolean;
  prompt: (text: string, options?: { images?: Array<{ type: 'image'; data: string; mimeType: string }>; streamingBehavior?: 'steer' }) => Promise<void>;
  recordWorkDuration?: (duration: { completedAtMs: number; startedAtMs: number; status: WorkStatus }) => void;
  setUserMessageBookmarked?: (userEntryId: string, bookmarked: boolean) => string[];
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

  hasActiveSession(): boolean {
    return this.#promptActive || this.#session?.isStreaming === true;
  }

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

  async getWorkspaceUsageStats(path: string): Promise<PiUsageStats> {
    if (!path.trim())
      throw new TypeError('工作区路径不能为空');
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const sessions = await this.listSessions(path, this.agentDir);
    return buildUsageStats(sessions.map(session => SessionManager.open(session.path).getEntries()));
  }

  async openSession(path: string): Promise<PiSessionSnapshot> {
    if (!path.trim())
      throw new TypeError('会话路径不能为空');
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const session = SessionManager.open(path);
    this.#sessionPath = path;
    this.#resetSession();
    return {
      bookmarkedUserEntryIds: toPiBookmarkedUserEntryIds(session.getBranch()),
      messages: toPiSessionMessages(session.getBranch()),
      path,
    };
  }

  async setUserMessageBookmarked(userEntryId: string, bookmarked: boolean): Promise<string[]> {
    if (!userEntryId)
      throw new TypeError('用户消息不能为空');
    if (!this.#sessionPath)
      throw new Error('当前没有可保存书签的会话');
    if (this.#session?.setUserMessageBookmarked)
      return this.#session.setUserMessageBookmarked(userEntryId, bookmarked);
    const { SessionManager } = await import('@earendil-works/pi-coding-agent');
    const session = SessionManager.open(this.#sessionPath);
    const entries = session.getBranch();
    if (!entries.some(entry => isUserMessageEntry(entry, userEntryId)))
      throw new Error('找不到用户消息');
    session.appendCustomEntry(turnBookmarkEntryType, { bookmarked, userEntryId });
    return toPiBookmarkedUserEntryIds(session.getBranch());
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
      const entryId = this.#session?.getLastUserEntryId?.();
      if (entryId)
        this.#emit({ entryId, type: 'user' });
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
    getLastUserEntryId: () => session.sessionManager.getBranch().findLast(entry => entry.type === 'message' && entry.message.role === 'user')?.id,
    getSessionPath: () => session.sessionManager.getSessionFile(),
    get isStreaming() {
      return session.isStreaming;
    },
    prompt: (text, options) => session.prompt(text, options),
    recordWorkDuration: (duration) => {
      const assistantEntry = session.sessionManager.getBranch().findLast(entry => entry.type === 'message' && entry.message.role === 'assistant');
      session.sessionManager.appendCustomEntry(workedForEntryType, { ...duration, assistantEntryId: assistantEntry?.id });
    },
    setUserMessageBookmarked: (userEntryId, bookmarked) => {
      const entries = session.sessionManager.getBranch();
      if (!entries.some(entry => isUserMessageEntry(entry, userEntryId)))
        throw new Error('找不到用户消息');
      session.sessionManager.appendCustomEntry(turnBookmarkEntryType, { bookmarked, userEntryId });
      return toPiBookmarkedUserEntryIds(session.sessionManager.getBranch());
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

function toPiBookmarkedUserEntryIds(entries: unknown[]): string[] {
  const userEntryIds = new Set(entries.flatMap(entry => isRecord(entry) && entry.type === 'message' && isRecord(entry.message) && entry.message.role === 'user' && typeof entry.id === 'string' ? [entry.id] : []));
  const bookmarked = new Map<string, boolean>();
  for (const entry of entries) {
    if (!isRecord(entry) || entry.type !== 'custom' || entry.customType !== turnBookmarkEntryType || !isRecord(entry.data))
      continue;
    const { bookmarked: isBookmarked, userEntryId } = entry.data;
    if (typeof userEntryId === 'string' && typeof isBookmarked === 'boolean' && userEntryIds.has(userEntryId))
      bookmarked.set(userEntryId, isBookmarked);
  }
  return [...bookmarked].flatMap(([userEntryId, isBookmarked]) => isBookmarked ? [userEntryId] : []);
}

function isUserMessageEntry(entry: unknown, entryId: string): boolean {
  return isRecord(entry)
    && entry.id === entryId
    && entry.type === 'message'
    && isRecord(entry.message)
    && entry.message.role === 'user';
}

function buildUsageStats(sessionEntries: unknown[][]): PiUsageStats {
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(today.getDate() - 370);
  const tokensByDay = new Map<string, number>();
  let lifetimeTokens = 0;
  let longestChatMs: number | undefined;

  for (const entries of sessionEntries) {
    let latestUserTimestamp: number | undefined;
    for (const entry of entries) {
      const usage = entryUsage(entry);
      if (usage != null) {
        const timestamp = entryTimestamp(entry);
        const iso = timestamp == null ? undefined : toIsoDate(new Date(timestamp));
        lifetimeTokens += usage;
        if (iso != null)
          tokensByDay.set(iso, (tokensByDay.get(iso) ?? 0) + usage);
      }

      const work = toPiWorkDuration(entry);
      if (work != null)
        longestChatMs = Math.max(longestChatMs ?? 0, work.completedAtMs - work.startedAtMs);

      const message = entryMessage(entry);
      if (!message)
        continue;
      if (message.role === 'user') {
        latestUserTimestamp = messageTimestamp(message);
        continue;
      }
      if (message.role === 'assistant' && latestUserTimestamp != null) {
        const assistantTimestamp = messageTimestamp(message);
        if (assistantTimestamp != null)
          longestChatMs = Math.max(longestChatMs ?? 0, assistantTimestamp - latestUserTimestamp);
      }
    }
  }

  const days = Array.from({ length: 371 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = toIsoDate(date);
    return { iso, tokens: tokensByDay.get(iso) ?? 0 };
  });
  const activeDays = new Set(days.filter(day => day.tokens > 0).map(day => day.iso));
  return {
    currentStreakDays: countCurrentStreak(today, activeDays),
    days,
    lifetimeTokens,
    ...(longestChatMs == null ? {} : { longestChatMs }),
    longestStreakDays: countLongestStreak(days),
    peakTokens: Math.max(0, ...days.map(day => day.tokens)),
  };
}

function entryUsage(entry: unknown): number | undefined {
  if (!isRecord(entry))
    return undefined;
  if ((entry.type === 'branch_summary' || entry.type === 'compaction') && isUsage(entry.usage))
    return usageTokens(entry.usage);
  const message = entryMessage(entry);
  if (!message || !isUsage(message.usage))
    return undefined;
  return usageTokens(message.usage);
}

function usageTokens(usage: { input: number; output: number }): number {
  return usage.input + usage.output;
}

function isUsage(value: unknown): value is { cacheRead: number; cacheWrite: number; input: number; output: number } {
  return isRecord(value)
    && Number.isFinite(value.input)
    && Number.isFinite(value.output)
    && Number.isFinite(value.cacheRead)
    && Number.isFinite(value.cacheWrite);
}

function entryMessage(entry: unknown): Record<string, unknown> | undefined {
  return isRecord(entry) && entry.type === 'message' && isRecord(entry.message) ? entry.message : undefined;
}

function entryTimestamp(entry: unknown): number | undefined {
  if (isRecord(entry) && typeof entry.timestamp === 'string') {
    const date = new Date(entry.timestamp);
    if (!Number.isNaN(date.getTime()))
      return date.getTime();
  }
  const message = entryMessage(entry);
  return message ? messageTimestamp(message) : undefined;
}

function countCurrentStreak(today: Date, activeDays: ReadonlySet<string>): number {
  let count = 0;
  const date = new Date(today);
  while (activeDays.has(toIsoDate(date))) {
    count++;
    date.setDate(date.getDate() - 1);
  }
  return count;
}

function countLongestStreak(days: Array<{ tokens: number }>): number {
  let current = 0;
  let longest = 0;
  for (const day of days) {
    current = day.tokens > 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function messageTimestamp(message: unknown): number | undefined {
  return isRecord(message) && typeof message.timestamp === 'number' ? message.timestamp : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
