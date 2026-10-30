import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serves the site under /<repo-name>/, so production builds need that base.
// Set KARACHIFY_BASE to your repository name before `npm run build`.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${process.env.KARACHIFY_BASE || 'karachify'}/` : '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 900,
  },
}));
