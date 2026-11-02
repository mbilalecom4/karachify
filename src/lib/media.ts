import mediaJson from '../data/media.json';
import type { MediaRef } from '../types';

export interface MediaEntry extends MediaRef {
  key: string;
  subject: string;
  via?: string;
  verified?: boolean;
  /** Why a `related` picture is standing in, recorded per entry and read by
   *  the claim audit — not a caption. */
  illustrativeReason?: string;
}

const registry = mediaJson as Record<string, MediaEntry>;

export function mediaFor(key: string): MediaEntry | undefined {
  return registry[key];
}

/**
 * What a photograph actually depicts, read from its own Wikimedia file name.
 * `MediaEntry.subject` is the *record* the entry was attached to — written from
 * the listing, not from the picture — so any sentence about what an image shows
 * must use this instead. Files picked as `kind: 'related'` stand-ins depict a
 * different Karachi scene, and saying which one is the whole point of the badge.
 */
export function pictureSubject(entry?: MediaEntry): string {
  if (!entry) return '';
  const file = decodeURIComponent((entry.filePage ?? '').split('/File:')[1] ?? '');
  const stem = file
    .replace(/\.(jpe?g|png|webp|tiff|gif)$/i, '')
    .replace(/asv\d{4}-\d{2}/gi, ' ')
    .replace(/_?img\d+/gi, ' ')
    .replace(/^[A-Z]{2}[_ ](?=[A-Za-z])/i, '')
    .replace(/[-_ ]panoramio([-_ ]\w+)?/gi, ' ')
    .replace(/[-_ ]wallpaper[-_ ]?\d*/gi, ' ')
    .replace(/img[_ ]?\d+/gi, ' ')
    .replace(/["“”']/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\d{1,}\s*$/g, '')
    .replace(/[,.:;]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stem || entry.via || 'another Karachi scene';
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function hash(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647;
  return h;
}

/**
 * Designed stand-in used whenever no licensed Karachi photograph could be
 * matched — preferred over an unrelated photo of another city. Light tile so
 * it sits inside the light card grid instead of reading as a dark photo, with
 * the subject's own name printed on it.
 */
export function placeholderImage(label: string, kicker = 'Photo not sourced yet') {
  const h = hash(label);
  const words = label.split(/\s+/).slice(0, 5);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 20) {
      lines.push(line.trim());
      line = w;
    } else line = `${line} ${w}`;
  }
  if (line.trim()) lines.push(line.trim());
  const text = lines.slice(0, 3);
  const startY = 300 - (text.length - 1) * 21;
  const skylineY = 600 - (h % 40);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${esc(label)} — ${esc(kicker)}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#F7FAF8"/><stop offset="1" stop-color="#E8F0ED"/>
</linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#CBFF54" stop-opacity="0.30"/><stop offset="1" stop-color="#CBFF54" stop-opacity="0"/>
</linearGradient>
</defs>
<rect width="800" height="600" fill="url(#g)"/>
<circle cx="${140 + (h % 520)}" cy="90" r="190" fill="url(#s)"/>
<g fill="#A9CFCA">
<rect x="0" y="${skylineY - 150}" width="60" height="150"/><rect x="70" y="${skylineY - 200}" width="46" height="200"/>
<rect x="126" y="${skylineY - 120}" width="70" height="120"/><rect x="206" y="${skylineY - 240}" width="52" height="240"/>
<rect x="268" y="${skylineY - 160}" width="40" height="160"/><rect x="318" y="${skylineY - 270}" width="60" height="270"/>
<rect x="388" y="${skylineY - 130}" width="54" height="130"/><rect x="452" y="${skylineY - 210}" width="44" height="210"/>
<rect x="506" y="${skylineY - 100}" width="72" height="100"/><rect x="588" y="${skylineY - 230}" width="50" height="230"/>
<rect x="648" y="${skylineY - 150}" width="62" height="150"/><rect x="720" y="${skylineY - 185}" width="80" height="185"/>
</g>
<g transform="translate(400 150)" fill="none" stroke="#0A6A63" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
<path d="M-86 -22h20a16 16 0 0 1 12-6h68a16 16 0 0 1 12 6h20a20 20 0 0 1 20 20v64a20 20 0 0 1-20 20h-192a20 20 0 0 1-20-20v-64a20 20 0 0 1 20-20z"/>
<circle cx="0" cy="36" r="30"/><circle cx="0" cy="36" r="12"/>
</g>
${text
  .map((t, i) => `<text x="400" y="${startY + i * 44}" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="34" font-weight="700" fill="#063231">${esc(t)}</text>`)
  .join('\n')}
<text x="400" y="${startY + text.length * 44 + 6}" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="17" letter-spacing="1.4" fill="#227A72">${esc(kicker.toUpperCase())}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function imageFor(key: string, label: string) {
  const entry = registry[key];
  const fallback = placeholderImage(label);
  return {
    thumb: entry?.thumb ?? fallback,
    wide: entry?.wide ?? entry?.thumb ?? fallback,
    fallback,
    entry,
    isPlaceholder: !entry,
  };
}

export function attributionRows(): MediaEntry[] {
  return Object.values(registry)
    .filter((m) => m.filePage)
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Area pages and area cards borrow a verified photograph of a landmark in or
 * near that locality. Where nothing suitable is resolved they fall back to the
 * Karachi skyline image rather than a picture of another city.
 */
export const AREA_MEDIA: Record<string, string> = {
  clifton: 'clifton-beach',
  saddar: 'empress-market',
  'gulshan-e-iqbal': 'university-of-karachi',
  'gulistan-e-johar': 'lucky-one-mall',
  pechs: 'hussainia-pechs',
  'north-nazimabad': 'ibne-bin-qasim-bagh',
  'federal-b-area': 'karachi-zoo',
  bahadurabad: 'bahadurabad-bus-terminal',
  korangi: 'korangi-wholesale-mandi',
  malir: 'malir-garden',
  lyari: 'mama-parshuram-clinic-lyari',
  'shahrah-e-faisal': 'national-stadium-karachi',
  'gulberg-karachi': 'frere-hall',
  kemari: 'manora-island',
  'orangi-town': 'chaukhandi-tombs',
  landhi: 'karachi-expo-centre',
  'surjani-town': 'seaview-point',
};

export function areaImageKey(areaId: string) {
  const candidate = AREA_MEDIA[areaId];
  // An area page only ever shows a photograph of a landmark inside that area.
  // Without one, the placeholder tile carries the area's own name instead of a
  // picture from a different locality.
  return candidate && registry[candidate] ? candidate : `area-${areaId}`;
}

export const resolvedMediaCount = Object.keys(registry).length;
