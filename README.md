# Karachify — Discover Everything Karachi

A city-discovery platform for Karachi, built as a complete, working product rather than a
mockup: 21 category sections, 182 place records, 17 events, 8 editorial guides, an interactive
MapLibre map, global search, demo accounts, a business-owner flow and an admin console.

**This is a launch preview running on demo data.** Everything on screen is real Karachi
geography and realistic copy — no lorem ipsum — but none of it has been verified against the
businesses themselves. A persistent banner says so, and every record carries a
`status: 'demo' | 'verified' | 'needs-review'` field so the same UI can host vetted data later.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc -b, strict + noUnusedLocals
npm run build        # dist/
```

There is no server, no API key and no account to create. Everything below runs in the browser.

---

## What is implemented

| Area | Detail |
| --- | --- |
| Header / navigation | Grouped dropdowns (Discover, Eat & Stay, City Life, Essentials), off-canvas mobile menu with expandable submenus, mobile search panel |
| Home | Blocks A–L (labelled in `src/pages/Home.tsx`): hero + search, quick filters, category grid, popular places, upcoming events, area rail, restaurants, hotels, shopping + map preview, featured businesses, guides, newsletter/CTA strip |
| Categories | 21 pages, each with in-category search, area filter, sub-filters, sort, grid/list toggle, load-more pagination, empty state and count badges |
| Places | 182 listings across 9 data modules; detail pages switch layout by category (attraction, restaurant, hotel, hospital, education, shopping, park, venue, service, transport, government, emergency, religious, sports) |
| Listing detail | Gallery, address, hours, contact, website, facilities, services, demo reviews, favourite, share, get directions, nearby places, related records |
| Areas | 18 locality pages (Saddar, Clifton, DHA, Gulshan, Korangi, Malir, Lyari, …) with per-area listings and maps |
| Events | 12 event categories, upcoming/past/all tabs, filters, detail page, registration & enquiry form, demo ticket block, venue, add-to-calendar, share |
| Map | MapLibre GL over public OSM raster tiles, category/status filters, marker popups linking to records, nearby search, split map/list view, external directions handoff |
| Search | Global search over the live demo dataset (names, tags, cuisine, categories, areas, events, guides), ranked with recent-term history |
| Accounts | Demo sign-up/login, per-user favourites, saved events, enquiry history and recent searches |
| Business flow | *List your business* submission → admin queue → publish, plus a business dashboard with enquiry log |
| Admin | Working demo CRUD over listings, events, categories, areas, submissions, reviews, media and settings |
| Editorial | About, Contact, Advertise, Help/FAQ, Privacy, Terms, Image credits, Guides index + 8 guides |

### Routes

```
/                      /explore              /services
/category/:slug        /areas                /area/:slug
/place/:slug           /events               /events/:slug
/map                   /search?q=            /guides          /guides/:slug
/login  /signup  /profile  /saved  /dashboard
/list-your-business  /submit-event  /admin
/about  /contact  /advertise  /help  /image-credits  /privacy  /terms
```

Routing uses `HashRouter`, so the site also works from any static sub-path without rewrite
rules — which is what makes the GitHub Pages deploy trivial.

---

## Data model

`src/types.ts` defines every entity with `id`, `slug` and `cityId`. Nothing is hard-wired to
Karachi except the seed content: `city`, `areas` and `categories` live in `src/data/taxonomy.ts`,
and a second city would be another seed file, not a rewrite. The multi-city shape is present;
the multi-city *feature* (city switcher, per-city domains) is deliberately not built.

- `src/data/listings/*.ts` — 182 records through one `makeListing()` factory, so field defaults
  and status flags cannot drift between modules.
- `src/data/events.ts` — 17 sample events, each labelled *Sample event*.
- `src/data/guides.ts` — 8 long-form guides.
- `src/data/media.json` — the image registry (see below).
- `docs/database-schema.sql` — the same shape as Postgres/Supabase tables (`cities`, `areas`,
  `categories`, `listings`, `listing_extras`, `media`, `events`, `guides`, `profiles`,
  `user_prefs`, `submissions`, `enquiries`, `reviews`, `reports`, `settings`) with indexes and
  RLS notes, ready to migrate to.

`src/lib/store.ts` is the only place that touches persistence. It exposes `useDB()` (a
`useSyncExternalStore` subscription), selector functions and an `actions` object. Swapping
localStorage for Supabase means reimplementing that one module.

### localStorage

| Key | Contents |
| --- | --- |
| `karachify.db.v1` | The whole demo database: seeded records plus `newListings`, `listingPatches`, `deletedListings`, the same trio for events, categories, areas, plus `users`, `prefs`, `submissions`, `enquiries`, `reviews`, `settings` |

Base content stays in source; only edits are stored, which keeps the payload small and lets
**Reset demo data** in the Admin header restore the shipped state. Nothing leaves the browser.

---

## Images: honesty over filler

Every picture on the site is a hotlink to Wikimedia Commons with its artist and licence recorded
in `src/data/media.json`. Nothing is downloaded or bundled.

The rule that shaped the dataset: **a photograph is only attached to a record if the file
evidence actually names that subject.** Otherwise the page renders a designed navy/teal
placeholder that names the subject instead of quietly showing a Frere Hall photo on the Mohatta
Palace page.

Registry entries carry `kind`:

- `subject` — the photo depicts this record (45 entries)
- `related` — a Karachi photo of the same category, labelled *illustrative* in the UI (88 entries)

Current coverage: 199 place/event records, 114 with photography, **85 rendering the designed
placeholder** — concentrated in services, clinics, fictional hotels and sample events, where no
freely-licensed photo of the actual subject could be confirmed.

Pipeline (all re-runnable, no API key needed):

```bash
node .tools/dump-names.mjs        # every record slug → display name
node .tools/pick-media.mjs        # curated Commons search per record, writes media.json
node .tools/classify-media.mjs --apply   # re-score each file's evidence: subject | related | drop
node .tools/check-media-urls.mjs  # HEAD/GET every thumb+wide (266 URLs)
```

`classify-media.mjs` also rejects `wikipedia.org/wikipedia/en/…` URLs — those are fair-use local
files (logos, posters) that are not hotlinkable and are not freely licensed. The `/image-credits`
page lists artist, licence and file page for everything used.

Search reality worth knowing: `commons.wikimedia.org/w/api.php` is blocked on this network, so
the scripts go through `en.wikipedia.org/w/api.php` with `list=search&srnamespace=6` and
`prop=imageinfo`, and thumbnails come from `thumb.wikimedia.org`.

---

## Map

`src/components/KarachifyMap.tsx` + `src/pages/MapView.tsx` use MapLibre GL (no API key) over
public OpenStreetMap raster tiles. Coordinates are approximate demo values and the UI says so on
every map surface; marker popups link into the record, *directions* hands off to Google Maps, and
`© OpenStreetMap contributors` stays visible as the OSM tile usage policy requires. The source
comment is explicit that a production deployment should move to a self-hosted or commercial tile
provider rather than lean on the public servers.

---

## Deploy to GitHub Pages (free)

**Recommended — GitHub Actions.** `.github/workflows/deploy-pages.yml` builds on every push to
`main` and publishes `dist/` through the official Pages actions. It sets
`KARACHIFY_BASE=${{ github.event.repository.name }}`, so the asset base always matches the repo
name and the workflow is copy-paste ready for another repo or another city.
In the repo: **Settings → Pages → Source: GitHub Actions**, then push.

**Manual alternative — the `gh-pages` branch:**

```bash
KARACHIFY_BASE=<repo-name> npm run build
npx gh-pages -d dist        # then: Settings → Pages → Source: gh-pages branch, root
```

`vite.config.ts` reads `KARACHIFY_BASE` and emits `base: /<repo-name>/` for build only, so local
`npm run dev` stays at `/`. Because the app uses `HashRouter`, deep links such as
`/<repo>/#/place/clifton-beach` resolve without any `404.html` trick.

---

## Testing performed

- `tsc -b` clean under `strict` + `noUnusedLocals`.
- Production bundle swept in Chromium: 118 desktop routes and 12 mobile (390 px) cold loads —
  every category, area, event, guide and place-detail shape, plus empty-search and 404 paths.
  Zero console errors, zero broken images, zero horizontal overflow at either width.
- Mobile menu exercised on the built bundle: open → submenu expand → navigate → panel closes.
- Favourite/save round-trip, admin CRUD and `Reset demo data` verified against localStorage.
- All 266 image URLs (thumb + wide) validated with HEAD/GET.

`vite preview` is not a reliable way to check this build locally: it answers requests carrying
`Sec-Fetch-Dest: script` with 404, so the module never mounts. Use `node .tools/serve-dist.mjs`
(serves `dist/` on `http://localhost:4174/karachify/`) or deploy and check the live URL.

---

## Deliberate limits

- Demo auth uses a passcode field with no real credential storage — it is a UI showcase, not a
  login system, and the admin console says so on screen.
- Reviews, ratings and opening hours are invented for layout purposes.
- Events are samples, never presented as confirmed listings.
- No payment, messaging or booking integration; enquiry forms write to localStorage only.
