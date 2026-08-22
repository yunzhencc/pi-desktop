import { resolve } from 'node:path';
import formatjs from '@formatjs/unplugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [
      tanstackRouter({
        generatedRouteTree: './src/routeTree.gen.ts',
        routesDirectory: './src/pages',
        target: 'react',
      }),
      codeInspectorPlugin({
        bundler: 'vite',
        editor: 'code',
      }),
      react(),
      tailwindcss(),
      formatjs({
        idInterpolationPattern: '[sha512:contenthash:base64:6]',
        ast: true,
      }),
    ],
    server: {
      port: 8200,
      strictPort: true,
    },
  },
});
