import { BookOpen, ChevronDown, CircleAlert, Copy, FilePenLine, GitFork, LoaderCircle, Pencil, Terminal, Wrench } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
  const label = status === 'running' ? `正在使用工具 ${name}` : status === 'completed' ? `已完成工具 ${name}` : `工具 ${name} 执行失败`;
  const command = toolSummary(args);
  const result = toolText(output);
  const hasDetails = command != null || result != null;
  const isExpanded = status === 'running' || expanded;
  return (
    <div aria-label={label} aria-live={status === 'running' ? 'polite' : undefined} className="chat-tool-activity w-[min(100%,44rem)]" role={status === 'running' ? 'status' : undefined}>
      <button aria-expanded={isExpanded} aria-label={`${isExpanded ? '隐藏' : '显示'}工具 ${name} 详情`} className="chat-tool-activity-header flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-inherit disabled:cursor-default [&>span:last-child]:ml-auto" disabled={!hasDetails || status === 'running'} onClick={() => setExpanded(value => !value)} type="button">
        {status === 'running' && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={16} />}
        <span>
          {label}
          {status === 'running' ? '…' : ''}
        </span>
        {hasDetails && status !== 'running' && <span aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span>}
      </button>
      {isExpanded && hasDetails && (
        <div className="chat-tool-activity-details mt-1.5 ml-6 grid gap-2 overflow-auto rounded-lg border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-2.5 py-2 font-mono text-xs leading-normal text-text-secondary [&_code]:m-0 [&_code]:whitespace-pre-wrap [&_pre]:m-0 [&_pre]:whitespace-pre-wrap">
          {command != null && <code>{command}</code>}
          {result != null && <pre>{result}</pre>}
        </div>
      )}
    </div>
  );
}

export function ActivitySummary({ args, name, output, status }: ToolActivityProps) {
  const [expanded, setExpanded] = useState(false);
  const command = toolSummary(args);
  const result = toolText(output);
  const hasDetails = command != null || result != null;
  const isExpanded = status === 'running' || expanded;
  const label = activitySummaryLabel(name, status);

  return (
    <div aria-label={label} aria-live={status === 'running' ? 'polite' : undefined} className="chat-activity-summary-item" role={status === 'running' ? 'status' : undefined}>
      <button aria-expanded={isExpanded} aria-label={`${isExpanded ? '隐藏' : '显示'}工具 ${name} 详情`} className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-[13px] leading-5 text-text-tertiary disabled:cursor-default" disabled={!hasDetails || status === 'running'} onClick={() => setExpanded(value => !value)} type="button">
        <ActivityIcon name={name} status={status} />
        <span>
          {label}
          {status === 'running' ? '…' : ''}
        </span>
        {hasDetails && status !== 'running' && <ChevronDown aria-hidden="true" className={`ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={14} />}
      </button>
      {isExpanded && hasDetails && (
        <div className="chat-tool-activity-details mt-1.5 ml-6 grid gap-2 overflow-auto rounded-lg border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-2.5 py-2 font-mono text-xs leading-normal text-text-secondary [&_code]:m-0 [&_code]:whitespace-pre-wrap [&_pre]:m-0 [&_pre]:whitespace-pre-wrap">
          {command != null && <code>{command}</code>}
          {result != null && <pre>{result}</pre>}
        </div>
      )}
    </div>
  );
}

function activitySummaryLabel(name: string, status: ToolStatus): string {
  const isCommand = name === 'bash' || name === 'exec';
  const isRead = name === 'read';
  const isEdit = name === 'edit' || name === 'patch' || name === 'write';
  if (status === 'running')
    return isCommand ? '正在运行命令' : isRead ? '正在读取文件' : isEdit ? '正在编辑文件' : `正在使用工具 ${name}`;
  if (status === 'failed')
    return isCommand ? '命令执行失败' : isRead ? '读取文件失败' : isEdit ? '编辑文件失败' : `工具 ${name} 执行失败`;
  return isCommand ? '运行了命令' : isRead ? '已读取文件' : isEdit ? '编辑了文件' : `已使用工具 ${name}`;
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

export function WorkedFor({ completedAtMs, done, expanded, onToggle, startedAtMs, status }: WorkedForProps) {
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
    <div className="chat-worked-for flex w-full flex-col gap-2 text-[13px] leading-5 text-text-tertiary" data-duration-divider>
      {onToggle == null
        ? (
            <p className="m-0 flex items-center gap-2">
              {!done && completedAtMs == null && <span aria-hidden="true" className="chat-worked-for-dot" />}
              {label}
            </p>
          )
        : (
            <button aria-expanded={expanded} aria-label={`${expanded ? '收起' : '展开'}工具活动`} className="flex w-fit cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-inherit" onClick={onToggle} type="button">
              {!done && completedAtMs == null && <span aria-hidden="true" className="chat-worked-for-dot" />}
              <span>{label}</span>
              <ChevronDown aria-hidden="true" className={expanded ? 'rotate-180' : ''} size={15} />
            </button>
          )}
      <div aria-hidden="true" className="chat-worked-for-rule w-full border-t border-border-subtle" />
    </div>
  );
}

export function UserMessageFooter({ canEdit, onEdit, text, timestamp }: UserMessageFooterProps) {
  const time = formatMessageTime(timestamp);
  const hasText = text.trim().length > 0;

  return (
    <footer className="chat-message-user-footer">
      {time != null && <time dateTime={new Date(timestamp!).toISOString()}>{time}</time>}
      {canEdit && <button aria-label="Edit message" className="chat-message-user-copy grid size-5 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-text-secondary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:text-text-secondary" onClick={onEdit} title="Edit message" type="button"><Pencil aria-hidden="true" size={14} /></button>}
      {hasText && (
        <button aria-label="Copy message" className="chat-message-user-copy grid size-5 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-text-secondary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:text-text-secondary" onClick={() => void navigator.clipboard?.writeText(text)} title="Copy message" type="button">
          <Copy aria-hidden="true" size={14} />
        </button>
      )}
    </footer>
  );
}

export function AssistantMessageFooter({ entryId, isLatest, isRunning, onFork, text, timestamp }: AssistantMessageFooterProps) {
  const time = formatMessageTime(timestamp);
  return (
    <footer className={`chat-message-assistant-footer${isLatest ? ' is-latest' : ''}`}>
      <button aria-label="Copy assistant message" className="chat-message-assistant-action grid size-5 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-text-secondary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:text-text-secondary disabled:cursor-default disabled:opacity-45" onClick={() => void navigator.clipboard?.writeText(text)} title="Copy message" type="button"><Copy aria-hidden="true" size={18} /></button>
      {entryId != null && !isRunning && <button aria-label="Fork conversation from this message" className="chat-message-assistant-action grid size-5 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-text-secondary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:text-text-secondary disabled:cursor-default disabled:opacity-45" onClick={() => void onFork(entryId)} title="Fork conversation" type="button"><GitFork aria-hidden="true" size={18} /></button>}
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
