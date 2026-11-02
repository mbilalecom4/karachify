# Karachify data dictionary

Every record in `karachify-dataset.json` is a superset of the `Listing` interface in
`src/types.ts`, so it can be imported into Karachify without a conversion step.
Extra research fields live under a single `research` object and are ignored by the UI.

## 1. Karachify `Listing` fields (1:1 with `docs/database-schema.sql`)

| JSON field | SQL column | Type | Notes |
| --- | --- | --- | --- |
| `id` | `listings.id` | text | Slug-based, stable within this dataset |
| `slug` | `listings.slug` | text | Unique per city; used in routes |
| `cityId` | `listings.city_id` | text | Always `karachi` |
| `categoryId` | `listings.category_id` | text | One of the 21 IDs in `src/data/taxonomy.ts` |
| `areaId` | `listings.area_id` | text | One of the 18 IDs in `src/data/taxonomy.ts` |
| `name` | `listings.name` | text | Exact OSM name / official name |
| `tagline` | `listings.tagline` | text | Short factual label, not marketing copy |
| `description` | `listings.description` | text | Factual; says when the record is unverified |
| `address` | `listings.address` | text | Built from `addr:*` tags, else "<Area>, Karachi" |
| `lat` / `lng` | `listings.lat` / `lng` | number | Real coordinates from OSM geometry |
| `phone` | `listings.phone` | text? | E.164-ish (`+92…`) when parseable |
| `website` | `listings.website` | text? | Official site only; socials are separate |
| `email` | `listings.email` | text? | Only when tagged |
| `hours` | `listings.hours` | `{day,open}[]` | Parsed from OSM `opening_hours`; raw kept too |
| `priceRange` | `listings.price_range` | `Free\|$\|$$\|$$$\|Demo`? | Omitted unless a source states it |
| `cuisine` | `listings.cuisine` | text[]? | Restaurants only |
| `facilities` | `listings.facilities` | text[] | Only tags that explicitly say yes |
| `rating` | `listings.rating` | number | **0 = unknown** (never invented) |
| `reviewCount` | `listings.review_count` | number | **0 = unknown** |
| `tags` | `listings.tags` | text[] | Subcategory + cuisine + brand |
| `featured` / `promoted` | same | boolean | Always false in research data |
| `status` | `listings.verification_status` | `demo\|verified\|needs-review` | `verified` only after a source check |
| `sourceUrl` | `listings.source_url` | text? | Primary source (OSM element first) |
| `createdAt` | `listings.created_at` | date | Import date |

## 2. `research` object (extra, UI-ignored)

| Field | Type | Meaning |
| --- | --- | --- |
| `subcategory` | string | `restaurant`, `cafe`, `clinic`, `museum`, `market`… |
| `areaRaw` | string? | Locality exactly as tagged (`addr:suburb`) |
| `closed` | boolean | Lifecycle tags suggest the place is closed |
| `prominenceScore` | number | Data-completeness + brand signal used for ordering only |
| `phoneRaw` / `whatsapp` | string? | E.164 normalised where possible |
| `socials` | `{facebook,instagram,twitter}` | Official pages only |
| `openingHoursRaw` | string? | Original OSM `opening_hours` syntax |
| `brand` / `wikidata` / `wikipedia` | string? | Cross-reference keys |
| `mapLinks` | `{osm,googleMaps,bingMaps}` | Deep links. Google link is a coordinate query, not scraped data |
| `sources[]` | `{url,type,retrievedAt,license}` | Every source used for this record |
| `verification` | `{date,status,confidence,method,notes}` | `verified` / `unverified` / `closed`; confidence `high\|medium\|low` |
| `ratingData` | `{value,count,source,date}` | Populated only when a source explicitly permits reuse |
| `services[]` / `prices[]` | arrays | Empty until a source supplies them |
| `images[]` | `{url,thumb,license,artist,filePage,kind}` | Free-licensed images only (Wikimedia Commons) |
| `conflicts[]` | `{field,values[],chosen,reason}` | Documented disagreements between sources |

## 3. Category IDs accepted by Karachify

`tourist-places`, `museums-galleries`, `parks-recreation`, `beaches`, `religious-places`,
`restaurants-cafes`, `hotels`, `wedding-venues`, `events`, `shopping`, `sports-fitness`,
`art-culture`, `transport`, `hospitals`, `doctors-clinics`, `pharmacies-labs`,
`universities`, `schools`, `government`, `emergency`, `professional-services`.

## 4. Area IDs accepted by Karachify

`clifton`, `dha`, `saddar`, `gulshan-e-iqbal`, `gulistan-e-johar`, `pechs`,
`north-nazimabad`, `federal-b-area`, `bahadurabad`, `korangi`, `malir`, `lyari`,
`shahrah-e-faisal`, `gulberg-karachi`, `kemari`, `orangi-town`, `landhi`, `surjani-town`.

Records outside these 18 areas are mapped to the nearest one and the true locality is
preserved in `research.areaRaw`. If Karachify later adds areas (e.g. Scheme 33, Gadap),
those records can be re-pointed without touching any other field.
