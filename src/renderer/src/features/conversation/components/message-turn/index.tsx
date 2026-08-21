import { Copy, GitFork, LoaderCircle, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

type ToolStatus = 'completed' | 'failed' | 'running';

interface ToolActivityProps {
  args?: unknown;
  name: string;
  output?: unknown;
  status: ToolStatus;
}

interface WorkedForProps {
  completedAtMs?: number;
  done?: boolean;
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
  const [expanded, setExpanded] = useState(false);
  const label = status === 'running' ? `正在使用工具 ${name}` : status === 'completed' ? `已完成工具 ${name}` : `工具 ${name} 执行失败`;
  const command = toolSummary(args);
  const result = toolText(output);
  const hasDetails = command != null || result != null;
  const isExpanded = status === 'running' || expanded;
  return (
    <div aria-label={label} aria-live={status === 'running' ? 'polite' : undefined} className="chat-tool-activity" role={status === 'running' ? 'status' : undefined}>
      <button aria-expanded={isExpanded} aria-label={`${isExpanded ? '隐藏' : '显示'}工具 ${name} 详情`} className="chat-tool-activity-header" disabled={!hasDetails || status === 'running'} onClick={() => setExpanded(value => !value)} type="button">
        {status === 'running' && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={16} />}
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

export function WorkedFor({ completedAtMs, done, startedAtMs, status }: WorkedForProps) {
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

export function UserMessageFooter({ canEdit, onEdit, text, timestamp }: UserMessageFooterProps) {
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

export function AssistantMessageFooter({ entryId, isLatest, isRunning, onFork, text, timestamp }: AssistantMessageFooterProps) {
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
