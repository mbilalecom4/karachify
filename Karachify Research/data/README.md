# Karachify research data — Karachi

Real, source-linked place data shaped for Karachify’s existing `Listing` model.
No invented ratings, prices or descriptions.

## Files

| File | What it is |
| --- | --- |
| `karachify-dataset.json` | All records, Karachify `Listing` shape + `research` block |
| `karachify-dataset.min.json` | Same data, minified for shipping |
| `karachify-listings.csv` | Same data as a spreadsheet (UTF-8 BOM, Excel-safe) |
| `by-category/<categoryId>.json` | One file per Karachify category |
| `unverified.json` | Records imported but not yet source-checked |
| `closed.json` | Records whose OSM tags indicate closure |
| `duplicates.json` | Rows removed by de-duplication, with the record they merged into |
| `progress.json` / `PROGRESS.md` | Counts per category and pending work |
| `DATA_DICTIONARY.md` | Field-by-field mapping to `src/types.ts` and `docs/database-schema.sql` |
| `SOURCES.md` | Licensing, method and what was deliberately not scraped |
| `images/` | Free-licensed images + `manifest.json` (source, artist, licence) |

## Integrating into Karachify

The dataset already matches `src/data/listings/*.ts`. Replace the demo array without
changing components:

```ts
// src/data/listings/index.ts
import research from '../../../data/karachify-dataset.json';
import type { Listing } from '../../types';

export const listings = research as unknown as Listing[];
```

Or seed a SQL backend by mapping snake_case columns per `DATA_DICTIONARY.md`; the only
non-schema field is `research`, which can be stored in `listing_extras` under the key
`research`, or dropped if not needed.

## Honest status

- **All records** are real places from OpenStreetMap (ODbL) with real coordinates.
- **Contact fields** exist only where OSM mappers or the official site provided them.
- **`status`** is `verified` only for the records in the verification batch; everything
  else is `needs-review`.
- **Ratings** are `0` and review counts `0` where no licensed source exists.
- **Images** are only free-licensed Wikimedia Commons files; businesses without a free
  photo have none rather than a copied one.

## Rebuilding

```powershell
node scripts/fetch_osm.mjs restaurants cafes hotels      # refresh OSM source data
node scripts/build_dataset.mjs                           # normalise, dedupe, export
node scripts/fetch_images.mjs                            # Wikimedia images (optional)
```

Agent-verified corrections live in `_curated/patches.json` and are re-applied on every
build, so a rebuild never loses the verification work.
