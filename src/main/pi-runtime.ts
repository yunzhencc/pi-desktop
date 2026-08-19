import type { AttachmentStore } from './attachments';
import type { DeepSeekConfiguration } from './deepseek-settings';
import process from 'node:process';

export type TranscriptUpdate
  = | { done?: boolean; text: string; type: 'assistant' }
    | { text: string; type: 'error' }
    | { status: 'running' | 'settled'; type: 'status' };

interface PiSession {
  abort?: () => Promise<void>;
  isStreaming?: boolean;
  prompt: (text: string, options?: { images?: Array<{ type: 'image'; data: string; mimeType: string }>; streamingBehavior?: 'steer' }) => Promise<void>;
  subscribe: (listener: (event: unknown) => void) => () => void;
  dispose?: () => void;
}

type SessionFactory = (configuration: DeepSeekConfiguration, agentDir?: string) => Promise<PiSession>;

interface PiRuntimeOptions {
  agentDir?: string;
  createSession?: SessionFactory;
}

export class PiRuntime {
  #session: PiSession | undefined;
  #sessionUnsubscribe: (() => void) | undefined;
  #listeners = new Set<(update: TranscriptUpdate) => void>();
  #configuration: DeepSeekConfiguration | undefined;
  #promptActive = false;
  #streamedAssistantText = '';
  private readonly agentDir: string | undefined;
  private readonly createSession: SessionFactory;

  constructor(
    private readonly attachments: AttachmentStore,
    optionsOrCreateSession: PiRuntimeOptions | SessionFactory = createDefaultSession,
  ) {
    if (typeof optionsOrCreateSession === 'function') {
      this.createSession = optionsOrCreateSession;
    }
    else {
      this.agentDir = optionsOrCreateSession.agentDir;
      this.createSession = optionsOrCreateSession.createSession ?? createDefaultSession;
    }
  }

  subscribe(listener: (update: TranscriptUpdate) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  configureDeepSeek(configuration: DeepSeekConfiguration | undefined): void {
    this.#configuration = configuration;
    this.#sessionUnsubscribe?.();
    this.#session?.dispose?.();
    this.#session = undefined;
    this.#sessionUnsubscribe = undefined;
    this.#promptActive = false;
  }

  async send(prompt: string, attachmentIds: string[]): Promise<void> {
    try {
      const attachments = await this.attachments.toPrompt(attachmentIds);
      const session = await this.#getSession();
      const options = {
        ...(attachments.images.length ? { images: attachments.images } : {}),
        ...(this.#promptActive || session.isStreaming ? { streamingBehavior: 'steer' as const } : {}),
      };
      this.#promptActive = true;
      this.#emit({ status: 'running', type: 'status' });
      void Promise.resolve(session.prompt(`${prompt}${attachments.text ? `\n${attachments.text}` : ''}`, Object.keys(options).length ? options : undefined)).catch((error) => {
        if (!session.isStreaming) {
          this.#promptActive = false;
          this.#emit({ status: 'settled', type: 'status' });
        }
        this.#emitError(error);
      });
    }
    catch (error) {
      this.#emitError(error);
      throw error;
    }
  }

  dispose(): void {
    this.#sessionUnsubscribe?.();
    this.#session?.dispose?.();
    this.#listeners.clear();
    this.#session = undefined;
    this.#sessionUnsubscribe = undefined;
    this.#promptActive = false;
  }

  async abort(): Promise<void> {
    const session = this.#session;
    if (session == null || (!this.#promptActive && !session.isStreaming))
      return;

    if (session.abort == null) {
      this.#promptActive = false;
      this.#emit({ status: 'settled', type: 'status' });
      return;
    }

    try {
      await session.abort();
    }
    catch (error) {
      this.#promptActive = false;
      this.#emit({ status: 'settled', type: 'status' });
      this.#emitError(error);
      throw error;
    }
  }

  async #getSession(): Promise<PiSession> {
    if (this.#session)
      return this.#session;
    if (!this.#configuration)
      throw new Error('请先在设置中配置 DeepSeek API Key');

    const session = await this.createSession(this.#configuration, this.agentDir);
    this.#sessionUnsubscribe = session.subscribe(event => this.#handleEvent(event));
    this.#session = session;
    return session;
  }

  #handleEvent(event: unknown): void {
    if (isAgentSettledEvent(event)) {
      this.#promptActive = false;
      this.#emit({ status: 'settled', type: 'status' });
      return;
    }
    if (isAssistantMessageStartEvent(event)) {
      this.#streamedAssistantText = '';
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
    this.#emit({ done: event.type === 'message_end', text, type: 'assistant' });
  }

  #emitError(error: unknown): void {
    this.#emit({ type: 'error', text: error instanceof Error ? error.message : '无法发送消息。' });
  }

  #emit(update: TranscriptUpdate): void {
    for (const listener of this.#listeners)
      listener(update);
  }
}

async function createDefaultSession(configuration: DeepSeekConfiguration, agentDir?: string): Promise<PiSession> {
  const { createAgentSession, ModelRuntime } = await import('@earendil-works/pi-coding-agent');
  const modelRuntime = await ModelRuntime.create({ modelsPath: null, refreshOnCreate: false });
  modelRuntime.registerProvider('deepseek', {
    api: 'openai-completions',
    baseUrl: 'https://api.deepseek.com',
    models: [
      { contextWindow: 128000, id: 'deepseek-v4-flash', input: ['text'], maxTokens: 16384, name: 'DeepSeek V4 Flash', reasoning: true },
      { contextWindow: 128000, id: 'deepseek-v4-pro', input: ['text'], maxTokens: 16384, name: 'DeepSeek V4 Pro', reasoning: true },
    ],
    name: 'DeepSeek',
  });
  await modelRuntime.setRuntimeApiKey('deepseek', configuration.apiKey);
  const model = modelRuntime.getModel('deepseek', configuration.model);
  if (!model)
    throw new Error('无法找到所选的 DeepSeek 模型');
  const { session } = await createAgentSession({ agentDir, cwd: process.cwd(), model, modelRuntime });
  return {
    abort: () => session.abort(),
    dispose: () => session.dispose(),
    get isStreaming() {
      return session.isStreaming;
    },
    prompt: (text, options) => session.prompt(text, options),
    subscribe: listener => session.subscribe(event => listener(event)),
  };
}

function isAssistantMessageEvent(event: unknown): event is { type: 'message_update' | 'message_end'; message: { content: unknown[] } } {
  if (!isRecord(event) || (event.type !== 'message_update' && event.type !== 'message_end') || !isRecord(event.message))
    return false;
  return event.message.role === 'assistant' && Array.isArray(event.message.content);
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

function isTextContent(content: unknown): content is { type: 'text'; text: string } {
  return isRecord(content) && content.type === 'text' && typeof content.text === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
