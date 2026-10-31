import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: projectRoot,
  base: './',
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    fs: { allow: [resolve(projectRoot, '../..')] }
  },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, sourcemap: true }
});
