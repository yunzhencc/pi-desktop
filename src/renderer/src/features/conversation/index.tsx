import type { AttachmentMetadata } from '@shared/types';
import type { CSSProperties, ReactNode } from 'react';
import type { ThreadNavigation, UserMessageNavigationItem } from './components';
import type { Message, PiSessionSnapshot } from './model/transcript';
import logo from '@renderer/assets/icon.svg';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { AttachmentList, ChatComposer, MarkdownMessage, NewConversationToolbar, ProjectPicker, ThreadScrollLayout } from './components';
import { ActivitySummary, AssistantMessageFooter, ToolActivity, UserMessageFooter, WorkedFor } from './components/message-turn';
import {
  appendAssistantMessage,
  appendSubmittedUserMessage,
  applyComposerUpdate,
  restoreSessionMessages,
  updateUserMessageText,
} from './model/transcript';
import './style.css';

type WorkspaceSnapshot = Awaited<ReturnType<Window['piApp']['workspaces']['get']>>;
type ConversationTurn
  = | { key: string; message: Message; type: 'message' }
    | { activities: Message[]; key: string; type: 'activities' }
    | { activities: Message[]; assistant?: Message; key: string; type: 'activity-turn'; work: Message };

export function ConversationPage() {
  const { formatMessage } = useIntl();
  const [messages, setMessages] = useState<Message[]>([]);
  const [collapsedActivityTurns, setCollapsedActivityTurns] = useState<Set<number>>(() => new Set());
  const [bookmarkedUserEntryIds, setBookmarkedUserEntryIds] = useState<Set<string>>(() => new Set());
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
        setCollapsedActivityTurns(new Set());
        setBookmarkedUserEntryIds(new Set());
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
      setCollapsedActivityTurns(new Set());
      setBookmarkedUserEntryIds(new Set());
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
      setCollapsedActivityTurns(new Set());
      setBookmarkedUserEntryIds(new Set(session.bookmarkedUserEntryIds));
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
  const turns = groupConversationTurns(messages);
  const userNavigationItems = buildUserMessageNavigationItems(messages, bookmarkedUserEntryIds);
  const navigation: ThreadNavigation = {
    items: userNavigationItems,
    onBookmarkChange: (item, bookmarked) => {
      if (!item.entryId)
        return;
      void window.piApp.composer.setUserMessageBookmarked(item.entryId, bookmarked).then(ids => setBookmarkedUserEntryIds(new Set(ids))).catch(() => {});
    },
  };
  const renderUserMessage = (message: Message) => {
    const visibleText = visibleUserMessageText(message);
    const hasVisibleText = visibleText.trim().length > 0;
    return editingMessage?.id === message.id
      ? <ChatComposer inlineEdit={{ initialText: editingMessage.text, onCancel: () => setEditingMessage(undefined), onSubmit: submitEditedLastUserMessage }} onSubmitted={() => {}} />
      : (
          <div className="chat-message-user-stack">
            {message.attachments?.length ? <AttachmentList animationTarget={!hasVisibleText} attachments={message.attachments} variant="message" /> : null}
            {hasVisibleText
              ? (
                  <div className="chat-message-user-content overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]" data-user-message-bubble onDoubleClick={!isRunning && message.id === lastUserMessageId ? () => setEditingMessage({ id: message.id, text: message.text }) : undefined}>
                    {visibleText}
                  </div>
                )
              : null}
            <UserMessageFooter canEdit={!isRunning && message.id === lastUserMessageId} onEdit={() => setEditingMessage({ id: message.id, text: message.text })} text={visibleText} timestamp={message.timestamp} />
          </div>
        );
  };
  const renderAssistantMessageContent = (message: Message) => (
    <>
      <MarkdownMessage>{message.text}</MarkdownMessage>
      {message.done && message.text.trim() && <AssistantMessageFooter entryId={message.entryId} isLatest={messages.at(-1) === message} isRunning={isRunning} onFork={forkAssistantMessage} text={message.text} timestamp={message.timestamp} />}
    </>
  );
  const renderAssistantMessage = (message: Message) => (
    <article className={`chat-message chat-message-assistant w-fit max-w-[min(100%,44rem)]${editingMessage?.id === message.id ? ' is-editing' : ''}`}>
      {renderAssistantMessageContent(message)}
    </article>
  );
  const renderMessage = (message: Message) => (
    <div className="chat-turn flex w-full flex-col">
      {message.role === 'work'
        ? <WorkedFor completedAtMs={message.completedAtMs} done={message.done} startedAtMs={message.startedAtMs} status={message.workStatus} />
        : (
            <article className={`chat-message chat-message-${message.role} w-fit max-w-[min(100%,44rem)]${editingMessage?.id === message.id ? ' is-editing' : ''}`}>
              {message.role === 'assistant'
                ? renderAssistantMessageContent(message)
                : message.role === 'user'
                  ? (
                      renderUserMessage(message)
                    )
                  : message.text}
            </article>
          )}
    </div>
  );
  const renderTurn = (turn: ConversationTurn) => {
    if (turn.type === 'activity-turn') {
      return (
        <ActivityTurn
          activities={turn.activities}
          assistant={turn.assistant}
          collapsed={collapsedActivityTurns.has(turn.work.id)}
          onToggle={() => {
            setCollapsedActivityTurns((current) => {
              const next = new Set(current);
              if (next.has(turn.work.id))
                next.delete(turn.work.id);
              else
                next.add(turn.work.id);
              return next;
            });
          }}
          work={turn.work}
          renderAssistant={renderAssistantMessage}
        />
      );
    }

    if (turn.type === 'activities') {
      return (
        <div className="chat-turn flex w-full flex-col">
          <article className="chat-message chat-message-activity w-fit max-w-[min(100%,44rem)]">
            <div className="grid gap-2.5" data-activity-group>
              {turn.activities.map(message => (
                <ToolActivity args={message.toolArgs} key={message.id} name={message.toolName ?? message.text} output={message.toolOutput} status={message.toolStatus ?? 'running'} />
              ))}
            </div>
          </article>
        </div>
      );
    }

    return renderMessage(turn.message);
  };

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
                        {formatMessage({ id: 'conversation.empty.withProject.prefix' })}
                        <ProjectPicker onCreateProject={createProject} onSelectProject={selectProject} triggerClassName="chat-empty-state-project-trigger" workspace={workspace}>
                          {selectedWorkspace.displayName}
                        </ProjectPicker>
                        {formatMessage({ id: 'conversation.empty.withProject.suffix' })}
                      </>
                    )
                  : formatMessage({ id: 'conversation.empty.withoutProject' })}
              </h1>
            </div>
          )
        : (
            <ThreadScrollLayout
              footer={<div className="chat-composer-wrap mx-auto w-[min(100%_-_32px,720px)]" ref={composerFooterRef}>{composer}</div>}
              navigation={navigation}
              turns={turns}
            >
              {renderTurn}
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

function groupConversationTurns(messages: Message[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let activities: Message[] = [];
  let activityTurn: Extract<ConversationTurn, { type: 'activity-turn' }> | undefined;
  const flushActivityTurn = () => {
    if (activityTurn == null)
      return;
    if (activityTurn.activities.length === 0 && activityTurn.assistant == null)
      turns.push({ key: activityTurn.key, message: activityTurn.work, type: 'message' });
    else
      turns.push(activityTurn);
    activityTurn = undefined;
  };
  const flushActivities = () => {
    if (activities.length === 0)
      return;
    turns.push({ activities, key: activities.map(message => message.id).join(':'), type: 'activities' });
    activities = [];
  };

  for (const message of messages) {
    if (message.role === 'work') {
      flushActivityTurn();
      activityTurn = { activities, key: String(message.id), type: 'activity-turn', work: message };
      activities = [];
      continue;
    }
    if (message.role === 'activity') {
      if (activityTurn != null)
        activityTurn.activities.push(message);
      else
        activities.push(message);
      continue;
    }
    if (message.role === 'assistant' && activityTurn != null) {
      activityTurn.assistant = message;
      activityTurn.key = `${activityTurn.key}:${message.id}`;
      flushActivityTurn();
      continue;
    }
    flushActivities();
    flushActivityTurn();
    turns.push({ key: String(message.id), message, type: 'message' });
  }
  flushActivities();
  flushActivityTurn();
  return turns;
}

function buildUserMessageNavigationItems(messages: Message[], bookmarkedUserEntryIds: ReadonlySet<string>): UserMessageNavigationItem[] {
  return messages.flatMap((message, index) => {
    if (message.role !== 'user')
      return [];
    const response = messages.slice(index + 1).find(candidate => candidate.role === 'assistant' || candidate.role === 'user');
    const entryId = message.entryId;
    return [{
      ...(entryId ? { entryId } : {}),
      id: entryId ?? `message:${message.id}`,
      isBookmarked: entryId != null && bookmarkedUserEntryIds.has(entryId),
      label: visibleUserMessageText(message) || message.attachments?.map(attachment => attachment.name).join(', ') || '',
      response: response?.role === 'assistant' ? response.text : '',
      turnKey: String(message.id),
    }];
  });
}

function ActivityTurn({ activities, assistant, collapsed, onToggle, renderAssistant, work }: Extract<ConversationTurn, { type: 'activity-turn' }> & { collapsed: boolean; onToggle: () => void; renderAssistant: (message: Message) => ReactNode }) {
  const isRunning = !work.done && work.completedAtMs == null;
  const hasActivities = activities.length > 0;
  const isExpanded = isRunning || !collapsed;

  return (
    <div className="chat-activity-turn flex w-full flex-col" data-activity-turn>
      <WorkedFor
        completedAtMs={work.completedAtMs}
        done={work.done}
        expanded={isExpanded}
        onToggle={isRunning || !hasActivities ? undefined : onToggle}
        startedAtMs={work.startedAtMs}
        status={work.workStatus}
      >
        {hasActivities && (
          <div className="chat-activity-turn-content grid">
            {activities.map(message => <ActivitySummary args={message.toolArgs} key={message.id} name={message.toolName ?? message.text} output={message.toolOutput} status={message.toolStatus ?? 'running'} />)}
          </div>
        )}
      </WorkedFor>
      {assistant != null && renderAssistant(assistant)}
    </div>
  );
}

function visibleUserMessageText(message: Message): string {
  return message.attachments?.length && isAttachmentReferenceOnlyText(message.text, message.attachments.map(attachment => attachment.name))
    ? ''
    : message.text;
}

function isAttachmentReferenceOnlyText(text: string, attachmentNames: string[]): boolean {
  const names = new Set(attachmentNames);
  const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => {
    const path = parseFileReference(line);
    return path != null && names.has(path.replaceAll('\\', '/').split('/').at(-1) ?? '');
  });
}

function parseFileReference(line: string): string | undefined {
  const quoted = line.match(/^@"((?:\\.|[^"\\])*)"$/);
  if (quoted)
    return quoted[1]!.replaceAll(/\\(["\\])/g, '$1');
  const unquoted = line.match(/^@(\S+)$/);
  return unquoted?.[1];
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
