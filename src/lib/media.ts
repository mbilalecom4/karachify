import mediaJson from '../data/media.json';
import type { MediaRef } from '../types';

export interface MediaEntry extends MediaRef {
  key: string;
  subject: string;
  via?: string;
  verified?: boolean;
}

const registry = mediaJson as Record<string, MediaEntry>;

export function mediaFor(key: string): MediaEntry | undefined {
  return registry[key];
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
 * matched — preferred over an unrelated photo of another city.
 */
export function placeholderImage(label: string, kicker = 'Karachify demo image') {
  const h = hash(label);
  const hue = 168 + (h % 3) * 6;
  const words = label.split(/\s+/).slice(0, 4);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 18) {
      lines.push(line.trim());
      line = w;
    } else line = `${line} ${w}`;
  }
  if (line.trim()) lines.push(line.trim());
  const text = lines.slice(0, 3);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${esc(label)}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#102A43"/><stop offset="0.62" stop-color="#15334F"/><stop offset="1" stop-color="hsl(${hue} 45% 26%)"/>
</linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#13A89E" stop-opacity="0.32"/><stop offset="1" stop-color="#13A89E" stop-opacity="0"/>
</linearGradient>
</defs>
<rect width="800" height="600" fill="url(#g)"/>
<circle cx="${120 + (h % 400)}" cy="120" r="150" fill="url(#s)"/>
<g fill="#0B1E31" opacity="0.55">
<rect x="0" y="430" width="60" height="170"/><rect x="70" y="380" width="46" height="220"/>
<rect x="126" y="450" width="70" height="150"/><rect x="206" y="330" width="52" height="270"/>
<rect x="268" y="410" width="40" height="190"/><rect x="318" y="300" width="60" height="300"/>
<rect x="388" y="440" width="54" height="160"/><rect x="452" y="360" width="44" height="240"/>
<rect x="506" y="470" width="72" height="130"/><rect x="588" y="340" width="50" height="260"/>
<rect x="648" y="420" width="62" height="180"/><rect x="720" y="390" width="80" height="210"/>
</g>
<circle cx="400" cy="210" r="26" fill="#13A89E" opacity="0.85"/>
<path d="M374 210a26 26 0 0 1 52 0" fill="#5BC6BB" opacity="0.5"/>
<text x="400" y="${text.length > 1 ? 150 : 165}" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="30" font-weight="700" fill="#FFFFFF">${esc(text[0] ?? label)}</text>
${text
  .slice(1)
  .map((t, i) => `<text x="400" y="${188 + i * 34}" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="30" font-weight="700" fill="#FFFFFF">${esc(t)}</text>`)
  .join('\n')}
<text x="400" y="${212 + Math.max(0, text.length - 1) * 34}" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="16" letter-spacing="1.5" fill="#93DCD4">${esc(kicker.toUpperCase())}</text>
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
const AREA_MEDIA: Record<string, string> = {
  clifton: 'clifton-beach',
  dha: 'dolmen-mall-clifton',
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
  if (candidate && registry[candidate]) return candidate;
  return registry['hero-karachi'] ? 'hero-karachi' : `area-${areaId}`;
}

export const resolvedMediaCount = Object.keys(registry).length;
