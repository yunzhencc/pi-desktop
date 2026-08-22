import type { AttachmentMetadata } from '@shared/types';
import type { CSSProperties } from 'react';
import type { Message, PiSessionSnapshot } from './model/transcript';
import logo from '@renderer/assets/icon.svg';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AttachmentList, ChatComposer, MarkdownMessage, NewConversationToolbar, ProjectPicker, ThreadScrollLayout } from './components';
import { AssistantMessageFooter, ToolActivity, UserMessageFooter, WorkedFor } from './components/message-turn';
import {
  appendAssistantMessage,
  appendSubmittedUserMessage,
  applyComposerUpdate,
  restoreSessionMessages,
  updateUserMessageText,
} from './model/transcript';
import './style.css';

type WorkspaceSnapshot = Awaited<ReturnType<Window['piApp']['workspaces']['get']>>;

export function ConversationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessage, setEditingMessage] = useState<{ id: number; text: string }>();
  const [isRunning, setIsRunning] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>();
  const workspaceRef = useRef<WorkspaceSnapshot>();
  const composerFooterRef = useRef<HTMLDivElement>(null);
  const pendingAssistantRef = useRef<{ done: boolean; entryId?: string; text: string; timestamp?: number } | null>(null);
  const streamingFrameRef = useRef<number | null>(null);
  const sessionPathRef = useRef<string>();
  const [composerFooterHeightPx, setComposerFooterHeightPx] = useState(0);

  useEffect(() => {
    let active = true;
    void window.piApp.workspaces.get().then((snapshot) => {
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
      if (next.selectedWorkspacePath !== workspaceRef.current?.selectedWorkspacePath) {
        sessionPathRef.current = undefined;
        setMessages([]);
      }
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
      sessionPathRef.current = undefined;
      setMessages([]);
      void window.piApp.composer.newConversation();
    };
    const openSession = (event: Event) => {
      if (streamingFrameRef.current != null)
        cancelAnimationFrame(streamingFrameRef.current);
      streamingFrameRef.current = null;
      pendingAssistantRef.current = null;
      setIsRunning(false);
      const session = (event as CustomEvent<PiSessionSnapshot>).detail;
      sessionPathRef.current = session.path;
      setMessages(restoreSessionMessages(session, readSessionAttachments(session.path)));
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
      setMessages(current => appendAssistantMessage(current, { done, entryId, text, timestamp }));
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
    const unsubscribe = window.piApp.composer.onUpdate((update) => {
      if (update.type === 'status') {
        if (update.status === 'settled')
          flushAssistant();
        setMessages(current => applyComposerUpdate(current, update));
        setIsRunning(update.status === 'running');
        return;
      }
      if (update.type === 'session') {
        sessionPathRef.current = update.sessionPath;
        if (update.sessionPath) {
          setMessages((current) => {
            writeSessionAttachments(update.sessionPath!, current);
            return current;
          });
        }
        return;
      }
      if (update.type === 'error') {
        flushAssistant();
        setMessages(current => applyComposerUpdate(current, update));
        return;
      }
      if (update.type === 'tool') {
        setMessages(current => applyComposerUpdate(current, update));
        return;
      }
      if (update.done) {
        discardPendingAssistant();
        setMessages(current => applyComposerUpdate(current, update));
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
      onStop={() => void window.piApp.composer.stop()}
      onSubmitted={(text, attachments) => {
        setMessages((current) => {
          const next = appendSubmittedUserMessage(current, text, attachments);
          if (sessionPathRef.current)
            writeSessionAttachments(sessionPathRef.current, next);
          return next;
        });
      }}
      workspace={workspace}
    />
  );

  const submitEditedLastUserMessage = async (text: string) => {
    const message = editingMessage;
    if (message == null || !text.trim())
      return;
    const sourceText = await window.piApp.composer.editLastUserMessage(text);
    if (sourceText == null)
      return;
    setMessages(current => updateUserMessageText(current, message.id, text));
    setEditingMessage(undefined);
    window.dispatchEvent(new Event('sessions-changed'));
  };

  const forkAssistantMessage = async (entryId: string) => {
    const session = await window.piApp.composer.forkAssistantMessage(entryId);
    window.dispatchEvent(new CustomEvent<PiSessionSnapshot>('session-changed', { detail: session }));
    window.dispatchEvent(new Event('sessions-changed'));
  };

  const createProject = () => window.dispatchEvent(new Event('create-project'));
  const selectProject = (path: string) => {
    void window.piApp.workspaces.select(path).then(next => window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: next })));
  };
  const clearProject = () => {
    void window.piApp.workspaces.clear().then(next => window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: next })));
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
    <section className="chat-page relative flex min-h-0 flex-1 flex-col pt-11.5" style={{ '--thread-scroll-padding-bottom': `${composerFooterHeightPx + 16}px` } as CSSProperties}>
      {messages.length === 0
        ? (
            <div className="chat-empty-state m-auto flex w-[min(100%_-_32px,1000px)] -translate-y-[42px] flex-col items-center gap-6 text-center">
              <img alt="PI" className="size-16" src={logo} />
              <h1 className="text-[28px] leading-[1.2] font-normal text-foreground tracking-normal">
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
              footer={<div className="chat-composer-wrap mx-auto w-[min(100%_-_32px,720px)]" ref={composerFooterRef}>{composer}</div>}
              turns={messages.map(message => ({ key: String(message.id), message }))}
            >
              {({ message }) => (
                <div className="chat-turn flex w-full flex-col">
                  {message.role === 'work'
                    ? <WorkedFor completedAtMs={message.completedAtMs} done={message.done} startedAtMs={message.startedAtMs} status={message.workStatus} />
                    : (
                        <article className={`chat-message chat-message-${message.role} w-fit max-w-[min(100%,44rem)] text-base leading-normal${editingMessage?.id === message.id ? ' is-editing' : ''}`}>
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
                                        <div className="chat-message-user-stack">
                                          {message.attachments?.length ? <AttachmentList attachments={message.attachments} variant="message" /> : null}
                                          <div className="chat-message-user-content overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]" onDoubleClick={!isRunning && message.id === lastUserMessageId ? () => setEditingMessage({ id: message.id, text: message.text }) : undefined}>
                                            {message.text}
                                          </div>
                                          <UserMessageFooter canEdit={!isRunning && message.id === lastUserMessageId} onEdit={() => setEditingMessage({ id: message.id, text: message.text })} text={message.text} timestamp={message.timestamp} />
                                        </div>
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
        <div className="chat-composer-footer absolute right-0 bottom-0 left-0 z-[1] bg-surface pb-4" ref={composerFooterRef}>
          <div className="chat-composer-wrap mx-auto w-[min(100%_-_32px,720px)]">
            {newConversationToolbar}
            {composer}
          </div>
        </div>
      )}
    </section>
  );
}

const sessionAttachmentsStorageKey = 'pi-desktop:session-attachments:v1';

function readSessionAttachments(sessionPath?: string): AttachmentMetadata[][] {
  if (!sessionPath)
    return [];
  try {
    const stored = localStorage.getItem(sessionAttachmentsStorageKey);
    if (!stored)
      return [];
    const value = JSON.parse(stored) as Record<string, AttachmentMetadata[][]>;
    const attachments = value[sessionPath];
    return Array.isArray(attachments) ? attachments.map(group => Array.isArray(group) ? group.filter(isAttachmentMetadata) : []) : [];
  }
  catch {
    return [];
  }
}

function writeSessionAttachments(sessionPath: string, messages: Message[]): void {
  const userAttachments = messages
    .filter(message => message.role === 'user')
    .map(message => message.attachments ?? []);
  if (!userAttachments.some(attachments => attachments.length > 0))
    return;
  try {
    const stored = localStorage.getItem(sessionAttachmentsStorageKey);
    const value = stored ? JSON.parse(stored) as Record<string, AttachmentMetadata[][]> : {};
    value[sessionPath] = userAttachments;
    localStorage.setItem(sessionAttachmentsStorageKey, JSON.stringify(value));
  }
  catch {
    // Ignore attachment display cache failures; prompt delivery does not depend on it.
  }
}

function isAttachmentMetadata(value: unknown): value is AttachmentMetadata {
  return typeof value === 'object'
    && value !== null
    && typeof (value as AttachmentMetadata).id === 'string'
    && typeof (value as AttachmentMetadata).name === 'string'
    && typeof (value as AttachmentMetadata).size === 'number'
    && ['file', 'image', 'pdf', 'text'].includes((value as AttachmentMetadata).kind);
}
