import type { CSSProperties } from 'react';
import logo from '@renderer/assets/icon.svg';
import { ChatComposer, NewConversationToolbar } from '@renderer/components/chat-composer';
import { MarkdownMessage } from '@renderer/components/markdown-message';
import { ProjectPicker } from '@renderer/components/project-picker';
import { ThreadScrollLayout } from '@renderer/components/thread-scroll-layout';
import { Copy, GitFork, LoaderCircle, Pencil } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

interface Message {
  completedAtMs?: number;
  entryId?: string;
  id: number;
  role: 'activity' | 'assistant' | 'error' | 'user' | 'work';
  startedAtMs?: number;
  text: string;
  timestamp?: number;
  toolArgs?: unknown;
  done?: boolean;
  toolCallId?: string;
  toolName?: string;
  toolOutput?: unknown;
  toolStatus?: 'completed' | 'failed' | 'running';
  workStatus?: 'stopped' | 'worked';
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
  const pendingAssistantRef = useRef<{ done: boolean; entryId?: string; text: string; timestamp?: number } | null>(null);
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
        workspaceRef.current = { pinnedSessionPaths: [], workspaces: [] };
        setWorkspace({ pinnedSessionPaths: [], workspaces: [] });
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
      const restored: Message[] = [];
      session.messages.forEach((message, index) => {
        if (message.role === 'work') {
          restored.push({ completedAtMs: message.completedAtMs, done: true, id: index, role: 'work', startedAtMs: message.startedAtMs, text: '', workStatus: message.status });
          return;
        }
        if (message.role === 'tool') {
          restored.push({ done: true, id: index, role: 'activity', text: message.toolName, toolArgs: message.args, toolCallId: message.toolCallId, toolName: message.toolName, toolOutput: message.output, toolStatus: message.status });
          return;
        }
        const timestamp = message.timestamp || undefined;
        if (message.role === 'user') {
          latestUserStartedAtMs = timestamp;
          restored.push({ done: true, entryId: message.entryId, id: index, role: message.role, startedAtMs: timestamp, text: message.text, timestamp });
          return;
        }
        if (restored.at(-1)?.role !== 'work' && latestUserStartedAtMs != null && timestamp != null)
          restored.push({ completedAtMs: timestamp, done: true, id: -index - 1, role: 'work', startedAtMs: latestUserStartedAtMs, text: '', workStatus: 'worked' });
        restored.push({ done: true, entryId: message.entryId, id: index, role: message.role, text: message.text, timestamp });
      });
      setMessages(restored);
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
    const appendAssistant = ({ done, entryId, text, timestamp }: NonNullable<typeof pendingAssistantRef.current>) => {
      setMessages((current) => {
        const latestUserStartedAtMs = current.findLast(message => message.role === 'user')?.startedAtMs;
        const withWork = current.some(message => message.role === 'work' && !message.done) || latestUserStartedAtMs == null
          ? current
          : [...current, { completedAtMs: done ? timestamp ?? Date.now() : undefined, done, id: -Date.now(), role: 'work' as const, startedAtMs: latestUserStartedAtMs, text: '', workStatus: done ? 'worked' as const : undefined }];
        const last = withWork.at(-1);
        const now = Date.now();
        const message = { done, entryId, id: last?.role === 'assistant' ? last.id : now, role: 'assistant' as const, text, timestamp };
        return last?.role === 'assistant' && !last.done ? [...withWork.slice(0, -1), message] : [...withWork, message];
      });
    };
    const flushAssistant = () => {
      streamingFrameRef.current = null;
      const pending = pendingAssistantRef.current;
      pendingAssistantRef.current = null;
      if (pending != null)
        appendAssistant(pending);
    };
    const discardPendingAssistant = () => {
      if (streamingFrameRef.current != null)
        cancelAnimationFrame(streamingFrameRef.current);
      streamingFrameRef.current = null;
      pendingAssistantRef.current = null;
    };
    const unsubscribe = window.api.composer.onUpdate((update) => {
      if (update.type === 'status') {
        if (update.status === 'running') {
          const startedAtMs = update.startedAtMs ?? Date.now();
          setMessages(current => current.some(message => message.role === 'work' && !message.done)
            ? current
            : [...current, { done: false, id: startedAtMs, role: 'work', startedAtMs, text: '' }]);
        }
        if (update.status === 'settled') {
          flushAssistant();
          setMessages((current) => {
            const workIndex = current.findLastIndex(message => message.role === 'work' && !message.done);
            return workIndex < 0
              ? current
              : [...current.slice(0, workIndex), { ...current[workIndex]!, completedAtMs: update.completedAtMs ?? Date.now(), done: true, workStatus: update.workStatus ?? 'worked' }, ...current.slice(workIndex + 1)];
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
      if (update.type === 'tool') {
        setMessages((current) => {
          const index = current.findLastIndex(message => message.role === 'activity' && message.toolCallId === update.toolCallId);
          const message: Message = {
            done: update.status !== 'running',
            id: index < 0 ? Date.now() : current[index]!.id,
            role: 'activity',
            text: update.toolName,
            toolArgs: update.args ?? (index < 0 ? undefined : current[index]!.toolArgs),
            toolCallId: update.toolCallId,
            toolName: update.toolName,
            toolOutput: update.output ?? (index < 0 ? undefined : current[index]!.toolOutput),
            toolStatus: update.status,
          };
          return index < 0 ? [...current, message] : [...current.slice(0, index), message, ...current.slice(index + 1)];
        });
        return;
      }
      if (update.done) {
        discardPendingAssistant();
        appendAssistant(update);
        return;
      }

      pendingAssistantRef.current = update;
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
      onStop={() => void window.api.composer.stop()}
      onSubmitted={(text) => {
        const startedAtMs = Date.now();
        setMessages(current => [...current, { id: startedAtMs, role: 'user', startedAtMs, text, timestamp: startedAtMs }]);
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

  const forkAssistantMessage = async (entryId: string) => {
    const session = await window.api.composer.forkAssistantMessage(entryId);
    window.dispatchEvent(new CustomEvent<PiSessionSnapshot>('session-changed', { detail: session }));
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
              <img alt="PI" className="chat-empty-state-logo" src={logo} />
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
                  {message.role === 'work'
                    ? <WorkedFor completedAtMs={message.completedAtMs} done={message.done} startedAtMs={message.startedAtMs} status={message.workStatus} />
                    : (
                        <article className={`chat-message chat-message-${message.role}${editingMessage?.id === message.id ? ' is-editing' : ''}`}>
                          {message.role === 'assistant'
                            ? (
                                <>
                                  <MarkdownMessage>{message.text}</MarkdownMessage>
                                  {message.done && message.text.trim() && <AssistantMessageFooter entryId={message.entryId} isLatest={messages.at(-1) === message} isRunning={isRunning} onFork={forkAssistantMessage} text={message.text} timestamp={message.timestamp} />}
                                </>
                              )
                            : message.role === 'user'
                              ? (
                                  editingMessage?.id === message.id
                                    ? <ChatComposer inlineEdit={{ initialText: editingMessage.text, onCancel: () => setEditingMessage(undefined), onSubmit: submitEditedLastUserMessage }} onSubmitted={() => {}} />
                                    : (
                                        <>
                                          <div className="chat-message-user-content" onDoubleClick={!isRunning && message.id === lastUserMessageId ? () => setEditingMessage({ id: message.id, text: message.text }) : undefined}>{message.text}</div>
                                          <UserMessageFooter canEdit={!isRunning && message.id === lastUserMessageId} onEdit={() => setEditingMessage({ id: message.id, text: message.text })} text={message.text} timestamp={message.timestamp} />
                                        </>
                                      )
                                )
                              : message.role === 'activity'
                                ? <ToolActivity args={message.toolArgs} name={message.toolName ?? message.text} output={message.toolOutput} status={message.toolStatus ?? 'running'} />
                                : message.text}
                        </article>
                      )}
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

function ToolActivity({ args, name, output, status }: { args?: unknown; name: string; output?: unknown; status: NonNullable<Message['toolStatus']> }) {
  const [expanded, setExpanded] = useState(false);
  const label = status === 'running' ? `正在使用工具 ${name}` : status === 'completed' ? `已完成工具 ${name}` : `工具 ${name} 执行失败`;
  const command = toolSummary(args);
  const result = toolText(output);
  const hasDetails = command != null || result != null;
  const isExpanded = status === 'running' || expanded;
  return (
    <div aria-label={label} aria-live={status === 'running' ? 'polite' : undefined} className="chat-tool-activity" role={status === 'running' ? 'status' : undefined}>
      <button aria-expanded={isExpanded} aria-label={`${isExpanded ? '隐藏' : '显示'}工具 ${name} 详情`} className="chat-tool-activity-header" disabled={!hasDetails || status === 'running'} onClick={() => setExpanded(value => !value)} type="button">
        {status === 'running' && <LoaderCircle aria-hidden="true" className="chat-composer-send-loading" size={16} />}
        <span>
          {label}
          {status === 'running' ? '…' : ''}
        </span>
        {hasDetails && status !== 'running' && <span aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span>}
      </button>
      {isExpanded && hasDetails && (
        <div className="chat-tool-activity-details">
          {command != null && <code>{command}</code>}
          {result != null && <pre>{result}</pre>}
        </div>
      )}
    </div>
  );
}

function toolSummary(args: unknown): string | undefined {
  if (args == null)
    return undefined;
  if (typeof args === 'object' && !Array.isArray(args)) {
    const { command, path } = args as Record<string, unknown>;
    if (typeof command === 'string')
      return command;
    if (typeof path === 'string')
      return path;
  }
  return toolText(args);
}

function toolText(value: unknown): string | undefined {
  if (value == null)
    return undefined;
  if (typeof value === 'string')
    return value;
  try {
    return JSON.stringify(value, null, 2);
  }
  catch {
    return String(value);
  }
}

function WorkedFor({ completedAtMs, done, startedAtMs, status }: Pick<Message, 'completedAtMs' | 'done' | 'startedAtMs' | 'workStatus'> & { status?: 'stopped' | 'worked' }) {
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
  const label = status === 'stopped'
    ? formatMessage({ id: 'conversation.stoppedAfter' }, { duration })
    : completedAtMs != null
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

function UserMessageFooter({ canEdit, onEdit, text, timestamp }: Pick<Message, 'text' | 'timestamp'> & { canEdit: boolean; onEdit: () => void }) {
  const time = formatMessageTime(timestamp);

  return (
    <footer className="chat-message-user-footer">
      {time != null && <time dateTime={new Date(timestamp!).toISOString()}>{time}</time>}
      {canEdit && <button aria-label="Edit message" className="chat-message-user-copy" onClick={onEdit} title="Edit message" type="button"><Pencil aria-hidden="true" size={14} /></button>}
      <button aria-label="Copy message" className="chat-message-user-copy" onClick={() => void navigator.clipboard?.writeText(text)} title="Copy message" type="button">
        <Copy aria-hidden="true" size={14} />
      </button>
    </footer>
  );
}

function AssistantMessageFooter({ entryId, isLatest, isRunning, onFork, text, timestamp }: Pick<Message, 'entryId' | 'text' | 'timestamp'> & { isLatest: boolean; isRunning: boolean; onFork: (entryId: string) => Promise<void> }) {
  const time = formatMessageTime(timestamp);
  return (
    <footer className={`chat-message-assistant-footer${isLatest ? ' is-latest' : ''}`}>
      <button aria-label="Copy assistant message" className="chat-message-assistant-action" onClick={() => void navigator.clipboard?.writeText(text)} title="Copy message" type="button"><Copy aria-hidden="true" size={18} /></button>
      {entryId != null && !isRunning && <button aria-label="Fork conversation from this message" className="chat-message-assistant-action" onClick={() => void onFork(entryId)} title="Fork conversation" type="button"><GitFork aria-hidden="true" size={18} /></button>}
      {time != null && <time className="chat-message-assistant-timestamp" dateTime={new Date(timestamp!).toISOString()}>{time}</time>}
    </footer>
  );
}

function formatMessageTime(timestamp: number | undefined): string | null {
  if (timestamp == null)
    return null;
  const time = new Date(timestamp);
  const now = new Date();
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysFromNow = Math.round((day(time) - day(now)) / 86_400_000);
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (daysFromNow === 0)
    return new Intl.DateTimeFormat(undefined, timeOptions).format(time);
  if (daysFromNow < 0 && daysFromNow > -7)
    return new Intl.DateTimeFormat(undefined, { ...timeOptions, weekday: 'long' }).format(time);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(time);
}
