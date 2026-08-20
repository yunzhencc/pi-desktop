import { execFile } from 'node:child_process';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

export async function getWorkspaceGitBranch(path: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', path, 'branch', '--show-current'], { timeout: 1500 });
    return stdout.trim() || undefined;
  }
  catch {
    return undefined;
  }
}

export class WorkspaceRegistry {
  #snapshot: WorkspaceSnapshot = { pinnedSessionPaths: [], pinnedWorkspacePaths: [], workspaces: [] };

  constructor(private readonly path: string) {}

  async load(): Promise<WorkspaceSnapshot> {
    try {
      const stored = JSON.parse(await readFile(this.path, 'utf8')) as WorkspaceSnapshot;
      this.#snapshot = isWorkspaceSnapshot(stored)
        ? { ...stored, pinnedSessionPaths: stored.pinnedSessionPaths ?? [], pinnedWorkspacePaths: stored.pinnedWorkspacePaths ?? [] }
        : { pinnedSessionPaths: [], pinnedWorkspacePaths: [], workspaces: [] };
      if (this.#snapshot.selectedWorkspacePath && !(await isDirectory(this.#snapshot.selectedWorkspacePath)))
        this.#snapshot = { ...this.#snapshot, selectedWorkspacePath: undefined };
    }
    catch {
      this.#snapshot = { pinnedSessionPaths: [], pinnedWorkspacePaths: [], workspaces: [] };
    }
    return this.snapshot();
  }

  snapshot(): WorkspaceSnapshot {
    return { ...this.#snapshot, pinnedSessionPaths: [...this.#snapshot.pinnedSessionPaths], pinnedWorkspacePaths: [...this.#snapshot.pinnedWorkspacePaths], workspaces: [...this.#snapshot.workspaces] };
  }

  async select(path: string): Promise<WorkspaceSnapshot> {
    if (!(await isDirectory(path)))
      throw new Error('工作区不存在或不可访问');

    const existing = this.#snapshot.workspaces.find(workspace => workspace.path === path);
    const next = { displayName: existing?.displayName ?? (basename(path) || path), lastOpenedAt: new Date().toISOString(), path };
    this.#snapshot = {
      ...this.#snapshot,
      selectedWorkspacePath: path,
      workspaces: [next, ...this.#snapshot.workspaces.filter(workspace => workspace.path !== path)],
    };
    await this.#write();
    return this.snapshot();
  }

  async activate(path: string): Promise<WorkspaceSnapshot> {
    if (!(await isDirectory(path)))
      throw new Error('工作区不存在或不可访问');

    const existing = this.#snapshot.workspaces.find(workspace => workspace.path === path);
    const next = { displayName: existing?.displayName ?? (basename(path) || path), lastOpenedAt: new Date().toISOString(), path };
    this.#snapshot = {
      ...this.#snapshot,
      selectedWorkspacePath: path,
      workspaces: existing ? this.#snapshot.workspaces.map(workspace => workspace.path === path ? next : workspace) : [...this.#snapshot.workspaces, next],
    };
    await this.#write();
    return this.snapshot();
  }

  async create(path: string, displayName: string): Promise<WorkspaceSnapshot> {
    const name = displayName.trim() || basename(path) || path;
    if (!(await isDirectory(path)))
      throw new Error('工作区不存在或不可访问');

    this.#snapshot = {
      ...this.#snapshot,
      selectedWorkspacePath: path,
      workspaces: [{ displayName: name, lastOpenedAt: new Date().toISOString(), path }, ...this.#snapshot.workspaces.filter(workspace => workspace.path !== path)],
    };
    await this.#write();
    return this.snapshot();
  }

  async update(path: string, nextPath: string, displayName: string): Promise<WorkspaceSnapshot> {
    const current = this.#snapshot.workspaces.find(workspace => workspace.path === path);
    if (!current)
      throw new Error('工作区不存在');
    if (!(await isDirectory(nextPath)))
      throw new Error('工作区不存在或不可访问');
    if (nextPath !== path && this.#snapshot.workspaces.some(workspace => workspace.path === nextPath))
      throw new Error('该源文件夹已添加为项目');

    const next = { ...current, displayName: displayName.trim() || basename(nextPath) || nextPath, path: nextPath };
    this.#snapshot = {
      ...this.#snapshot,
      pinnedWorkspacePaths: this.#snapshot.pinnedWorkspacePaths.map(pinnedPath => pinnedPath === path ? nextPath : pinnedPath),
      selectedWorkspacePath: this.#snapshot.selectedWorkspacePath === path ? nextPath : this.#snapshot.selectedWorkspacePath,
      workspaces: this.#snapshot.workspaces.map(workspace => workspace.path === path ? next : workspace),
    };
    await this.#write();
    return this.snapshot();
  }

  async clear(): Promise<WorkspaceSnapshot> {
    if (!this.#snapshot.selectedWorkspacePath)
      return this.snapshot();

    this.#snapshot = { ...this.#snapshot, selectedWorkspacePath: undefined };
    await this.#write();
    return this.snapshot();
  }

  async setSessionPinned(sessionPath: string, pinned: boolean, beforeSessionPath?: string): Promise<WorkspaceSnapshot> {
    const paths = this.#snapshot.pinnedSessionPaths.filter(path => path !== sessionPath);
    if (pinned) {
      const beforeIndex = beforeSessionPath ? paths.indexOf(beforeSessionPath) : -1;
      beforeIndex < 0 ? paths.push(sessionPath) : paths.splice(beforeIndex, 0, sessionPath);
    }
    this.#snapshot = { ...this.#snapshot, pinnedSessionPaths: paths };
    await this.#write();
    return this.snapshot();
  }

  async setWorkspacePinned(workspacePath: string, pinned: boolean, beforeWorkspacePath?: string): Promise<WorkspaceSnapshot> {
    if (!this.#snapshot.workspaces.some(workspace => workspace.path === workspacePath))
      throw new Error('工作区不存在');
    const paths = this.#snapshot.pinnedWorkspacePaths.filter(path => path !== workspacePath);
    if (pinned) {
      const beforeIndex = beforeWorkspacePath ? paths.indexOf(beforeWorkspacePath) : -1;
      beforeIndex < 0 ? paths.push(workspacePath) : paths.splice(beforeIndex, 0, workspacePath);
    }
    this.#snapshot = { ...this.#snapshot, pinnedWorkspacePaths: paths };
    await this.#write();
    return this.snapshot();
  }

  async #write(): Promise<void> {
    const temporaryPath = join(dirname(this.path), `.${basename(this.path)}.tmp`);
    await writeFile(temporaryPath, JSON.stringify(this.#snapshot), { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.path);
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  }
  catch {
    return false;
  }
}

function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as WorkspaceSnapshot).workspaces))
    return false;
  const snapshot = value as WorkspaceSnapshot;
  return (snapshot.pinnedSessionPaths === undefined || (Array.isArray(snapshot.pinnedSessionPaths) && snapshot.pinnedSessionPaths.every(path => typeof path === 'string')))
    && (snapshot.pinnedWorkspacePaths === undefined || (Array.isArray(snapshot.pinnedWorkspacePaths) && snapshot.pinnedWorkspacePaths.every(path => typeof path === 'string')))
    && (snapshot.selectedWorkspacePath === undefined || typeof snapshot.selectedWorkspacePath === 'string')
    && snapshot.workspaces.every(workspace => typeof workspace?.path === 'string' && typeof workspace.displayName === 'string' && typeof workspace.lastOpenedAt === 'string');
}
