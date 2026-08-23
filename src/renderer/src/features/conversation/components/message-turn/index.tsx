import type { ReactNode } from 'react';
import { BookOpen, ChevronRight, CircleAlert, Copy, FilePenLine, GitFork, Globe, LoaderCircle, Pencil, Terminal, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

type ToolStatus = 'completed' | 'failed' | 'running';
type FormatMessage = ReturnType<typeof useIntl>['formatMessage'];

interface ToolActivityProps {
  args?: unknown;
  name: string;
  output?: unknown;
  status: ToolStatus;
}

interface WorkedForProps {
  children?: ReactNode;
  completedAtMs?: number;
  done?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  startedAtMs?: number;
  status?: 'stopped' | 'worked';
}

interface UserMessageFooterProps {
  canEdit: boolean;
  onEdit: () => void;
  text: string;
  timestamp?: number;
}

interface AssistantMessageFooterProps {
  entryId?: string;
  isLatest: boolean;
  isRunning: boolean;
  onFork: (entryId: string) => Promise<void>;
  text: string;
  timestamp?: number;
}

export function ToolActivity({ args, name, output, status }: ToolActivityProps) {
  const { formatMessage } = useIntl();
  const [expanded, setExpanded] = useState(false);
  if (isWebSearchTool(name))
    return <WebSearchActivity args={args} expanded={status === 'running' || expanded} onToggle={() => setExpanded(value => !value)} status={status} variant="tool" />;

  const label = toolActivityLabel(name, status, formatMessage);
  const command = toolSummary(args);
  const result = toolText(output);
  const hasDetails = command != null || result != null;
  const isExpanded = status === 'running' || expanded;
  return (
    <div aria-label={label} aria-live={status === 'running' ? 'polite' : undefined} className="chat-tool-activity w-[min(100%,44rem)]" role={status === 'running' ? 'status' : undefined}>
      <button aria-expanded={isExpanded} aria-label={formatMessage({ id: 'conversation.tool.detailsToggle' }, { expanded: String(isExpanded), name })} className="chat-tool-activity-header group flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-inherit disabled:cursor-default" disabled={!hasDetails || status === 'running'} onClick={() => setExpanded(value => !value)} type="button">
        {status === 'running' && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={16} />}
        <span>
          {label}
          {status === 'running' ? '…' : ''}
        </span>
        {hasDetails && status !== 'running' && <ChevronRight aria-hidden="true" className={collapseIconClass(isExpanded)} size={14} />}
      </button>
      {isExpanded && hasDetails && (
        <div className="chat-tool-activity-details mt-1.5 ml-6 grid gap-2 overflow-x-hidden overflow-y-auto rounded-lg border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-2.5 py-2 font-mono text-xs leading-normal [overflow-wrap:anywhere] text-text-secondary [&_code]:m-0 [&_code]:whitespace-pre-wrap [&_pre]:m-0 [&_pre]:whitespace-pre-wrap">
          {command != null && <code>{command}</code>}
          {result != null && <pre>{result}</pre>}
        </div>
      )}
    </div>
  );
}

export function ActivitySummary({ args, name, output, status }: ToolActivityProps) {
  const { formatMessage } = useIntl();
  const [expanded, setExpanded] = useState(false);
  if (isWebSearchTool(name))
    return <WebSearchActivity args={args} expanded={status === 'running' || expanded} onToggle={() => setExpanded(value => !value)} status={status} variant="summary" />;

  const command = toolSummary(args);
  const result = toolText(output);
  const hasDetails = command != null || result != null;
  const isExpanded = status === 'running' || expanded;
  const label = activitySummaryLabel(name, status, formatMessage);

  return (
    <div aria-label={label} aria-live={status === 'running' ? 'polite' : undefined} className="chat-activity-summary-item w-[min(100%,44rem)]" role={status === 'running' ? 'status' : undefined}>
      <button aria-expanded={isExpanded} aria-label={formatMessage({ id: 'conversation.tool.detailsToggle' }, { expanded: String(isExpanded), name })} className="group flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-[13px] leading-5 text-text-tertiary disabled:cursor-default" disabled={!hasDetails || status === 'running'} onClick={() => setExpanded(value => !value)} type="button">
        <ActivityIcon name={name} status={status} />
        <span>
          {label}
          {status === 'running' ? '…' : ''}
        </span>
        {hasDetails && status !== 'running' && <ChevronRight aria-hidden="true" className={collapseIconClass(isExpanded)} size={14} />}
      </button>
      {isExpanded && hasDetails && (
        <div className="chat-tool-activity-details mt-1.5 ml-6 grid gap-2 overflow-x-hidden overflow-y-auto rounded-lg border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-2.5 py-2 font-mono text-xs leading-normal [overflow-wrap:anywhere] text-text-secondary [&_code]:m-0 [&_code]:whitespace-pre-wrap [&_pre]:m-0 [&_pre]:whitespace-pre-wrap">
          {command != null && <code>{command}</code>}
          {result != null && <pre>{result}</pre>}
        </div>
      )}
    </div>
  );
}

function WebSearchActivity({ args, expanded, onToggle, status, variant }: { args?: unknown; expanded: boolean; onToggle: () => void; status: ToolStatus; variant: 'summary' | 'tool' }) {
  const { formatMessage } = useIntl();
  const details = webSearchDetails(args);
  const hasDetails = details.length > 0;
  const label = webSearchLabel(status, formatMessage);
  const disabled = !hasDetails || status === 'running';
  const buttonLabel = formatMessage({ id: 'conversation.webSearch.detailsToggle' }, { expanded: String(expanded) });
  const content = (
    <>
      <button aria-expanded={expanded} aria-label={buttonLabel} className="group flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-[13px] leading-5 text-text-tertiary disabled:cursor-default" disabled={disabled} onClick={onToggle} type="button">
        <Globe aria-hidden="true" size={16} />
        <span>{label}</span>
        {hasDetails && status !== 'running' && <ChevronRight aria-hidden="true" className={collapseIconClass(expanded)} size={14} />}
      </button>
      {expanded && hasDetails && (
        <div className="mt-1.5 ml-6 grid gap-2 text-[13px] leading-5 text-text-tertiary">
          {details.map(detail => (
            <p className="m-0 [overflow-wrap:anywhere]" key={detail}>
              <Globe aria-hidden="true" className="mr-2 inline align-[-3px]" size={16} />
              {`${label}：${detail}`}
            </p>
          ))}
        </div>
      )}
    </>
  );
  return variant === 'tool'
    ? <div aria-label={label} aria-live={status === 'running' ? 'polite' : undefined} className="chat-tool-activity w-[min(100%,44rem)]" role={status === 'running' ? 'status' : undefined}>{content}</div>
    : <div aria-label={label} aria-live={status === 'running' ? 'polite' : undefined} className="chat-activity-summary-item w-[min(100%,44rem)]" role={status === 'running' ? 'status' : undefined}>{content}</div>;
}

function toolActivityLabel(name: string, status: ToolStatus, formatMessage: FormatMessage): string {
  if (status === 'running')
    return formatMessage({ id: 'conversation.tool.generic.running' }, { name });
  if (status === 'failed')
    return formatMessage({ id: 'conversation.tool.generic.failed' }, { name });
  return formatMessage({ id: 'conversation.tool.generic.completed' }, { name });
}

function activitySummaryLabel(name: string, status: ToolStatus, formatMessage: FormatMessage): string {
  const isCommand = name === 'bash' || name === 'exec';
  const isRead = name === 'read';
  const isEdit = name === 'edit' || name === 'patch' || name === 'write';
  if (status === 'running') {
    return isCommand
      ? formatMessage({ id: 'conversation.tool.run.running' })
      : isRead
        ? formatMessage({ id: 'conversation.tool.read.running' })
        : isEdit
          ? formatMessage({ id: 'conversation.tool.edit.running' })
          : formatMessage({ id: 'conversation.tool.generic.running' }, { name });
  }
  if (status === 'failed') {
    return isCommand
      ? formatMessage({ id: 'conversation.tool.run.failed' })
      : isRead
        ? formatMessage({ id: 'conversation.tool.read.failed' })
        : isEdit
          ? formatMessage({ id: 'conversation.tool.edit.failed' })
          : formatMessage({ id: 'conversation.tool.generic.failed' }, { name });
  }
  return isCommand
    ? formatMessage({ id: 'conversation.tool.run.completed' })
    : isRead
      ? formatMessage({ id: 'conversation.tool.read.completed' })
      : isEdit
        ? formatMessage({ id: 'conversation.tool.edit.completed' })
        : formatMessage({ id: 'conversation.tool.generic.completed' }, { name });
}

function webSearchLabel(status: ToolStatus, formatMessage: FormatMessage): string {
  if (status === 'running')
    return formatMessage({ id: 'conversation.webSearch.running' });
  if (status === 'failed')
    return formatMessage({ id: 'conversation.webSearch.failed' });
  return formatMessage({ id: 'conversation.webSearch.completed' });
}

function isWebSearchTool(name: string): boolean {
  return name === 'web_search' || name === 'web-search';
}

function webSearchDetails(args: unknown): string[] {
  if (!isRecord(args))
    return [];
  const source = isRecord(args.action) ? args.action : args;
  const details = [
    ...stringValues(source.queries),
    stringValue(source.query),
    webSearchFindDetail(source) ?? stringValue(source.url),
  ].filter((value): value is string => value != null && value.trim().length > 0);
  return [...new Set(details.map(value => value.trim()))];
}

function webSearchFindDetail(source: Record<string, unknown>): string | undefined {
  const pattern = stringValue(source.pattern);
  const url = stringValue(source.url);
  if (pattern && url)
    return `'${pattern}' in ${url}`;
  return pattern;
}

function ActivityIcon({ name, status }: Pick<ToolActivityProps, 'name' | 'status'>) {
  if (status === 'running')
    return <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={16} />;
  if (status === 'failed')
    return <CircleAlert aria-hidden="true" size={16} />;
  if (name === 'bash' || name === 'exec')
    return <Terminal aria-hidden="true" size={16} />;
  if (name === 'read')
    return <BookOpen aria-hidden="true" size={16} />;
  if (name === 'edit' || name === 'patch' || name === 'write')
    return <FilePenLine aria-hidden="true" size={16} />;
  return <Wrench aria-hidden="true" size={16} />;
}

function collapseIconClass(expanded: boolean): string {
  return `transition-[opacity,transform] group-hover:opacity-100 group-focus-visible:opacity-100 ${expanded ? 'rotate-90 opacity-100' : 'opacity-0'}`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

export function WorkedFor({ children, completedAtMs, done, expanded, onToggle, startedAtMs, status }: WorkedForProps) {
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
  const isRunning = !done && completedAtMs == null;
  const showThinkingPlaceholder = isRunning && children == null;
  const visibleLabel = showThinkingPlaceholder ? formatMessage({ id: 'conversation.thinking' }) : label;
  const labelClassName = showThinkingPlaceholder ? 'chat-worked-for-label is-running' : 'chat-worked-for-label';
  return (
    <div className="chat-worked-for flex w-full flex-col text-[13px] leading-5 text-text-tertiary" data-duration-divider>
      {onToggle == null
        ? (
            <p className="m-0 flex items-center">
              <span className={labelClassName}>{visibleLabel}</span>
            </p>
          )
        : (
            <button aria-expanded={expanded} aria-label={formatMessage({ id: 'conversation.tool.activityToggle' }, { expanded: String(Boolean(expanded)) })} className="group flex w-fit cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-inherit" onClick={onToggle} type="button">
              <span className={labelClassName}>{visibleLabel}</span>
              <ChevronRight aria-hidden="true" className={collapseIconClass(expanded ?? false)} size={15} />
            </button>
          )}
      <div aria-hidden="true" className="chat-worked-for-rule w-full border-t border-border-subtle" />
      {expanded && children}
    </div>
  );
}

export function UserMessageFooter({ canEdit, onEdit, text, timestamp }: UserMessageFooterProps) {
  const { formatMessage } = useIntl();
  const time = formatMessageTime(timestamp);
  const hasText = text.trim().length > 0;

  return (
    <footer className="chat-message-user-footer">
      {time != null && <time dateTime={new Date(timestamp!).toISOString()}>{time}</time>}
      {canEdit && <button aria-label={formatMessage({ id: 'conversation.messageActions.editMessage' })} className="chat-message-user-copy grid size-5 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-text-secondary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:text-text-secondary" onClick={onEdit} title={formatMessage({ id: 'conversation.messageActions.editMessage' })} type="button"><Pencil aria-hidden="true" size={14} /></button>}
      {hasText && (
        <button aria-label={formatMessage({ id: 'conversation.messageActions.copyMessage' })} className="chat-message-user-copy grid size-5 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-text-secondary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:text-text-secondary" onClick={() => void navigator.clipboard?.writeText(text)} title={formatMessage({ id: 'conversation.messageActions.copyMessage' })} type="button">
          <Copy aria-hidden="true" size={14} />
        </button>
      )}
    </footer>
  );
}

export function AssistantMessageFooter({ entryId, isLatest, isRunning, onFork, text, timestamp }: AssistantMessageFooterProps) {
  const { formatMessage } = useIntl();
  const time = formatMessageTime(timestamp);
  return (
    <footer aria-label={formatMessage({ id: 'conversation.messageActions.assistant' })} className={`chat-message-assistant-footer${isLatest ? ' is-latest' : ''}`} role="toolbar">
      <button aria-label={formatMessage({ id: 'conversation.messageActions.copyAssistant' })} className="chat-message-assistant-action grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-text-secondary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:text-text-secondary disabled:cursor-default disabled:opacity-45" onClick={() => void navigator.clipboard?.writeText(text)} title={formatMessage({ id: 'conversation.messageActions.copyMessage' })} type="button"><Copy aria-hidden="true" size={16} /></button>
      {entryId != null && !isRunning && <button aria-label={formatMessage({ id: 'conversation.messageActions.forkFromMessage' })} className="chat-message-assistant-action grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-text-secondary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:text-text-secondary disabled:cursor-default disabled:opacity-45" onClick={() => void onFork(entryId)} title={formatMessage({ id: 'conversation.messageActions.forkFromMessage' })} type="button"><GitFork aria-hidden="true" size={16} /></button>}
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
