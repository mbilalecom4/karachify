import { useEffect, type MouseEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { applyPageMeta, metaForPath } from '../lib/pageMeta';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileTabBar } from './MobileTabBar';

function ScrollManager() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search, hash]);
  return null;
}

/**
 * Keeps the document head in step with the page a visitor is on.
 *
 * `.tools/prerender.mjs` writes the same tags into the files a crawler receives,
 * so the two only agree if both read `src/lib/pageMeta.ts`. Paths this module
 * declines to describe — an account screen, an unknown slug, an OpenStreetMap
 * record whose name lives in a tier file rather than the bundle — are left
 * exactly as they were served, because a description invented to fill a gap is
 * the thing this site promises not to do.
 */
function MetaManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metaForPath(pathname);
    if (meta) applyPageMeta(meta);
  }, [pathname]);
  return null;
}

export function Layout() {
  // The href is a real anchor now that routes are paths: with JavaScript off the
  // browser still jumps. The handler exists for what a jump alone does not do —
  // move the focus, so the keys that follow land inside the page, not back on
  // the header.
  const skipToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.getElementById('main');
    main?.focus();
    main?.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="flex min-h-screen flex-col pb-[64px] lg:pb-0">
      <ScrollManager />
      <MetaManager />
      <a
        href="#main"
        onClick={skipToContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-navy-900 focus:px-4 focus:py-3 focus:text-[14px] focus:font-semibold focus:text-white focus:shadow-lift"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}
