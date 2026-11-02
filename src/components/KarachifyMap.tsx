import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl';
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

/** A suggested run of stops, drawn as one coloured line. */
export interface MapRoute {
  id: string;
  color: string;
  stops: { lat: number; lng: number }[];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** MapLibre takes positions as [longitude, latitude]; our records store lat/lng separately. */
const lngLat = (p: { lat: number; lng: number }): [number, number] => [p.lng, p.lat];

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
 * MapLibre map of Karachi used by the map page and the homepage preview.
 * Only OSM-backed coordinates are exact, so every pin carries a caption
 * saying which kind it is.
 */
export function KarachifyMap({
  points,
  routes,
  activeId,
  highlightId,
  onSelect,
  onHover,
  interactive = true,
  className = 'h-[520px] w-full',
  compact = false,
}: {
  points: MapPoint[];
  routes?: MapRoute[];
  activeId?: string | null;
  /** Lights a pin without moving the camera — used for hover from the list. */
  highlightId?: string | null;
  onSelect?: (p: MapPoint) => void;
  onHover?: (id: string | null) => void;
  interactive?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const pinEls = useRef<Map<string, HTMLElement>>(new Map());
  const ready = useRef(false);
  const [tilesOffline, setTilesOffline] = useState(false);
  // Parents pass inline arrow functions; keeping them in a ref means a re-render
  // never tears down and rebuilds every marker on the map.
  const cb = useRef({ onSelect, onHover });
  cb.current = { onSelect, onHover };

  const signature = useMemo(() => points.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.color ?? ''}`).join('|'), [points]);
  const routeSignature = useMemo(
    () => (routes ?? []).map((r) => `${r.id}:${r.color}:${r.stops.map((s) => `${s.lat},${s.lng}`).join(' ')}`).join('|'),
    [routes]
  );

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
    // A successful raster source load is the only honest proof the streets are
    // there; errors alone can arrive before the first tiles are even requested.
    m.on('sourcedata', (e) => {
      if ((e as { sourceType?: string }).sourceType === 'raster' && (e as { isSourceLoaded?: boolean }).isSourceLoaded) {
        setTilesOffline(false);
      }
    });
    let tileErrors = 0;
    m.on('error', (e) => {
      const ev = e as { sourceType?: string; error?: Error };
      const msg = String(ev.error?.message ?? '');
      if (ev.sourceType === 'raster' || /tile|raster|network|load|connection/i.test(msg)) {
        tileErrors += 1;
        if (tileErrors >= 3) setTilesOffline(true);
      }
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
      pinEls.current.clear();
      for (const p of points) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'kmap-pin';
        el.style.setProperty('--pin', p.color ?? '#0A6A63');
        el.innerHTML = `<span class="kmap-pin-dot"></span>`;
        el.addEventListener('mouseenter', () => cb.current.onHover?.(p.id));
        el.addEventListener('mouseleave', () => cb.current.onHover?.(null));
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const popup = new maplibregl.Popup({ closeButton: true, maxWidth: compact ? '260px' : '320px', offset: 18 })
            .setLngLat(lngLat(p))
            .setHTML(
              `<div class="kmap-card">
                 <p class="kmap-card-title">${escapeHtml(p.title)}</p>
                 <p class="kmap-card-sub">${escapeHtml(p.subtitle)}</p>
                 <a class="kmap-card-link" href="#${escapeHtml(p.path)}">Open listing →</a>
                 <a class="kmap-card-dir" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener noreferrer">Directions</a>
               </div>`
            );
          popup.addTo(m);
          cb.current.onSelect?.(p);
        });
        const mk = new maplibregl.Marker({ element: el }).setLngLat(lngLat(p)).addTo(m);
        // addTo() overwrites aria-label with MapLibre's generic "Map marker", so the
        // per-place name has to be applied afterwards for screen-reader users.
        el.setAttribute('aria-label', `${p.title} — open listing`);
        el.title = p.title;
        pinEls.current.set(p.id, el);
        markers.current.push(mk);
      }
    };

    if (ready.current || m.isStyleLoaded()) render();
    else m.once('styledata', render);
    return () => {
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
    };
  }, [signature, points, compact]);

  // The suggested order drawn as a line per day: straight legs between recorded
  // pins, so the curve says "this is the sequence", not "this is the road".
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const draw = () => {
      const lines = (routes ?? []).filter((r) => r.stops.length > 1);
      if (lines.length === 0) {
        if (m.getLayer('karachify-route')) m.removeLayer('karachify-route');
        if (m.getSource('karachify-route')) m.removeSource('karachify-route');
        return;
      }
      const data: FeatureCollection = {
        type: 'FeatureCollection',
        features: lines.map((r) => ({
          type: 'Feature',
          properties: { color: r.color },
          geometry: { type: 'LineString', coordinates: r.stops.map((s) => lngLat(s)) },
        })),
      };
      const source = m.getSource('karachify-route') as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else m.addSource('karachify-route', { type: 'geojson', data });
      if (!m.getLayer('karachify-route')) {
        m.addLayer({
          id: 'karachify-route',
          type: 'line',
          source: 'karachify-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity': 0.9, 'line-dasharray': [2, 1.4] },
        });
      }
      const bounds = new maplibregl.LngLatBounds();
      for (const r of lines) for (const s of r.stops) bounds.extend([s.lng, s.lat]);
      m.fitBounds(bounds, { padding: 42, maxZoom: 14.5, duration: 700 });
    };

    if (ready.current || m.isStyleLoaded()) draw();
    else m.once('styledata', draw);
  }, [routeSignature]);

  useEffect(() => {
    const m = map.current;
    if (!m || !activeId) return;
    const p = points.find((x) => x.id === activeId);
    if (!p) return;
    m.flyTo({ center: lngLat(p), zoom: Math.max(m.getZoom(), 13), speed: 0.8 });
  }, [activeId, points]);

  // Pin ↔ card highlight, so hovering either one lights up the other.
  useEffect(() => {
    const lit = highlightId ?? activeId;
    pinEls.current.forEach((el, id) => el.classList.toggle('kmap-pin--on', id === lit));
  }, [highlightId, activeId, signature]);

  return (
    <div className={`relative overflow-hidden rounded-xl2 border border-navy-100 ${className}`}>
      <div ref={host} className="h-full w-full" />
      {tilesOffline && (
        <p className="pointer-events-none absolute inset-x-3 top-3 z-10 rounded-xl bg-navy-900 px-3 py-2 text-[12.5px] font-medium leading-snug text-white shadow-lift">
          Base-map tiles did not load, so the streets are missing. Pins, filters and links still work — this is a
          tile-server or network problem, not missing location data.
        </p>
      )}
    </div>
  );
}
