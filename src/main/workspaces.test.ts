import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { getWorkspaceGitBranch, WorkspaceRegistry } from './workspaces';

const directories: string[] = [];
const execFileAsync = promisify(execFile);

async function registryPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'pi-desktop-workspaces-'));
  directories.push(directory);
  return join(directory, 'workspaces.json');
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { force: true, recursive: true })));
});

describe('workspace registry', () => {
  it('starts empty when no registry exists or its JSON is corrupt', async () => {
    const path = await registryPath();
    await writeFile(path, '{invalid');

    await expect(new WorkspaceRegistry(path).load()).resolves.toEqual({ pinnedSessionPaths: [], pinnedWorkspacePaths: [], workspaces: [] });
  });

  it('persists the selected directory as a recent workspace', async () => {
    const path = await registryPath();
    const project = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    directories.push(project);
    await mkdir(project);
    const registry = new WorkspaceRegistry(path);

    await registry.load();
    const selected = await registry.select(project);

    expect(selected.selectedWorkspacePath).toBe(project);
    expect(selected.workspaces).toEqual([
      expect.objectContaining({ displayName: project.split('/').at(-1), path: project }),
    ]);
    await expect(new WorkspaceRegistry(path).load()).resolves.toEqual(selected);
  });

  it('keeps the project name supplied when a directory is created as a project', async () => {
    const path = await registryPath();
    const project = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    directories.push(project);
    await mkdir(project);
    const registry = new WorkspaceRegistry(path);

    await registry.load();
    await registry.create(project, '天气助手');
    await registry.select(project);

    expect(registry.snapshot().workspaces[0]).toMatchObject({ displayName: '天气助手', path: project });
  });

  it('uses the directory name when a project is created without a name', async () => {
    const path = await registryPath();
    const project = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    directories.push(project);
    await mkdir(project);
    const registry = new WorkspaceRegistry(path);

    await registry.load();
    await registry.create(project, '  ');

    expect(registry.snapshot().workspaces[0]).toMatchObject({ displayName: project.split('/').at(-1), path: project });
  });

  it('updates a project source folder while preserving its selection and pin', async () => {
    const path = await registryPath();
    const original = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    const replacement = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    directories.push(original, replacement);
    await Promise.all([mkdir(original), mkdir(replacement)]);
    const registry = new WorkspaceRegistry(path);

    await registry.load();
    await registry.create(original, '旧项目');
    await registry.setWorkspacePinned(original, true);
    const updated = await registry.update(original, replacement, '新项目');

    expect(updated).toMatchObject({ pinnedWorkspacePaths: [replacement], selectedWorkspacePath: replacement });
    expect(updated.workspaces).toEqual([expect.objectContaining({ displayName: '新项目', path: replacement })]);
    await expect(new WorkspaceRegistry(path).load()).resolves.toEqual(updated);
  });

  it('clears the selected project but keeps it in recents', async () => {
    const path = await registryPath();
    const project = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    directories.push(project);
    await mkdir(project);
    const registry = new WorkspaceRegistry(path);

    await registry.load();
    await registry.select(project);
    const cleared = await registry.clear();

    expect(cleared).toEqual({
      pinnedSessionPaths: [],
      pinnedWorkspacePaths: [],
      workspaces: [expect.objectContaining({ path: project })],
    });
    await expect(new WorkspaceRegistry(path).load()).resolves.toEqual(cleared);
  });

  it('persists pinned sessions in their requested order', async () => {
    const path = await registryPath();
    const project = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    directories.push(project);
    await mkdir(project);
    const registry = new WorkspaceRegistry(path);
    const first = '/sessions/first.jsonl';
    const second = '/sessions/second.jsonl';

    await registry.load();
    await registry.select(project);
    await registry.setSessionPinned(first, true);
    await registry.setSessionPinned(second, true, first);

    expect(registry.snapshot().pinnedSessionPaths).toEqual([second, first]);
    await registry.setSessionPinned(second, false);
    await expect(new WorkspaceRegistry(path).load()).resolves.toMatchObject({ pinnedSessionPaths: [first] });
  });

  it('persists pinned projects in their requested order', async () => {
    const path = await registryPath();
    const first = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    const second = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    directories.push(first, second);
    await Promise.all([mkdir(first), mkdir(second)]);
    const registry = new WorkspaceRegistry(path);

    await registry.load();
    await registry.create(first, 'first');
    await registry.create(second, 'second');
    await registry.setWorkspacePinned(first, true);
    await registry.setWorkspacePinned(second, true, first);

    expect(registry.snapshot().pinnedWorkspacePaths).toEqual([second, first]);
    await registry.setWorkspacePinned(second, false);
    await expect(new WorkspaceRegistry(path).load()).resolves.toMatchObject({ pinnedWorkspacePaths: [first] });
  });

  it('rejects a path that is not an existing directory', async () => {
    const registry = new WorkspaceRegistry(await registryPath());
    await registry.load();

    await expect(registry.select(join(tmpdir(), 'pi-desktop-missing-workspace'))).rejects.toThrow('工作区不存在或不可访问');
  });

  it('reads the selected workspace Git branch', async () => {
    const project = join(tmpdir(), `pi-desktop-project-${crypto.randomUUID()}`);
    directories.push(project);
    await mkdir(project);
    await execFileAsync('git', ['init', '--initial-branch=main', project]);

    await expect(getWorkspaceGitBranch(project)).resolves.toBe('main');
  });
});
