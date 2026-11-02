# Karachify — Karachi business & places research

This folder contains **research output**, not the Karachify app. The app source was
downloaded to `_repo/karachify-main` only to read its schema so the data would fit it
without conversion.

## What was delivered

| Deliverable | Location |
| --- | --- |
| JSON database (Karachify `Listing` shape + research metadata) | `data/karachify-dataset.json` |
| CSV spreadsheet | `data/karachify-listings.csv` |
| Per-category JSON | `data/by-category/*.json` |
| Top 50 shortlist per category | `data/top/*.json` |
| Images + licence manifest | `data/images/` |
| Sources & licensing documentation | `data/SOURCES.md` |
| Unverified records | `data/unverified.json` |
| Duplicate records removed | `data/duplicates.json` |
| Closed records | `data/closed.json` |
| Data dictionary (schema mapping) | `data/DATA_DICTIONARY.md` |
| Progress report | `data/PROGRESS.md`, `data/progress.json` |
| Verification log | `data/VERIFICATION_LOG.md` |
| Reproducible pipeline | `scripts/` |

## Source policy

- **Discovery + coordinates:** OpenStreetMap via Overpass API, © OpenStreetMap
  contributors, **ODbL 1.0**. Attribution is required if this ships.
- **Verification:** official business websites, opened and checked on the date recorded
  per record.
- **Images:** Wikimedia Commons, free licences only, with artist + licence in the manifest.
- **Not scraped:** Google Maps, Tripadvisor, Foodpanda, Facebook/Instagram — their terms
  prohibit automated collection. Only public URLs already present in OSM are stored.
- **Never invented:** ratings, review counts, prices, opening hours, phone numbers.
  Unknown stays `null`/`0`/absent, and `status` stays `needs-review`.

## Integrating with Qoder / Karachify

The JSON matches `src/types.ts` exactly. Drop it in:

```ts
import research from '../../../data/karachify-dataset.json';
import type { Listing } from '../../types';

export const listings = research as unknown as Listing[];
```

For SQL, map camelCase → snake_case using `data/DATA_DICTIONARY.md`; store the extra
`research` object in `listing_extras` (kind = `research`) or discard it.

## Reproducing / extending

```powershell
node scripts/fetch_osm.mjs restaurants cafes      # pull OSM source data
node scripts/build_dataset.mjs                    # normalise, dedupe, export
node scripts/fetch_images.mjs                     # Wikimedia images
```

Verified corrections go in `_curated/patches.json`; rebuilds re-apply them.

## Honest scope note

The database currently covers the categories fetched from OSM in this session. Counts,
field coverage and pending categories are always in `data/PROGRESS.md` — read that
before treating any number as final. Verification is incremental: batch 1 covered three
restaurants; the rest are real places but still marked `needs-review`.
