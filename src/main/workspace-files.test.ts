import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listWorkspaceFiles, readWorkspaceFile, searchWorkspaceFiles } from './workspace-files';

const directories: string[] = [];

async function directory(name: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), `pi-desktop-${name}-`));
  directories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })));
});

describe('workspace files', () => {
  it('lists sorted direct children inside the workspace', async () => {
    const workspace = await directory('workspace');
    await mkdir(join(workspace, 'src'));
    await writeFile(join(workspace, 'README.md'), 'hello');

    await expect(listWorkspaceFiles(workspace, '')).resolves.toEqual([
      { isDirectory: true, isFile: false, name: 'src', path: 'src' },
      { isDirectory: false, isFile: true, name: 'README.md', path: 'README.md' },
    ]);
  });

  it('rejects traversal and a symlink that resolves outside the workspace', async () => {
    const workspace = await directory('workspace');
    const outside = await directory('outside');
    const outsideFile = join(outside, 'outside.txt');
    await writeFile(outsideFile, 'outside');

    await expect(readWorkspaceFile(workspace, '../outside.txt')).rejects.toThrow('工作区外');
    await symlink(outsideFile, join(workspace, 'outside-link'));
    await expect(readWorkspaceFile(workspace, 'outside-link')).rejects.toThrow('工作区外');
  });

  it('allows only an empty path to list the workspace root', async () => {
    const workspace = await directory('workspace');

    await expect(listWorkspaceFiles(workspace, '.')).rejects.toThrow('工作区外');
  });

  it('reads UTF-8 text but rejects binary and oversized files', async () => {
    const workspace = await directory('workspace');
    await writeFile(join(workspace, 'note.ts'), 'export const answer = 42;');
    await writeFile(join(workspace, 'binary.bin'), Buffer.from([0x00, 0xFF]));
    await writeFile(join(workspace, 'large.txt'), Buffer.alloc(1024 * 1024 + 1));

    await expect(readWorkspaceFile(workspace, 'note.ts')).resolves.toEqual({ path: 'note.ts', text: 'export const answer = 42;' });
    await expect(readWorkspaceFile(workspace, 'binary.bin')).rejects.toThrow('无法预览');
    await expect(readWorkspaceFile(workspace, 'large.txt')).rejects.toThrow('无法预览');
  });

  it('searches matching names case-insensitively and caps results', async () => {
    const workspace = await directory('workspace');
    await mkdir(join(workspace, 'src'));
    await writeFile(join(workspace, 'src', 'ReadMe.ts'), '');
    await Promise.all(Array.from({ length: 5001 }, (_, index) => writeFile(join(workspace, `match-${index}.ts`), '')));

    await expect(searchWorkspaceFiles(workspace, 'readme')).resolves.toEqual({
      entries: [{ isDirectory: false, isFile: true, name: 'ReadMe.ts', path: 'src/ReadMe.ts' }],
      truncated: false,
    });
    await expect(searchWorkspaceFiles(workspace, 'match-')).resolves.toMatchObject({ entries: expect.any(Array), truncated: true });
    await expect(searchWorkspaceFiles(workspace, 'match-')).resolves.toMatchObject({ entries: expect.arrayContaining([expect.objectContaining({ path: 'match-0.ts' })]) });
  });
});
