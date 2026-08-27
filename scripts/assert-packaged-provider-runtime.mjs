import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const appPath = join(process.cwd(), 'dist', 'mac-arm64', 'pi-desktop.app');
const executable = join(appPath, 'Contents', 'MacOS', 'pi-desktop');
const runtimeEntry = join(appPath, 'Contents', 'Resources', 'app.asar', 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'index.js');

if (!existsSync(executable))
  throw new Error('未找到 macOS unpacked 安装包，请先运行 pnpm build:unpack。');

execFileSync(executable, ['-e', `import(${JSON.stringify(pathToFileURL(runtimeEntry).href)})`], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit',
});
