import type { WorkspaceFileContent, WorkspaceFileEntry, WorkspaceFileSearchResult } from '@shared/types';
import { isUtf8 } from 'node:buffer';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const MAX_PREVIEW_BYTES = 1024 * 1024;
const MAX_SEARCH_RESULTS = 5000;

export async function listWorkspaceFiles(workspacePath: string, relativePath: string): Promise<WorkspaceFileEntry[]> {
  const { path, root } = await resolveWorkspacePath(workspacePath, relativePath, true);
  const entries = await Promise.all((await readdir(path)).map(async (name) => {
    try {
      const childPath = relativePath ? `${relativePath}/${name}` : name;
      const child = await resolveWorkspacePath(root, childPath);
      return await workspaceFileEntry(child.path, childPath);
    }
    catch {
      return undefined;
    }
  }));

  return entries.filter((entry): entry is WorkspaceFileEntry => entry !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function readWorkspaceFile(workspacePath: string, relativePath: string): Promise<WorkspaceFileContent> {
  const { path } = await resolveWorkspacePath(workspacePath, relativePath);
  const fileStat = await stat(path);
  if (!fileStat.isFile() || fileStat.size > MAX_PREVIEW_BYTES)
    throw new TypeError('无法预览该文件');

  const bytes = await readFile(path);
  if (!isUtf8(bytes))
    throw new TypeError('无法预览非 UTF-8 文件');

  return { path: toRendererPath(relativePath), text: bytes.toString('utf8') };
}

export async function searchWorkspaceFiles(workspacePath: string, query: string): Promise<WorkspaceFileSearchResult> {
  const { path: root } = await resolveWorkspacePath(workspacePath, '', true);
  const entries: WorkspaceFileEntry[] = [];
  const search = query.toLowerCase();
  const visitedDirectories = new Set<string>();
  let truncated = false;

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    if (visitedDirectories.has(directory))
      return;
    visitedDirectories.add(directory);

    const names = await readdir(directory);
    for (const name of names.sort((left, right) => left.localeCompare(right))) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      let child: { path: string };
      let entry: WorkspaceFileEntry;
      try {
        child = await resolveWorkspacePath(root, relativePath);
        entry = await workspaceFileEntry(child.path, relativePath);
      }
      catch {
        continue;
      }

      if (entry.name.toLowerCase().includes(search)) {
        if (entries.length === MAX_SEARCH_RESULTS) {
          truncated = true;
          return;
        }
        entries.push(entry);
      }
      if (entry.isDirectory)
        await visit(child.path, relativePath);
      if (truncated)
        return;
    }
  }

  await visit(root, '');
  return { entries, truncated };
}

async function resolveWorkspacePath(workspacePath: string, relativePath: string, allowRoot = false): Promise<{ path: string; root: string }> {
  if (!allowRoot && !relativePath)
    throw new TypeError('工作区外路径不可访问');
  if (isAbsolute(relativePath) || relativePath.includes('\\') || (relativePath !== '' && relativePath.split('/').some(part => !part || part === '.' || part === '..')))
    throw new TypeError('工作区外路径不可访问');

  const root = await realpath(workspacePath);
  if (!(await stat(root)).isDirectory())
    throw new TypeError('工作区不存在或不可访问');

  const path = await realpath(resolve(root, relativePath));
  const pathRelativeToRoot = relative(root, path);
  if ((pathRelativeToRoot === '' && !allowRoot) || pathRelativeToRoot === '..' || pathRelativeToRoot.startsWith(`..${sep}`) || isAbsolute(pathRelativeToRoot))
    throw new TypeError('工作区外路径不可访问');

  return { path, root };
}

async function workspaceFileEntry(path: string, relativePath: string): Promise<WorkspaceFileEntry> {
  const fileStat = await stat(path);
  return {
    isDirectory: fileStat.isDirectory(),
    isFile: fileStat.isFile(),
    name: relativePath.split('/').at(-1)!,
    path: toRendererPath(relativePath),
  };
}

function toRendererPath(path: string): string {
  return path.split(sep).join('/');
}
