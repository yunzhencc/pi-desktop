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

    await expect(new WorkspaceRegistry(path).load()).resolves.toEqual({ workspaces: [] });
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
