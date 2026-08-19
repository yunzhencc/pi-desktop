import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export interface WorkspaceSummary {
  displayName: string;
  lastOpenedAt: string;
  path: string;
}

export interface WorkspaceSnapshot {
  selectedWorkspacePath?: string;
  workspaces: WorkspaceSummary[];
}

export class WorkspaceRegistry {
  #snapshot: WorkspaceSnapshot = { workspaces: [] };

  constructor(private readonly path: string) {}

  async load(): Promise<WorkspaceSnapshot> {
    try {
      const stored = JSON.parse(await readFile(this.path, 'utf8')) as WorkspaceSnapshot;
      this.#snapshot = isWorkspaceSnapshot(stored) ? stored : { workspaces: [] };
      if (this.#snapshot.selectedWorkspacePath && !(await isDirectory(this.#snapshot.selectedWorkspacePath)))
        this.#snapshot = { ...this.#snapshot, selectedWorkspacePath: undefined };
    }
    catch {
      this.#snapshot = { workspaces: [] };
    }
    return this.snapshot();
  }

  snapshot(): WorkspaceSnapshot {
    return { ...this.#snapshot, workspaces: [...this.#snapshot.workspaces] };
  }

  async select(path: string): Promise<WorkspaceSnapshot> {
    if (!(await isDirectory(path)))
      throw new Error('工作区不存在或不可访问');

    const existing = this.#snapshot.workspaces.find(workspace => workspace.path === path);
    const next = { displayName: existing?.displayName ?? (basename(path) || path), lastOpenedAt: new Date().toISOString(), path };
    this.#snapshot = {
      selectedWorkspacePath: path,
      workspaces: [next, ...this.#snapshot.workspaces.filter(workspace => workspace.path !== path)],
    };
    await this.#write();
    return this.snapshot();
  }

  async create(path: string, displayName: string): Promise<WorkspaceSnapshot> {
    const name = displayName.trim();
    if (!name)
      throw new Error('项目名称不能为空');
    if (!(await isDirectory(path)))
      throw new Error('工作区不存在或不可访问');

    this.#snapshot = {
      selectedWorkspacePath: path,
      workspaces: [{ displayName: name, lastOpenedAt: new Date().toISOString(), path }, ...this.#snapshot.workspaces.filter(workspace => workspace.path !== path)],
    };
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
  return (snapshot.selectedWorkspacePath === undefined || typeof snapshot.selectedWorkspacePath === 'string')
    && snapshot.workspaces.every(workspace => typeof workspace?.path === 'string' && typeof workspace.displayName === 'string' && typeof workspace.lastOpenedAt === 'string');
}
