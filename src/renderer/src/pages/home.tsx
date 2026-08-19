import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import piLogo from '../../../../resources/icon.svg?asset';
import { ChatComposer, NewConversationToolbar } from '../components/chat-composer';
import { MarkdownMessage } from '../components/markdown-message';
import { ThreadScrollLayout } from '../components/thread-scroll-layout';

interface Message {
  completedAtMs?: number;
  id: number;
  role: 'assistant' | 'error' | 'user';
  startedAtMs?: number;
  text: string;
  done?: boolean;
}

type WorkspaceSnapshot = Awaited<ReturnType<Window['api']['workspaces']['get']>>;
type PiSessionSnapshot = Awaited<ReturnType<Window['api']['sessions']['open']>>['session'];

export function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>();
  const workspaceRef = useRef<WorkspaceSnapshot>();
  const composerFooterRef = useRef<HTMLDivElement>(null);
  const pendingAssistantRef = useRef<{ done: boolean; text: string } | null>(null);
  const streamingFrameRef = useRef<number | null>(null);
  const [composerFooterHeightPx, setComposerFooterHeightPx] = useState(0);

  useEffect(() => {
    let active = true;
    void window.api.workspaces.get().then((snapshot) => {
      if (active) {
        workspaceRef.current = snapshot;
        setWorkspace(snapshot);
      }
    }).catch(() => {
      if (active) {
        workspaceRef.current = { workspaces: [] };
        setWorkspace({ workspaces: [] });
      }
    });
    const onWorkspaceChanged = (event: Event) => {
      const next = (event as CustomEvent<WorkspaceSnapshot>).detail;
      if (next.selectedWorkspacePath !== workspaceRef.current?.selectedWorkspacePath)
        setMessages([]);
      workspaceRef.current = next;
      setWorkspace(next);
    };
    window.addEventListener('workspace-changed', onWorkspaceChanged);
    return () => {
      active = false;
      window.removeEventListener('workspace-changed', onWorkspaceChanged);
    };
  }, []);

  useEffect(() => {
    const startNewConversation = () => {
      setMessages([]);
      void window.api.composer.newConversation();
    };
    const openSession = (event: Event) => {
      if (streamingFrameRef.current != null)
        cancelAnimationFrame(streamingFrameRef.current);
      streamingFrameRef.current = null;
      pendingAssistantRef.current = null;
      setIsRunning(false);
      const session = (event as CustomEvent<PiSessionSnapshot>).detail;
      setMessages(session.messages.map((message, index) => ({ done: true, id: index, role: message.role, text: message.text })));
    };
    window.addEventListener('new-conversation', startNewConversation);
    window.addEventListener('session-changed', openSession);
    return () => {
      window.removeEventListener('new-conversation', startNewConversation);
      window.removeEventListener('session-changed', openSession);
    };
  }, []);

  useLayoutEffect(() => {
    const footer = composerFooterRef.current;
    if (footer == null)
      return;

    const updateHeight = () => setComposerFooterHeightPx(footer.offsetHeight);
    const frame = requestAnimationFrame(updateHeight);
    if (typeof ResizeObserver === 'undefined')
      return () => cancelAnimationFrame(frame);

    const observer = new ResizeObserver(updateHeight);
    observer.observe(footer);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [messages.length]);

  useEffect(() => {
    const appendAssistant = (text: string, done: boolean) => {
      setMessages((current) => {
        const last = current.at(-1);
        const now = Date.now();
        const startedAtMs = last?.role === 'assistant'
          ? last.startedAtMs
          : current.findLast(message => message.role === 'user')?.startedAtMs ?? now;
        const message = { completedAtMs: done ? now : undefined, done, id: last?.role === 'assistant' ? last.id : now, role: 'assistant' as const, startedAtMs, text };
        return last?.role === 'assistant' && !last.done ? [...current.slice(0, -1), message] : [...current, message];
      });
    };
    const flushAssistant = () => {
      streamingFrameRef.current = null;
      const pending = pendingAssistantRef.current;
      pendingAssistantRef.current = null;
      if (pending != null)
        appendAssistant(pending.text, pending.done);
    };
    const discardPendingAssistant = () => {
      if (streamingFrameRef.current != null)
        cancelAnimationFrame(streamingFrameRef.current);
      streamingFrameRef.current = null;
      pendingAssistantRef.current = null;
    };
    const unsubscribe = window.api.composer.onUpdate((update) => {
      if (update.type === 'status') {
        setIsRunning(update.status === 'running');
        return;
      }
      if (update.type === 'error') {
        flushAssistant();
        setMessages(current => [...current, { id: Date.now(), role: 'error', text: update.text }]);
        return;
      }
      if (update.done) {
        discardPendingAssistant();
        appendAssistant(update.text, true);
        return;
      }

      pendingAssistantRef.current = { done: false, text: update.text };
      streamingFrameRef.current ??= requestAnimationFrame(flushAssistant);
    });
    return () => {
      discardPendingAssistant();
      unsubscribe();
    };
  }, []);

  const composer = (
    <ChatComposer
      isRunning={isRunning}
      onSent={() => window.dispatchEvent(new Event('sessions-changed'))}
      onStop={() => void window.api.composer.stop()}
      onSubmitted={(text) => {
        const startedAtMs = Date.now();
        setMessages(current => [...current, { id: startedAtMs, role: 'user', startedAtMs, text }]);
      }}
      workspace={workspace}
    />
  );

  const newConversationToolbar = (
    <NewConversationToolbar
      onClearProject={() => {
        void window.api.workspaces.clear().then(next => window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: next })));
      }}
      onCreateProject={() => window.dispatchEvent(new Event('create-project'))}
      onSelectProject={(path) => {
        void window.api.workspaces.select(path).then(next => window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: next })));
      }}
      workspace={workspace}
    />
  );
  const selectedWorkspace = workspace?.workspaces.find(item => item.path === workspace.selectedWorkspacePath);

  return (
    <section className="chat-page" style={{ '--thread-scroll-padding-bottom': `${composerFooterHeightPx + 16}px` } as CSSProperties}>
      {messages.length === 0
        ? (
            <div className="chat-empty-state">
              <img alt="PI" className="chat-empty-state-logo" src={piLogo} />
              <h1>{selectedWorkspace ? `你想让我们在 ${selectedWorkspace.displayName} 中构建什么？` : '我们要构建什么？'}</h1>
            </div>
          )
        : (
            <ThreadScrollLayout
              footer={<div className="chat-composer-wrap" ref={composerFooterRef}>{composer}</div>}
              turns={messages.map(message => ({ key: String(message.id), message }))}
            >
              {({ message }) => (
                <article className={`chat-message chat-message-${message.role}`}>
                  {message.role === 'assistant'
                    ? (
                        <>
                          <WorkedFor completedAtMs={message.completedAtMs} startedAtMs={message.startedAtMs} />
                          <MarkdownMessage>{message.text}</MarkdownMessage>
                        </>
                      )
                    : message.text}
                </article>
              )}
            </ThreadScrollLayout>
          )}
      {messages.length === 0 && (
        <div className="chat-composer-footer" ref={composerFooterRef}>
          <div className="chat-composer-wrap">
            {newConversationToolbar}
            {composer}
          </div>
        </div>
      )}
    </section>
  );
}

function WorkedFor({ completedAtMs, startedAtMs }: Pick<Message, 'completedAtMs' | 'startedAtMs'>) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAtMs == null || completedAtMs != null)
      return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [completedAtMs, startedAtMs]);

  if (startedAtMs == null)
    return null;
  const elapsedMs = Math.max(0, (completedAtMs ?? now) - startedAtMs);
  const label = completedAtMs != null ? 'Worked for' : elapsedMs >= 1000 ? 'Working for' : 'Working';
  return <p className="chat-worked-for">{label === 'Working' ? label : `${label} ${formatDuration(elapsedMs)}`}</p>;
}

function formatDuration(durationMs: number) {
  const seconds = Math.floor(durationMs / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
