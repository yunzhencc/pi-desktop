export interface Message {
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

type SessionMessage
  = | { completedAtMs?: number; role: 'work'; startedAtMs?: number; status?: 'stopped' | 'worked' }
    | { args?: unknown; output?: unknown; role: 'tool'; status: 'completed' | 'failed' | 'running'; toolCallId: string; toolName: string }
    | { entryId?: string; role: 'assistant' | 'user'; text: string; timestamp?: number };

export interface PiSessionSnapshot {
  messages: SessionMessage[];
}

interface AssistantSnapshot {
  done: boolean;
  entryId?: string;
  text: string;
  timestamp?: number;
}

interface ToolSnapshot {
  args?: unknown;
  output?: unknown;
  status: 'completed' | 'failed' | 'running';
  toolCallId: string;
  toolName: string;
}

type ComposerUpdate
  = | ({ type: 'assistant' } & AssistantSnapshot)
    | ({ type: 'error'; text: string })
    | ({ completedAtMs?: number; startedAtMs?: number; status: 'running' | 'settled'; type: 'status'; workStatus?: Message['workStatus'] })
    | ({ type: 'tool' } & ToolSnapshot)
    | { type: 'session' };

export function restoreSessionMessages(session: PiSessionSnapshot): Message[] {
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
  return restored;
}

export function appendSubmittedUserMessage(current: Message[], text: string, now = Date.now()): Message[] {
  return [...current, { id: now, role: 'user', startedAtMs: now, text, timestamp: now }];
}

export function appendRunningWork(current: Message[], startedAtMs = Date.now()): Message[] {
  return current.some(message => message.role === 'work' && !message.done)
    ? current
    : [...current, { done: false, id: startedAtMs, role: 'work', startedAtMs, text: '' }];
}

export function settleRunningWork(current: Message[], completedAtMs = Date.now(), workStatus: Message['workStatus'] = 'worked'): Message[] {
  const workIndex = current.findLastIndex(message => message.role === 'work' && !message.done);
  return workIndex < 0
    ? current
    : [...current.slice(0, workIndex), { ...current[workIndex]!, completedAtMs, done: true, workStatus }, ...current.slice(workIndex + 1)];
}

export function appendErrorMessage(current: Message[], text: string, now = Date.now()): Message[] {
  return [...current, { id: now, role: 'error', text }];
}

export function applyComposerUpdate(current: Message[], update: ComposerUpdate, now = Date.now()): Message[] {
  if (update.type === 'status') {
    return update.status === 'running'
      ? appendRunningWork(current, update.startedAtMs ?? now)
      : settleRunningWork(current, update.completedAtMs ?? now, update.workStatus ?? 'worked');
  }
  if (update.type === 'error')
    return appendErrorMessage(current, update.text, now);
  if (update.type === 'tool')
    return upsertToolActivity(current, update, now);
  if (update.type === 'assistant' && update.done)
    return appendAssistantMessage(current, update, now);
  return current;
}

export function upsertToolActivity(current: Message[], update: ToolSnapshot, now = Date.now()): Message[] {
  const index = current.findLastIndex(message => message.role === 'activity' && message.toolCallId === update.toolCallId);
  const message: Message = {
    done: update.status !== 'running',
    id: index < 0 ? now : current[index]!.id,
    role: 'activity',
    text: update.toolName,
    toolArgs: update.args ?? (index < 0 ? undefined : current[index]!.toolArgs),
    toolCallId: update.toolCallId,
    toolName: update.toolName,
    toolOutput: update.output ?? (index < 0 ? undefined : current[index]!.toolOutput),
    toolStatus: update.status,
  };
  return index < 0 ? [...current, message] : [...current.slice(0, index), message, ...current.slice(index + 1)];
}

export function appendAssistantMessage(current: Message[], update: AssistantSnapshot, now = Date.now()): Message[] {
  const latestUserStartedAtMs = current.findLast(message => message.role === 'user')?.startedAtMs;
  const withWork = current.some(message => message.role === 'work' && !message.done) || latestUserStartedAtMs == null
    ? current
    : [...current, { completedAtMs: update.done ? update.timestamp ?? now : undefined, done: update.done, id: -now, role: 'work' as const, startedAtMs: latestUserStartedAtMs, text: '', workStatus: update.done ? 'worked' as const : undefined }];
  const last = withWork.at(-1);
  const message = { done: update.done, entryId: update.entryId, id: last?.role === 'assistant' ? last.id : now, role: 'assistant' as const, text: update.text, timestamp: update.timestamp };
  return last?.role === 'assistant' && !last.done ? [...withWork.slice(0, -1), message] : [...withWork, message];
}

export function updateUserMessageText(current: Message[], id: number, text: string): Message[] {
  const index = current.findIndex(currentMessage => currentMessage.id === id);
  return index < 0 ? current : [...current.slice(0, index), { ...current[index]!, text }, ...current.slice(index + 1)];
}
