import { useEffect, useMemo, useRef, useState } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { city } from '../data/taxonomy';

export interface MapPoint {
  id: string;
  title: string;
  subtitle: string;
  /** HashRouter path, e.g. /place/mazar-e-quaid */
  path: string;
  lat: number;
  lng: number;
  color?: string;
  kind?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const osmStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      // Public OSM raster tiles are fine for this offline demo; a production
      // deployment must switch to a self-hosted or commercial tile provider.
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#E8EEF3' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
};

/**
 * MapLibre map of Karachi used by the Explore Map page and the homepage
 * preview. Demo coordinates are approximate, so the UI always says so.
 */
export function KarachifyMap({
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
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const ready = useRef(false);
  const [tilesOffline, setTilesOffline] = useState(false);

  const signature = useMemo(() => points.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.color ?? ''}`).join('|'), [points]);

  useEffect(() => {
    if (!host.current || map.current) return;
    const m = new maplibregl.Map({
      container: host.current,
      style: osmStyle,
      center: [city.lng, city.lat],
      zoom: compact ? 10.4 : 10.8,
      minZoom: 8,
      maxZoom: 18,
      attributionControl: false,
      scrollZoom: interactive,
    });
    m.addControl(new maplibregl.AttributionControl({ compact: !interactive }), 'bottom-right');
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // Markers are positioned from the style alone, so they are usable as soon as
    // the style is applied — not only after every base-map tile has arrived.
    m.on('styledata', () => {
      ready.current = true;
    });
    m.on('load', () => setTilesOffline(false));
    m.on('error', (e) => {
      if (/tile|raster|load|network/i.test(String((e as { error?: Error })?.error?.message ?? ''))) setTilesOffline(true);
    });
    map.current = m;

    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, [compact, interactive]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const render = () => {
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      for (const p of points) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'kmap-pin';
        el.style.setProperty('--pin', p.color ?? '#13A89E');
        el.innerHTML = `<span class="kmap-pin-dot"></span>`;
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const popup = new maplibregl.Popup({ closeButton: true, maxWidth: compact ? '260px' : '320px', offset: 18 })
            .setLngLat([p.lat, p.lng])
            .setHTML(
              `<div class="kmap-card">
                 <p class="kmap-card-title">${escapeHtml(p.title)}</p>
                 <p class="kmap-card-sub">${escapeHtml(p.subtitle)}</p>
                 <a class="kmap-card-link" href="#${escapeHtml(p.path)}">Open listing →</a>
                 <a class="kmap-card-dir" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener noreferrer">Directions</a>
               </div>`
            );
          popup.addTo(m);
          onSelect?.(p);
        });
        const mk = new maplibregl.Marker({ element: el }).setLngLat([p.lat, p.lng]).addTo(m);
        // addTo() overwrites aria-label with MapLibre's generic "Map marker", so the
        // per-place name has to be applied afterwards for screen-reader users.
        el.setAttribute('aria-label', `${p.title} — open listing`);
        el.title = p.title;
        markers.current.push(mk);
      }
    };

    if (ready.current || m.isStyleLoaded()) render();
    else m.once('styledata', render);
    return () => {
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
    };
  }, [signature, points, onSelect, compact]);

  useEffect(() => {
    const m = map.current;
    if (!m || !activeId) return;
    const p = points.find((x) => x.id === activeId);
    if (!p) return;
    m.flyTo({ center: [p.lat, p.lng], zoom: Math.max(m.getZoom(), 13), speed: 0.8 });
  }, [activeId, points]);

  return (
    <div className={`relative overflow-hidden rounded-xl2 border border-navy-100 ${className}`}>
      <div ref={host} className="h-full w-full" />
      {tilesOffline && (
        <p className="pointer-events-none absolute inset-x-3 top-3 z-10 rounded-xl bg-navy-800/90 px-3 py-2 text-[12.5px] font-medium leading-snug text-white">
          Base-map tiles did not load, so the streets are missing. Pins, filters and links still work — this is a
          tile-server or network problem, not missing location data.
        </p>
      )}
    </div>
  );
}
