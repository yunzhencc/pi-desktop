import type { AttachmentStore } from './attachments';
import process from 'node:process';

export interface TranscriptUpdate {
  type: 'assistant' | 'error';
  text: string;
  done?: boolean;
}

interface PiSession {
  prompt: (text: string, options?: { images?: Array<{ type: 'image'; data: string; mimeType: string }> }) => Promise<void>;
  subscribe: (listener: (event: unknown) => void) => () => void;
  dispose?: () => void;
}

type SessionFactory = () => Promise<PiSession>;

export class PiRuntime {
  #session: PiSession | undefined;
  #sessionUnsubscribe: (() => void) | undefined;
  #listeners = new Set<(update: TranscriptUpdate) => void>();

  constructor(
    private readonly attachments: AttachmentStore,
    private readonly createSession: SessionFactory = createDefaultSession,
  ) {}

  subscribe(listener: (update: TranscriptUpdate) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async send(prompt: string, attachmentIds: string[]): Promise<void> {
    try {
      const attachments = await this.attachments.toPrompt(attachmentIds);
      const session = await this.#getSession();
      await session.prompt(`${prompt}${attachments.text ? `\n${attachments.text}` : ''}`, attachments.images.length ? { images: attachments.images } : undefined);
    }
    catch (error) {
      const text = error instanceof Error ? error.message : '无法发送消息。';
      this.#emit({ type: 'error', text });
      throw error;
    }
  }

  dispose(): void {
    this.#sessionUnsubscribe?.();
    this.#session?.dispose?.();
    this.#listeners.clear();
    this.#session = undefined;
    this.#sessionUnsubscribe = undefined;
  }

  async #getSession(): Promise<PiSession> {
    if (this.#session)
      return this.#session;

    const session = await this.createSession();
    this.#sessionUnsubscribe = session.subscribe(event => this.#handleEvent(event));
    this.#session = session;
    return session;
  }

  #handleEvent(event: unknown): void {
    if (!isAssistantMessageEvent(event))
      return;

    const text = event.message.content
      .filter(isTextContent)
      .map(content => content.text)
      .join('');
    this.#emit({ done: event.type === 'message_end', text, type: 'assistant' });
  }

  #emit(update: TranscriptUpdate): void {
    for (const listener of this.#listeners)
      listener(update);
  }
}

async function createDefaultSession(): Promise<PiSession> {
  const { createAgentSession } = await import('@earendil-works/pi-coding-agent');
  const { session } = await createAgentSession({ cwd: process.cwd() });
  return {
    dispose: () => session.dispose(),
    prompt: (text, options) => session.prompt(text, options),
    subscribe: listener => session.subscribe(event => listener(event)),
  };
}

function isAssistantMessageEvent(event: unknown): event is { type: 'message_update' | 'message_end'; message: { content: unknown[] } } {
  if (!isRecord(event) || (event.type !== 'message_update' && event.type !== 'message_end') || !isRecord(event.message))
    return false;
  return event.message.role === 'assistant' && Array.isArray(event.message.content);
}

function isTextContent(content: unknown): content is { type: 'text'; text: string } {
  return isRecord(content) && content.type === 'text' && typeof content.text === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
