import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  root: resolve(root, 'browser'),
  publicDir: resolve(root, 'public'),
  base: process.env.PAGES_BASE || '/adcrew/',
  resolve: { alias: {
    '@': resolve(root, 'src'),
    'next/link': resolve(root, 'browser/link.tsx'),
    'next/image': resolve(root, 'browser/image.tsx'),
    'node:sqlite': resolve(root, 'browser/sqlite.ts'),
    'node:crypto': resolve(root, 'browser/crypto.ts'),
  } },
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true },
});
