export interface WorkspaceSummary {
  displayName: string;
  lastOpenedAt: string;
  path: string;
}

export interface WorkspaceSnapshot {
  pinnedSessionPaths: string[];
  pinnedWorkspacePaths: string[];
  selectedWorkspacePath?: string;
  workspaces: WorkspaceSummary[];
}
