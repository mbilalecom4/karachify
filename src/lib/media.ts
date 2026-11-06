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
  /** For a photo found through the file's own metadata rather than its name: the
   *  category it is filed under, the description it carries, or the position the
   *  camera recorded, written by `.tools/resolve-verified-photos.mjs`. */
  evidence?: string;
  /** Width and height of the original file on Wikimedia Commons, as the API
   *  reported them to `.tools/measure-renditions.mjs`. */
  w?: number;
  h?: number;
  /** Every rendition of this file that was asked for and answered: the widths
   *  on the host's allow-list that sit below `w`. Nothing else may be offered. */
  px?: number[];
}

const registry = mediaJson as Record<string, MediaEntry>;

/**
 * How wide each painted frame gets, measured with `getBoundingClientRect()` in
 * Chromium at 390 / 640 / 1024 / 1280 / 1440 CSS px (and 768 for the article
 * figure) — the widths the layout actually produces, not what the classes look
 * like they should give. `srcset` cannot pick a rendition without this: the list
 * says what exists, `sizes` says what the page will draw with it. Where a frame
 * is fluid the expression tracks the viewport; where the layout caps it the
 * number is the cap. A desktop window loses about 15px of each `100vw` figure to
 * its scrollbar, so the measured widths sit a few pixels under the claim.
 */
export const IMG = {
  /** full-bleed hero: edge to edge, 390px on a 390px viewport, 1440px at 1440 */
  hero: '100vw',
  /** the two home panels: 356px on a phone, 590px at 640, 432–441px at 1024,
   *  555–558px from 1280 up */
  feature: '(max-width: 639px) calc(100vw - 39px), (max-width: 1023px) calc(100vw - 65px), (max-width: 1299px) 44vw, 558px',
  /** card image in a grid that narrows to four across at `xl`: 356px on a phone,
   *  284–286px at 640, 282–307px above `lg` */
  card: '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 34px), 305px',
  /** the same card image where four sit in a row: 223px at 1024, 287px once the
   *  `max-w-[1280px]` shell stops growing */
  card4: '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 34px), (max-width: 1279px) calc((100vw - 124px) / 4), 289px',
  /** a card in a `sm:grid-cols-2 lg:grid-cols-3` grid that stays three-up, which
   *  is every event card: two across to 1023px exactly as `card`, then the same
   *  three-up row `card3sm` measured (305px at 1024, 390px from 1280) */
  card3: '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 34px), (max-width: 1279px) calc((100vw - 104px) / 3), 392px',
  /** a card in a `sm:grid-cols-3` grid (three-up from 640): 182px at 640, 305px
   *  at 1024, 390px once the shell stops growing */
  card3sm: '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc((100vw - 88px) / 3), (max-width: 1279px) calc((100vw - 104px) / 3), 392px',
  /** an area card in the Explore six-up row: 305px at 1024, 187px from 1280 */
  card6: '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 34px), (max-width: 1279px) calc((100vw - 104px) / 3), 189px',
  /** the same card image in the list view: full width on a phone, then a fixed
   *  `w-56` (events) or `w-64` (listings) column. Claimed as 224px so the 250px
   *  rendition still wins for both. */
  cardList: '(max-width: 639px) calc(100vw - 40px), 224px',
  /** category tiles: 2-up on a phone (162px), 3-up to 300px, 222–228px above `lg` */
  tile: '(max-width: 639px) calc(50vw - 30px), (max-width: 1023px) calc(33.33vw - 30px), 240px',
  /** tiles that stop at four across instead of narrowing to five at `xl` — 228px
   *  at 1024, 292px above the 1280px shell */
  tile4: '(max-width: 639px) calc(50vw - 30px), (max-width: 1023px) calc(33.33vw - 30px), (max-width: 1279px) calc((100vw - 112px) / 4), 292px',
  /** the lead frame of a listing gallery: 341px on a phone, 465px at 1024, 600px from 1294 */
  galleryLead: '(max-width: 639px) calc(100vw - 49px), (max-width: 1023px) calc(100vw - 65px), (max-width: 1293px) calc((100vw - 94px) / 2), 600px',
  /** every other gallery frame, which sits beside the lead above 640px: 225px at 1024, 293px at 1366 */
  galleryCell: '(max-width: 639px) calc(100vw - 49px), (max-width: 1023px) calc(50vw - 26px), (max-width: 1279px) calc((100vw - 96px) / 4), 293px',
  /** the enlarged frame inside the gallery lightbox (a `max-w-3xl` dialog) */
  lightbox: '(max-width: 1023px) calc(100vw - 84px), 728px',
  /** a figure in the article column: 341px on a phone, 703px at 768, 766px from 1024 up */
  figure: '(max-width: 639px) calc(100vw - 49px), (max-width: 1023px) calc(100vw - 65px), 766px',
  /** the admin photograph contact sheet: 358px on a phone, 288px at 640, 299px
   *  at 1024, 395px once the `max-w-[1280px]` shell stops growing */
  sheet: '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 32px), (max-width: 1279px) calc((100vw - 96px) / 3), 395px',
  /** a search-result row's thumbnail, fixed by its own class */
  row: '128px',
  /** the search dropdown's chip, fixed by its own class */
  chip: '44px',
  /** the credits table's thumbnail, fixed by its own class */
  credit: '64px',
} as const;

export type ImgSize = keyof typeof IMG;

export interface ImgAttrs {
  src?: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
}

const rewidth = (url: string, width: number) => url.replace(/\/(\d+)px-([^/]*?)(\?|#|$)/, `/${width}px-$2$3`);

/** The widths this file can be asked for, biggest last. */
function candidateWidths(entry?: MediaEntry): number[] {
  const px = entry?.px;
  const own = entry?.w;
  if (!px?.length || !own) return [];
  return px.filter((width) => width > 0 && width < own);
}

/**
 * The attributes for one painted photograph, spread onto the `<img>`.
 *
 * A `srcset` is only ever built from the widths recorded against this file, and
 * those were each requested before being written down — see
 * `.tools/measure-renditions.mjs`, which refuses to record a width the API did
 * not confirm for that exact path. So a browser is never offered a URL that
 * 404s, and a card is never asked to stretch a 500px file across 1900px.
 */
export function imgAttrs(entry: MediaEntry | undefined, src: string | undefined, size: ImgSize): ImgAttrs {
  const base = entry?.thumb;
  const widths = candidateWidths(entry);
  const attrs: ImgAttrs = { src };
  /* Candidates are always cut from the entry's own thumb URL, whatever frame
     they are being painted into: that is the path the measurement pass asked
     the host about, and one host per file keeps the list honest. */
  if (entry && base && /\/\d+px-/.test(base) && widths.length > 1) {
    attrs.srcSet = widths.map((width) => `${rewidth(base, width)} ${width}w`).join(', ');
    attrs.sizes = IMG[size];
  }
  if (entry?.w && entry.h) {
    attrs.width = entry.w;
    attrs.height = entry.h;
  }
  return attrs;
}

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
  const thumb = entry?.thumb ?? fallback;
  const wide = entry?.wide ?? entry?.thumb ?? fallback;
  return {
    thumb,
    wide,
    fallback,
    entry,
    isPlaceholder: !entry,
    /** The attributes for this picture painted at the card size. */
    thumbImg: (size: ImgSize = 'card') => imgAttrs(entry, thumb, size),
    /** …painted at the size a hero or gallery needs. */
    wideImg: (size: ImgSize = 'hero') => imgAttrs(entry, wide, size),
  };
}

/**
 * Point a frame at the designed stand-in after its photograph failed to load.
 * The `srcset` has to go with it: leaving it in place means the browser keeps
 * choosing a rendition of the file that just failed rather than the fallback
 * now sitting in `src`.
 */
export function failToPlaceholder(img: HTMLImageElement, fallback: string) {
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  if (img.src !== fallback) img.src = fallback;
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

/** Registry keys whose picture really depicts the record it is attached to, as
 *  opposed to the `related` stand-ins that only show a comparable Karachi scene. */
export const subjectMediaCount = Object.values(registry).filter((m) => m.kind !== 'related').length;
export const illustrativeMediaCount = resolvedMediaCount - subjectMediaCount;
/** Photographs attached to a record from the OpenStreetMap tier, whose key is
 *  `open:<category>:<slug>` rather than a curated slug. */
export const openRecordMediaCount = Object.keys(registry).filter((k) => k.startsWith('open:')).length;
