import type { CSSProperties } from 'react';
import { Copy, Pencil } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import piLogo from '../../../../resources/icon.svg?asset';
import { ChatComposer, NewConversationToolbar } from '../components/chat-composer';
import { MarkdownMessage } from '../components/markdown-message';
import { ProjectPicker } from '../components/project-picker';
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
  const [editingMessage, setEditingMessage] = useState<{ id: number; text: string }>();
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
      let latestUserStartedAtMs: number | undefined;
      setMessages(session.messages.map((message, index) => {
        const timestamp = message.timestamp || undefined;
        if (message.role === 'user') {
          latestUserStartedAtMs = timestamp;
          return { done: true, id: index, role: message.role, startedAtMs: timestamp, text: message.text };
        }
        return { completedAtMs: timestamp, done: true, id: index, role: message.role, startedAtMs: latestUserStartedAtMs, text: message.text };
      }));
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
        if (update.status === 'settled') {
          flushAssistant();
          setMessages((current) => {
            const last = current.at(-1);
            return last?.role === 'assistant' && !last.done
              ? [...current.slice(0, -1), { ...last, completedAtMs: Date.now(), done: true }]
              : current;
          });
        }
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

  const submitEditedLastUserMessage = async (text: string) => {
    const message = editingMessage;
    if (message == null || !text.trim())
      return;
    const sourceText = await window.api.composer.editLastUserMessage(text);
    if (sourceText == null)
      return;
    setMessages((current) => {
      const index = current.findIndex(currentMessage => currentMessage.id === message.id);
      return index < 0 ? current : [...current.slice(0, index), { ...current[index]!, text }];
    });
    setEditingMessage(undefined);
    window.dispatchEvent(new Event('sessions-changed'));
  };

  const createProject = () => window.dispatchEvent(new Event('create-project'));
  const selectProject = (path: string) => {
    void window.api.workspaces.select(path).then(next => window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: next })));
  };
  const clearProject = () => {
    void window.api.workspaces.clear().then(next => window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: next })));
  };
  const newConversationToolbar = (
    <NewConversationToolbar
      onClearProject={clearProject}
      onCreateProject={createProject}
      onSelectProject={selectProject}
      workspace={workspace}
    />
  );
  const selectedWorkspace = workspace?.workspaces.find(item => item.path === workspace.selectedWorkspacePath);
  const lastUserMessageId = messages.findLast(message => message.role === 'user')?.id;

  return (
    <section className="chat-page" style={{ '--thread-scroll-padding-bottom': `${composerFooterHeightPx + 16}px` } as CSSProperties}>
      {messages.length === 0
        ? (
            <div className="chat-empty-state">
              <img alt="PI" className="chat-empty-state-logo" src={piLogo} />
              <h1>
                {selectedWorkspace
                  ? (
                      <>
                        {'你想让我们在 '}
                        <ProjectPicker onCreateProject={createProject} onSelectProject={selectProject} triggerClassName="chat-empty-state-project-trigger" workspace={workspace}>
                          {selectedWorkspace.displayName}
                        </ProjectPicker>
                        {' 中构建什么？'}
                      </>
                    )
                  : '我们要构建什么？'}
              </h1>
            </div>
          )
        : (
            <ThreadScrollLayout
              footer={<div className="chat-composer-wrap" ref={composerFooterRef}>{composer}</div>}
              turns={messages.map(message => ({ key: String(message.id), message }))}
            >
              {({ message }) => (
                <div className="chat-turn">
                  {message.role === 'assistant' && <WorkedFor completedAtMs={message.completedAtMs} done={message.done} startedAtMs={message.startedAtMs} />}
                  <article className={`chat-message chat-message-${message.role}${editingMessage?.id === message.id ? ' is-editing' : ''}`}>
                    {message.role === 'assistant'
                      ? <MarkdownMessage>{message.text}</MarkdownMessage>
                      : message.role === 'user'
                        ? (
                            editingMessage?.id === message.id
                              ? <ChatComposer inlineEdit={{ initialText: editingMessage.text, onCancel: () => setEditingMessage(undefined), onSubmit: submitEditedLastUserMessage }} onSubmitted={() => {}} />
                              : (
                                  <>
                                    <div className="chat-message-user-content" onDoubleClick={!isRunning && message.id === lastUserMessageId ? () => setEditingMessage({ id: message.id, text: message.text }) : undefined}>{message.text}</div>
                                    <UserMessageFooter canEdit={!isRunning && message.id === lastUserMessageId} onEdit={() => setEditingMessage({ id: message.id, text: message.text })} startedAtMs={message.startedAtMs} text={message.text} />
                                  </>
                                )
                          )
                        : message.text}
                  </article>
                </div>
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

function UserMessageFooter({ canEdit, onEdit, startedAtMs, text }: Pick<Message, 'startedAtMs' | 'text'> & { canEdit: boolean; onEdit: () => void }) {
  const timestamp = startedAtMs == null ? null : new Intl.DateTimeFormat(undefined, { hour: '2-digit', hourCycle: 'h23', minute: '2-digit' }).format(startedAtMs);

  return (
    <footer className="chat-message-user-footer">
      {timestamp != null && <time dateTime={new Date(startedAtMs!).toISOString()}>{timestamp}</time>}
      {canEdit && <button aria-label="Edit message" className="chat-message-user-copy" onClick={onEdit} title="Edit message" type="button"><Pencil aria-hidden="true" size={14} /></button>}
      <button aria-label="Copy message" className="chat-message-user-copy" onClick={() => void navigator.clipboard?.writeText(text)} title="Copy message" type="button">
        <Copy aria-hidden="true" size={14} />
      </button>
    </footer>
  );
}

function WorkedFor({ completedAtMs, done, startedAtMs }: Pick<Message, 'completedAtMs' | 'done' | 'startedAtMs'>) {
  const { formatMessage } = useIntl();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (done || startedAtMs == null || completedAtMs != null)
      return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [completedAtMs, done, startedAtMs]);

  if ((done && completedAtMs == null) || startedAtMs == null)
    return null;
  const elapsedMs = Math.max(0, (completedAtMs ?? now) - startedAtMs);
  const seconds = Math.floor(elapsedMs / 1000);
  const duration = seconds < 60
    ? formatMessage({ id: 'conversation.duration.seconds' }, { seconds })
    : formatMessage(
        { id: 'conversation.duration.minutes' },
        { minutes: Math.floor(seconds / 60), seconds: seconds % 60 },
      );
  const label = completedAtMs != null
    ? formatMessage({ id: 'conversation.workedFor' }, { duration })
    : elapsedMs >= 1000
      ? formatMessage({ id: 'conversation.workingFor' }, { duration })
      : formatMessage({ id: 'conversation.working' });
  return (
    <div className="chat-worked-for" data-duration-divider>
      <p>{label}</p>
      <div aria-hidden="true" className="chat-worked-for-rule" />
    </div>
  );
}
