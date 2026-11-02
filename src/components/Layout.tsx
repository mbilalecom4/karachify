import { useEffect, type MouseEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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

export function Layout() {
  // The href is there for semantics, but a bare "#main" would be read by
  // HashRouter as a route and send the visitor to a 404 — so the click moves
  // focus itself and the router never sees the hash change.
  const skipToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.getElementById('main');
    main?.focus();
    main?.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="flex min-h-screen flex-col pb-[64px] lg:pb-0">
      <ScrollManager />
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
