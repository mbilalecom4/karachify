import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Only the hosts this app actually loads from: bundled assets, Wikimedia images,
 * OpenStreetMap tiles, Google Fonts and the two live reads behind the "today"
 * panel (weather and calculated prayer times). Links a visitor clicks are
 * navigations, not fetches, so they need no entry. GitHub Pages cannot send
 * response headers, so the policy has to travel in the document — and only in a
 * production build, because the dev server serves inline scripts and a websocket
 * for hot reload.
 */
const CSP =
  "default-src 'self'; script-src 'self'; " +
  "worker-src 'self' blob:; child-src 'self' blob:; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' data: https://fonts.gstatic.com; " +
  "img-src 'self' data: blob: https://thumb.wikimedia.org https://upload.wikimedia.org https://tile.openstreetmap.org; " +
  "connect-src 'self' https://tile.openstreetmap.org https://api.open-meteo.com https://api.aladhan.com; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'";

function contentSecurityPolicy(): Plugin {
  return {
    name: 'karachify-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

// GitHub Pages serves the site under /<repo-name>/, so production builds need that base.
// Set KARACHIFY_BASE to your repository name before `npm run build`.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${process.env.KARACHIFY_BASE || 'karachify'}/` : '/',
  plugins: [react(), contentSecurityPolicy()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 900,
  },
}));
