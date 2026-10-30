import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import App from './App';
import './index.css';

/**
 * HashRouter is deliberate: the site is deployed as a static bundle (GitHub
 * Pages) and hash routing keeps deep links like #/place/mazar-e-quaid working
 * without server rewrites.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </HashRouter>
  </StrictMode>
);
