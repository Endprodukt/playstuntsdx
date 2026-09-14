import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(root, 'desktop'),
  publicDir: path.join(root, 'public'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': root,
      'next/image': path.join(root, 'desktop/next-image.tsx'),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: {
      // Visual Studio keeps its search/index database locked while the IDE is
      // running. Vite must never try to watch those files on Windows.
      ignored: [
        '**/.vs/**',
        '**/.git/**',
        '**/.venv/**',
        '**/node_modules/**',
        '**/src-tauri/**',
        '**/dist-desktop/**',
      ],
    },
  },
  build: {
    outDir: path.join(root, 'dist-desktop'),
    emptyOutDir: true,
  },
});
