import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const desktopRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(desktopRoot, '..');

export default defineConfig({
  root: desktopRoot,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': repoRoot,
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    outDir: resolve(repoRoot, 'dist-desktop'),
    emptyOutDir: true,
    target: ['es2021', 'chrome105', 'safari13'],
  },
  clearScreen: false,
});
