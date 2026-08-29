export interface WorkspaceSummary {
  displayName: string;
  lastOpenedAt: string;
  path: string;
}

export interface WorkspaceFileEntry {
  isDirectory: boolean;
  isFile: boolean;
  name: string;
  path: string;
}

export interface WorkspaceFileContent {
  path: string;
  text: string;
}

export interface WorkspaceFileSearchResult {
  entries: WorkspaceFileEntry[];
  truncated: boolean;
}

export interface WorkspaceSnapshot {
  pinnedSessionPaths: string[];
  pinnedWorkspacePaths: string[];
  selectedWorkspacePath?: string;
  workspaces: WorkspaceSummary[];
}

export type AppUpdateState = 'idle' | 'checking' | 'downloading' | 'ready' | 'installing';

export interface AppUpdateSnapshot {
  downloadProgressPercent?: number;
  state: AppUpdateState;
}

export type AttachmentKind = 'file' | 'image' | 'pdf' | 'text';

export interface AttachmentMetadata {
  id: string;
  kind: AttachmentKind;
  name: string;
  size: number;
  previewDataUrl?: string;
}

export interface AttachmentFailure {
  name: string;
  reason: string;
}

export type PiWorkStatus = 'stopped' | 'worked';

export type TranscriptUpdate
  = | { done?: boolean; entryId?: string; text: string; timestamp?: number; type: 'assistant' }
    | { text: string; type: 'error' }
    | { sessionPath: string; type: 'session' }
    | { entryId: string; type: 'user' }
    | { completedAtMs?: number; sessionPath?: string; startedAtMs?: number; status: 'running' | 'settled'; type: 'status'; workStatus?: PiWorkStatus }
    | { args?: unknown; output?: unknown; sessionPath?: string; status: 'completed' | 'failed' | 'running'; toolCallId: string; toolName: string; type: 'tool' };

export interface PiSessionSummary {
  firstMessage: string;
  id: string;
  modifiedAt: string;
  path: string;
}

export interface PiUsageStats {
  currentStreakDays: number;
  days: Array<{ iso: string; tokens: number }>;
  lifetimeTokens: number;
  longestChatMs?: number;
  longestStreakDays: number;
  peakTokens: number;
}

export interface PiSessionSnapshot {
  bookmarkedUserEntryIds?: string[];
  messages: Array<
    | { entryId: string; role: 'assistant' | 'user'; text: string; timestamp: number }
    | { args?: unknown; output?: unknown; role: 'tool'; status: 'completed' | 'failed' | 'running'; toolCallId: string; toolName: string }
    | { completedAtMs: number; role: 'work'; startedAtMs: number; status: PiWorkStatus }
  >;
  path: string;
}

export * from './provider';
