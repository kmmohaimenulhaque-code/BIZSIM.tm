import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(here, '../package.json'), 'utf8'));

export default defineConfig({
  root: here,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@shared': path.resolve(here, '../shared') } },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(here, '..')] },
    proxy: {
      '/api': 'http://localhost:8787',
      '/generated': 'http://localhost:8787',
    },
  },
  optimizeDeps: { exclude: ['onnxruntime-web', '@mintplex-labs/piper-tts-web'] },
  build: {
    outDir: path.resolve(here, 'dist'),
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Season content (150 seasons, 600 episodes) and the libraries ship as
        // their own cacheable chunks, loaded in parallel with the app.
        manualChunks(id) {
          if (id.includes('/shared/evidenceData')) return 'evidence';
          if (id.includes('/shared/seasons/') || id.includes('/shared/cases/') || id.includes('/shared/catalogue')) return 'seasons';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler') || id.includes('node_modules/react-router')) return 'react';
          return undefined;
        },
      },
    },
  },
});
