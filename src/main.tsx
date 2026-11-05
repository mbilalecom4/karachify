import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import App from './App';
import './index.css';

/**
 * BrowserRouter, not HashRouter — a place's URL should read as `/place/…`, and
 * a social card or a search result can only be pointed at a path that a server
 * can actually answer.
 *
 * Two things make that work on a static host, and both are build-time, not
 * runtime: `.tools/prerender.mjs` writes a real `<path>/index.html` for every
 * indexable page, so those arrive with a 200 and their own head, and GitHub
 * Pages falls back to `404.html` for anything else — which is the same shell,
 * so a deep link to an OpenStreetMap record still opens even though the status
 * line says otherwise.
 *
 * The basename is Vite's BASE_URL — the `/karachify/` the site is published
 * under, with the trailing slash dropped so a joined href never reads
 * `//place`. In dev BASE_URL is `/` and the basename goes back to `/`.
 */
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

/*
 * The offline layer, and only in a built site. A dev server that hot-swaps
 * modules and a worker holding the previous build open each other's work, so
 * registration waits for production. The URL is Vite's BASE_URL with the
 * trailing slash it already carries, which puts the worker at the root of the
 * published site — `/karachify/sw.js` — because a worker's scope is the
 * directory it is served from and it cannot reach above it.
 *
 * Failing to register is not a failure of the visit: the site still loads the
 * way it did before the worker existed, so this says so in the console and
 * leaves the page alone.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn('Offline support is off for this visit: the service worker did not register.', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
