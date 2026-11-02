# Sources, licensing and method

## Primary source: OpenStreetMap

- Extracted with the Overpass API on 2026-11-02 from a bounding box covering greater
  Karachi (`24.75,66.85,25.05,67.35`).
- Data © OpenStreetMap contributors, licensed **ODbL 1.0**
  (<https://www.openstreetmap.org/copyright>).
- Retention of attribution is required. If Karachify ships this data, the UI or an
  credits page must say: “Place data © OpenStreetMap contributors (ODbL).”
- OSM is a live, community-maintained database. Coordinates are real, but phone numbers,
  websites and opening hours are only as current as the last mapper edit.

## Secondary sources used (verification batch)

| Source | Used for | Constraint |
| --- | --- | --- |
| Official business websites (`kababjees.com`, `ginsoy.com`, `broadwaypizza.com.pk`) | Phone, address, hours, socials | Facts only; no copying of copy or imagery |
| Wikimedia Commons | Photographs | Only CC0 / CC BY / CC BY-SA files, with attribution metadata |

## Sources deliberately **not** scraped

These services are used only as discovery hints (a human may open them), never as an
automated data source, because their terms prohibit it:

- Google Maps / Google Business Profiles — no scraping; only coordinate deep links are generated.
- Tripadvisor — no scraping.
- Foodpanda — no scraping.
- Facebook / Instagram — no scraping; only public page URLs are stored when already tagged.
- Yellow Pages Pakistan — not scraped; listed as a future manual-check source.

If a future batch needs ratings or review counts, use an authorised API or a licensed
data provider and record the licence in `research.ratingData`.

## Verification rules applied

1. A field is only filled when a source states it. Otherwise it stays `null`/absent.
2. `status: "verified"` requires at least one official or authoritative page, checked on
   the date in `research.verification.date`.
3. Two sources disagreeing → both values are kept in `research.conflicts` with the chosen
   value and the reason.
4. Closed places are kept (not deleted) with `research.closed: true` so the UI can hide them.
5. Ratings are `0` and review counts `0` when unknown — the existing demo’s invented
   ratings are deliberately not reproduced.
6. Duplicates (same normalised name within 150 m, or same phone within 500 m) are merged
   into one record; the discarded row is logged in `duplicates.json`.

## Limits worth knowing

- OSM mappers delete places that close, so `closed.json` only catches records that still
  carry lifecycle tags. It is not a complete list of closed businesses.
- `areaId` is mapped to the nearest of Karachify’s 18 areas; the true locality is kept in
  `research.areaRaw`. Some edge-of-city venues will be approximate at area level only —
  coordinates are exact.
- Ratings are absent by design. A “top 50” file ranks by data completeness and brand
  signal, **not** by popularity or review score.

## Field-level provenance

Every record carries `research.sources[]`. Each entry is
`{url, type, retrievedAt, license}` where `type` is one of
`openstreetmap`, `official-website`, `wikimedia-commons`, `government`, `directory`.

The first entry is always the OSM element URL, so any field can be traced back to the
object it came from.
