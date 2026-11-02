# Verification log

Only records where a source other than OpenStreetMap was opened and checked are listed
here. Everything else in `karachify-dataset.json` has
`research.verification.status = "unverified"` and must not be presented as confirmed.

## Batch 1 — restaurants & cafes (2026-11-02)
| Record | Checked against | Confirmed fields | Confidence | Still unknown |
| --- | --- | --- | --- | --- |
| `ginsoy-dha` | <https://ginsoy.com/contact/> | Address (40-C, Shahbaz Commercial, Phase 6 DHA), phone 021-111-446-769, email, Facebook, Instagram | high | Opening hours, menu prices |
| `kababjees-bahadurabad` | <https://kababjees.com/> | Branch identity (Shaheed-e-Millat), phone 021-111-666-111, hours 17:00–01:00 daily, Facebook, Instagram | high | Per-branch address line, menu prices |
| `broadway-pizza-gulshan-iqbal-gulshan-e-iqbal` | <https://www.broadwaypizza.com.pk/> | Central phone 021-111-339-339, WhatsApp, Facebook, Instagram | medium | Branch timings (not published), branch-specific address |

### Notes

- `kababjees-bahadurabad`: the official site lists four Karachi branches. The OSM record
  sits on Shaheed-e-Millat Road, which matches the official “Shaheed-e-Millat” branch.
  The branch mapping is therefore an inference from the street, not a published address.
- `broadway-pizza-*`: the official site publishes one central order line and no branch
  hours, so all Broadway records share the phone but keep `hours: null`.
- Ginsoy: the OSM record is in Phase 6 / Khayaban-e-Shahbaz; the official contact address
  is Shahbaz Commercial Phase 6. Treated as the same location.

## Batch 2 — landmarks & attractions (2026-11-02)

| Record | Checked against | Confirmed fields | Confidence |
| --- | --- | --- | --- |
| `mausoleum-of-quaid-e-azam-*` → renamed Mazar-e-Quaid (Jinnah Mausoleum) | <https://en.wikipedia.org/wiki/Mazar-e-Quaid> | Identity, history, category, coordinates, free image | medium |
| `frere-hall-federal-b-area` | <https://en.wikipedia.org/wiki/Frere_Hall> | Identity, construction year, current use, free image | medium |
| `mohatta-palace-clifton` | <https://en.wikipedia.org/wiki/Mohatta_Palace> | Identity, 1927 construction, museum use | medium |
| `clifton-beach-karachi-clifton` | <https://en.wikipedia.org/wiki/Clifton_Beach,_Karachi> | Identity, public access, 24-hour opening, free image | medium |
| `empress-market-saddar` (new record) | <https://en.wikipedia.org/wiki/Empress_Market> | Identity, location, what is sold, coordinates, free image | medium |

Wikipedia is used for **facts only**; descriptions are paraphrased, not copied. Images are
CC BY-SA and attributed in `data/images/manifest.json`.

## Attempted but not usable

| Source | Problem | Action |
| --- | --- | --- |
| `espresso.com.pk` | HTTP 403 | Left unverified; needs a browser session or a call |
| `pizzahut.com.pk`, `kolachi.com.pk`, `hababs.com`, `nayabfood.com`, `lalqila.com.pk` | Transport/DNS failure from the research host | Retry in a later batch |
| `chaiwala.pk`, `chotuchaiwala.pk`, `kababjeespizza.com`, `studentbiryani.com` | JavaScript-only pages, no static contact data | Needs a real browser session |
| Google Maps, Tripadvisor, Foodpanda | Terms prohibit automated collection | Not scraped; used only as manual discovery hints |

## Next batches (queued)

1. Restaurants — 40 more Karachi venues, prioritising independent local names over chains.
2. Cafes — 25 venues.
3. Hotels, hospitals, universities, shopping, parks/attractions — 20–50 each, verifying
   address + phone against official sites or government registries.
4. Attractions — add Wikimedia Commons photography with attribution.
