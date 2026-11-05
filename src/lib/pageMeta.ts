import { areaBySlug, categories, categoryById, city } from '../data/taxonomy';
import { getListing, listings } from '../data/listings';
import { guides } from '../data/guides';
import type { Area, Category, Guide, Listing } from '../types';
import { areaImageKey, mediaFor } from './media';
import type { OpenRecord } from './openRecords';

/**
 * The head of every page, in one place: two files that each describe a page
 * drift, and a description that drifts from the page is a claim nobody checked.
 *
 * `.tools/prerender.mjs` imports this module at build time and writes these tags
 * into real HTML files, so a crawler or a link preview sees them without running
 * the app, while `MetaManager` in the layout keeps them in step when a visitor
 * moves between pages inside the single-page app.
 */

/**
 * Where the site is published. Written here rather than read from
 * `window.location`, because a canonical URL must not depend on whichever host
 * happened to serve the file. `.tools/prerender.mjs` fails the build when this
 * and the canonical link in index.html disagree, so the two cannot drift apart.
 */
export const SITE_URL = 'https://mbilalecom4.github.io/karachify/';

const root = SITE_URL.replace(/\/$/, '');

/**
 * Absolute URL for a site path, for canonical links and social cards.
 *
 * Always with a trailing slash, because that is the address a static host can
 * actually answer: the page is a directory holding an `index.html`, and
 * `/place/foo/` is the URL served for it. A canonical without the slash would
 * point a crawler at an address the host may redirect or refuse.
 */
export function absoluteUrl(path: string) {
  const clean = path === '' ? '/' : path;
  const withSlash = clean.endsWith('/') ? clean : `${clean}/`;
  return `${root}${withSlash}`;
}

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  /** Only a photograph that really depicts this subject — never a stand-in. */
  image?: string;
  imageAlt?: string;
  jsonLd: Record<string, unknown>;
}

const clamp = (text: string, at = 200) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= at) return clean;
  const cut = clean.slice(0, at);
  const space = cut.lastIndexOf(' ');
  return `${(space > 80 ? cut.slice(0, space) : cut).replace(/[,.;:]+$/, '')}…`;
};

const areaName = (areaId: string) => {
  for (const area of areaBySlug.values()) if (area.id === areaId) return area.name;
  return city.name;
};

const categoryName = (categoryId: string) => categoryById.get(categoryId)?.name ?? 'place';

/**
 * A social card is a promise about the page behind the link, so the only
 * photograph this site will assert as a place's own is one whose Wikimedia file
 * is named for that place. A `kind: 'related'` entry stands in for a comparable
 * Karachi scene and has no business being served as this subject's picture.
 */
function subjectPhoto(key: string, label: string) {
  const entry = mediaFor(key);
  if (!entry || entry.kind !== 'subject' || !entry.wide) return {};
  return { image: entry.wide, imageAlt: `${entry.subject || label} — photograph from Wikimedia Commons, credited on the page.` };
}

/** What Karachify has actually done to check this record, in one sentence. */
function listingClause(l: Listing) {
  if (l.status === 'demo') return 'Karachify shows this as a demonstration record and stamps it as one.';
  if (l.sourceUrl) {
    return l.coordsVerified
      ? 'Karachify holds a named source for its address and map position, linked on the page.'
      : 'Karachify holds a named source for the details it shows, linked on the page; the map pin is the site’s own placement near the centre of the locality, not a position that source gave.';
  }
  if (l.coordsVerified) return 'Karachify geocoded this address itself and shows on the page how the pin was placed.';
  return 'Karachify has not visited or phoned this place: its pin sits near the middle of the locality rather than on the door, and every field is labelled unchecked.';
}

/**
 * The one paragraph a crawler or a link preview is handed. It leads with the
 * locality and what Karachify has done to check the record — the sentence the
 * page is actually built around — then lets the place describe itself, and the
 * whole thing is cut at a word boundary rather than at character 200.
 */
function listingDescription(l: Listing) {
  return clamp(`${l.name} in ${areaName(l.areaId)}, Karachi. ${listingClause(l)} ${l.description}`);
}

function metaForListing(l: Listing): PageMeta {
  const url = absoluteUrl(`/place/${l.slug}`);
  const sameAs = [l.sourceUrl, l.website].filter(Boolean) as string[];
  return {
    title: `${l.name} · Karachify`,
    description: listingDescription(l),
    path: `/place/${l.slug}`,
    ...subjectPhoto(l.slug, l.name),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: l.name,
      description: listingDescription(l),
      url,
      address: {
        '@type': 'PostalAddress',
        streetAddress: l.address,
        addressLocality: city.name,
        addressRegion: 'Sindh',
        addressCountry: 'PK',
      },
      /* Coordinates are published only when a real geocode produced them. An
         area-centre pin is the site's estimate, and publishing it as a location
         would be exactly the claim the page is careful not to make. */
      ...(l.coordsVerified ? { geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } } : {}),
      ...(l.phone ? { telephone: l.phone } : {}),
      ...(l.email ? { email: l.email } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
  };
}

function metaForArea(a: Area): PageMeta {
  return {
    title: `${a.name}, Karachi · Karachify`,
    description: clamp(
      `${a.name} — ${a.blurb} Karachify lists the places in and around it, and says for each one how far it has been checked.`
    ),
    path: `/area/${a.slug}`,
    ...subjectPhoto(areaImageKey(a.id), a.name),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: a.name,
      description: `${a.name}, ${a.zone} zone of ${city.name}, Pakistan.`,
      url: absoluteUrl(`/area/${a.slug}`),
      address: { '@type': 'PostalAddress', addressLocality: city.name, addressRegion: 'Sindh', addressCountry: 'PK' },
      containedInPlace: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'Country', name: city.country } },
    },
  };
}

function metaForCategory(c: Category): PageMeta {
  return {
    title: `${c.name} in Karachi · Karachify`,
    description: clamp(
      `${c.name} in Karachi — ${c.blurb} Karachify lists the places it has checked against a source first, then the wider OpenStreetMap records in the same category, each stamped by how far it has been verified.`
    ),
    path: `/category/${c.slug}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: c.name,
      description: c.blurb,
      url: absoluteUrl(`/category/${c.slug}`),
      isPartOf: { '@id': `${root}/#website` },
      about: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'Country', name: city.country } },
    },
  };
}

function metaForGuide(g: Guide): PageMeta {
  return {
    title: `${g.title} · Karachify`,
    description: clamp(g.excerpt),
    path: `/guides/${g.slug}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: g.title,
      description: g.excerpt,
      url: absoluteUrl(`/guides/${g.slug}`),
      publisher: { '@type': 'Organization', name: 'Karachify' },
      about: { '@type': 'City', name: city.name },
    },
  };
}

/**
 * An open record is not in the bundle, so this head is built in the browser once
 * the tier file arrives. The name, address and position came from OpenStreetMap
 * and nothing else has been checked — that is what the description says.
 */
export function metaForOpenRecord(r: OpenRecord): PageMeta {
  /* The address is OpenStreetMap's own text: it often already ends with Karachi,
     and it frequently ends with a comma from the tag that supplied it. Either
     way, appending the city after it would name Karachi twice or leave the
     sentence with two commas in a row. */
  const addr = r.address.replace(/[\s,;:]+$/, '');
  const where = /karachi\s*$/i.test(addr) ? addr : `${addr}, Karachi`;
  const path = `/directory/${r.categoryId}/${r.slug}`;
  return {
    title: `${r.name} · Karachify`,
    description: clamp(
      `${r.name} — a ${categoryName(r.categoryId)} mapped at ${where} on OpenStreetMap and listed here without a check. Karachify has not visited or phoned it, so no rating, price or description is shown.`
    ),
    path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: r.name,
      description: `OpenStreetMap record for ${r.name} at ${where}, published by Karachify without a check of its own.`,
      url: absoluteUrl(path),
      address: { '@type': 'PostalAddress', streetAddress: r.address, addressLocality: city.name, addressRegion: 'Sindh', addressCountry: 'PK' },
      geo: { '@type': 'GeoCoordinates', latitude: r.lat, longitude: r.lng },
      sameAs: r.sourceUrl,
    },
  };
}

/**
 * The head for a page that says it found nothing. A title that still named a
 * place would be a claim about a record this site cannot see — which is exactly
 * what the page underneath it says it has no record of. `what` is the kind of
 * thing that is missing, in its bare form — "place", "open record", "guide".
 */
export function metaForMissing(path: string, what: string): PageMeta {
  const description = `Karachify found no ${what} at this address, so the page states what is missing instead of describing something it cannot see.`;
  return {
    title: 'Nothing at this address · Karachify',
    description,
    path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Nothing at this address',
      description,
      url: absoluteUrl(path),
      isPartOf: { '@id': `${root}/#website` },
    },
  };
}

/* -------------------------------- fixed pages -------------------------------- */

const fixedPages: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Karachify — Discover Everything Karachi',
    description:
      'A city directory for Karachi with per-field sources: every address, opening hour, price and phone number is either linked to the page it was read from or labelled unverified — never guessed.',
  },
  '/explore': {
    title: 'Explore Karachi · Karachify',
    description:
      'Browse Karachi by category and locality, with the places Karachify has checked kept apart from the wider OpenStreetMap records nobody has visited yet.',
  },
  '/map': {
    title: 'Karachi map — every place Karachify lists · Karachify',
    description:
      'One map of Karachi: checked listings, each stating how its pin was placed, and the unchecked OpenStreetMap records drawn as dots over the same streets.',
  },
  '/directory': {
    title: 'The wider Karachi directory · Karachify',
    description:
      'Every place OpenStreetMap has mapped in Karachi, published as a discovery list with each record linked to its source and stamped unchecked, because nobody at Karachify has verified it.',
  },
  '/open-now': {
    title: 'What is open in Karachi right now · Karachify',
    description:
      'Opening hours as each place published them, read against the Karachi clock — and a clear note wherever Karachify has no hours to show.',
  },
  '/plan': {
    title: 'Plan a day in Karachi · Karachify',
    description:
      'Build a Karachi day plan from the directory, open it from a place you name or a position your browser offers, order the stops by map distance from there, and print what you get.',
  },
  '/areas': {
    title: 'Karachi areas · Karachify',
    description:
      'Karachi by locality — Clifton, Saddar, Gulshan-e-Iqbal, Korangi, Malir and the rest — with the places Karachify lists in each and how far it has checked them.',
  },
  '/services': {
    title: 'City services in Karachi · Karachify',
    description:
      'Hospitals, pharmacies, banks, government offices, transport and other essentials in Karachi, grouped by what a visitor actually needs to find.',
  },
  '/events': {
    title: 'Events in Karachi · Karachify',
    description:
      'What Karachify can list for Karachi with a date and a source. Where nothing has been confirmed, the page says so instead of filling in a calendar.',
  },
  '/guides': {
    title: 'Karachi guides · Karachify',
    description:
      'Written routes and notes for Karachi — a first day, where the city eats, a heritage walk, the monsoon — built from the places Karachify actually lists.',
  },
  '/about': {
    title: 'About Karachify · Karachify',
    description:
      'How Karachify builds a Karachi directory: which sources are used, what is checked by a person, and how many records are still only as good as the map that listed them.',
  },
  '/sources': {
    title: 'Where Karachi data comes from · Karachify',
    description:
      'Every source Karachify reads Karachi from — OpenStreetMap, Wikipedia and Commons, official and government pages, live weather and prayer services — and what each one is trusted to answer.',
  },
  '/image-credits': {
    title: 'Photograph credits · Karachify',
    description:
      'Each photograph on Karachify with its Wikimedia Commons file page, author and licence, and which images are standing in for a scene rather than the place itself.',
  },
  '/contact': {
    title: 'Contact Karachify · Karachify',
    description: 'How to reach Karachify about a listing, a photograph or a mistake — and what happens to a report once it is sent.',
  },
  '/advertise': {
    title: 'Advertise on Karachify · Karachify',
    description:
      'What being listed or promoted on Karachify means, what the site will and will not claim about a business, and how a listing stays labelled by who checked it.',
  },
  '/help': {
    title: 'Help · Karachify',
    description:
      'How to read a Karachify page: what a verified record means, why some pins are estimates, where each number came from, and how to report something that has changed.',
  },
  '/our-services': {
    title: 'What Karachify does · Karachify',
    description: 'The work behind the site — sourcing, verification, the map and the directory — described as it actually runs rather than as a pitch.',
  },
  '/list-your-business': {
    title: 'List your business in Karachi · Karachify',
    description:
      'Submit a Karachi business with its own address, hours and contacts, and see which fields Karachify has been able to check against a source.',
  },
  '/submit-event': {
    title: 'Submit a Karachi event · Karachify',
    description: 'Send an event Karachify can list with a date, a venue and a source to cite — nothing goes out with a date the site invented.',
  },
  '/privacy': {
    title: 'Privacy · Karachify',
    description:
      'What Karachify stores and where: this build keeps saved places, reports and account state in the visitor’s own browser, with no server-side profile.',
  },
  '/terms': {
    title: 'Terms of use · Karachify',
    description: 'The terms for using Karachify, including what the site claims about its own data and what a visitor should still check before acting on it.',
  },
};

/* -------------------------------- resolution -------------------------------- */

/**
 * The head for a site path, or null when this module cannot describe it — a
 * device-local screen (account, admin, search), an open record whose name lives
 * in a tier file rather than the bundle, or an address with nothing behind it.
 * A null is a decision, not a gap: the document keeps what it was served, and
 * the page that owns the path writes its own head once it knows what it has.
 */
export function metaForPath(pathname: string): PageMeta | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const [head, ...rest] = path.split('/').filter(Boolean);
  const first = rest[0];

  if (!head) return homeMeta();

  if (head === 'place') {
    const listing = first && getListing(first);
    return listing ? metaForListing(listing) : metaForMissing(path, 'place');
  }
  if (head === 'category') return first ? bySlug(categories, first, metaForCategory) ?? metaForMissing(path, 'category') : fixedMeta('/directory');
  if (head === 'area') return first ? bySlug([...areaBySlug.values()], first, metaForArea) ?? metaForMissing(path, 'area') : fixedMeta('/areas');
  if (head === 'guides') return first ? bySlug(guides, first, metaForGuide) ?? metaForMissing(path, 'guide') : fixedMeta('/guides');

  /* /directory/<category> is the same wider directory with one category's tiles
     open — addressed by id, because that is what the tier files and the taxonomy
     share. It is not given an entry point of its own: a crawler is told the
     directory has one address, while the visitor keeps the filter in the URL.
     A third segment is a single open record, whose name lives in a tier file
     rather than the bundle, so OpenRecord writes that head itself. */
  if (head === 'directory') {
    if (rest.length > 1) return null;
    return fixedMeta('/directory');
  }

  return fixedMeta(path);
}

function bySlug<T extends { slug: string }>(rows: T[], slug: string, make: (row: T) => PageMeta): PageMeta | null {
  const row = rows.find((r) => r.slug === slug);
  return row ? make(row) : null;
}

function fixedMeta(path: string): PageMeta | null {
  const row = fixedPages[path];
  if (!row) return null;
  return {
    title: row.title,
    description: row.description,
    path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: row.title,
      description: row.description,
      url: absoluteUrl(path),
      isPartOf: { '@id': `${root}/#website` },
      publisher: { '@type': 'Organization', name: 'Karachify' },
      inLanguage: 'en',
    },
  };
}

/** The homepage head, which is also the graph every other page points at. */
function homeMeta(): PageMeta {
  const row = fixedPages['/'];
  return {
    title: row.title,
    description: row.description,
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${root}/#website`,
          name: 'Karachify',
          alternateName: city.tagline,
          url: `${root}/`,
          description: row.description,
          inLanguage: 'en',
          publisher: { '@type': 'Organization', name: 'Karachify' },
        },
        {
          '@type': 'CollectionPage',
          '@id': `${root}/#directory`,
          name: 'Karachi place directory',
          url: `${root}/`,
          isPartOf: { '@id': `${root}/#website` },
          about: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'Country', name: city.country } },
        },
      ],
    },
  };
}

/**
 * Every path worth handing to a crawler. Pages whose content is device-local —
 * the account screens, the admin panel, a search with no query — are left out on
 * purpose, and so are open records, whose 18,812 addresses are not in the bundle
 * and would make a sitemap that could not be checked against anything.
 */
export function indexablePaths(): string[] {
  const paths = new Set<string>(Object.keys(fixedPages));
  for (const c of categories) paths.add(`/category/${c.slug}`);
  for (const a of areaBySlug.values()) paths.add(`/area/${a.slug}`);
  for (const g of guides) paths.add(`/guides/${g.slug}`);
  for (const l of listings) paths.add(`/place/${l.slug}`);
  return [...paths].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}

/* -------------------------------- rendering -------------------------------- */

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Tag {
  /** `property` for Open Graph, `name` for Twitter cards. */
  kind: 'property' | 'name';
  key: string;
  content?: string;
}

/**
 * One list feeds both builders. A card written out twice — once for the file a
 * crawler receives, once for the live document — is a card that eventually
 * disagrees with itself, and the copy nobody re-checks is the one served first.
 * A tag with no content is left out rather than emptied, so a page without a
 * photograph of its own asserts no image.
 */
function tagsFor(meta: PageMeta): Tag[] {
  return [
    { kind: 'property', key: 'og:type', content: 'website' },
    { kind: 'property', key: 'og:site_name', content: 'Karachify' },
    { kind: 'property', key: 'og:title', content: meta.title },
    { kind: 'property', key: 'og:description', content: meta.description },
    { kind: 'property', key: 'og:url', content: absoluteUrl(meta.path) },
    { kind: 'property', key: 'og:locale', content: 'en_PK' },
    { kind: 'property', key: 'og:image', content: meta.image },
    { kind: 'property', key: 'og:image:alt', content: meta.imageAlt },
    { kind: 'name', key: 'twitter:card', content: meta.image ? 'summary_large_image' : 'summary' },
    { kind: 'name', key: 'twitter:title', content: meta.title },
    { kind: 'name', key: 'twitter:description', content: meta.description },
    { kind: 'name', key: 'twitter:image', content: meta.image },
  ];
}

/** The head for one page, as HTML — what `.tools/prerender.mjs` writes into files. */
export function headHtml(meta: PageMeta): string {
  const lines = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    `<link rel="canonical" href="${esc(absoluteUrl(meta.path))}">`,
  ];
  for (const tag of tagsFor(meta)) {
    if (tag.content) lines.push(`<meta ${tag.kind}="${tag.key}" content="${esc(tag.content)}">`);
  }
  lines.push(`<script type="application/ld+json">${jsonLd(meta)}</script>`);
  return lines.join('\n    ');
}

/** `<` escaped so a `</script>` inside a description cannot close the block early. */
const jsonLd = (meta: PageMeta) => JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');

/**
 * The same head applied to a live document. Nodes the served file already
 * carried are updated in place, so a prerendered page that is then navigated to
 * inside the app ends up with exactly one of each tag, not two.
 */
export function applyPageMeta(meta: PageMeta) {
  document.title = meta.title;
  setMeta('name', 'description', meta.description);
  setLink('canonical', absoluteUrl(meta.path));
  for (const tag of tagsFor(meta)) setMeta(tag.kind, tag.key, tag.content);

  const selector = 'script[type="application/ld+json"]';
  let script = document.head.querySelector<HTMLScriptElement>(selector);
  const json = jsonLd(meta);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  if (script.textContent !== json) script.textContent = json;
}

function setMeta(kind: 'property' | 'name', key: string, content: string | undefined) {
  const selector = `meta[${kind}="${key}"]`;
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    node?.remove();
    return;
  }
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(kind, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let node = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement('link');
    node.rel = rel;
    document.head.appendChild(node);
  }
  node.href = href;
}

/**
 * A shareable, absolute URL for a site path. Built from the same SITE_URL the
 * canonical links use, so a link a visitor copies points at the page a crawler
 * was told exists — the `#/…` form it replaces did not survive the move to path
 * routing as anything but a redirect-less dead end.
 */
export function shareUrl(path: string) {
  return absoluteUrl(path.startsWith('/') ? path : `/${path}`);
}
