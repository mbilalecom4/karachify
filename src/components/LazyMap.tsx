import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { MapPoint } from './KarachifyMap';

const Map = lazy(() => import('./KarachifyMap').then((m) => ({ default: m.KarachifyMap })));

/**
 * Mounts the map when it is about to scroll into view. The MapLibre bundle is
 * ~220 kB gzipped and a place page is usually read for its address, so a reader
 * who never reaches the map should not download it.
 */
export function LazyMap({
  points,
  activeId,
  onSelect,
  interactive = true,
  className = 'h-[520px] w-full',
  compact = false,
}: {
  points: MapPoint[];
  activeId?: string | null;
  onSelect?: (p: MapPoint) => void;
  interactive?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!show) {
    return (
      <div
        ref={host}
        className={`grid place-items-center rounded-xl2 border border-navy-100 bg-navy-50/60 text-[13px] text-navy-400 ${className}`}
      >
        Map loads when it scrolls into view
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className={`grid place-items-center rounded-xl2 border border-navy-100 bg-navy-50/60 text-[13px] text-navy-400 ${className}`}>
          Loading map…
        </div>
      }
    >
      <Map points={points} activeId={activeId} onSelect={onSelect} interactive={interactive} compact={compact} className={className} />
    </Suspense>
  );
}
