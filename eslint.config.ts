import antfu from '@antfu/eslint-config';
import pluginPnpm from 'eslint-plugin-pnpm';

export default antfu(
  {
    stylistic: {
      semi: true,
      indent: 2,
      quotes: 'single',
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
    react: true,
    typescript: true,
    ignores: [
      'packages/shadcn-ui/src',
      'src/renderer/src/routeTree.gen.ts',
      'local-conversation-page-*.js',
      'thread-app-shell-chrome-*.js',
    ],
  },
  {
    files: ['package.json'],
    plugins: { pnpm: pluginPnpm },
    rules: {
      'pnpm/json-enforce-catalog': [
        'error',
        { ignores: ['@types/vscode', 'electron-updater'] },
      ],
    },
  },
);
