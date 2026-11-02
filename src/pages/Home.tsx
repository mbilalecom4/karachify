import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Compass,
  Flame,
  Info,
  Layers,
  Map as MapIcon,
  Search as SearchIcon,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { guides } from '../data/guides';
import type { Listing } from '../types';
import { coverage, selectAreas, selectCategories, selectEvents, selectListings, useDB } from '../lib/store';
import { imageFor, pictureSubject } from '../lib/media';
import { pinCaption } from '../lib/format';
import { SearchBox } from '../components/SearchBox';
import { GuideCard, ListingCard, AreaCard, EventCard, CategoryCard, populatedCategoryTiles } from '../components/cards';
import { LazyMap } from '../components/LazyMap';
import { EmptyState, Reveal, SectionHeading } from '../components/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const POPULAR_PLACE_SLUGS = [
  'mazar-e-quaid',
  'mohatta-palace',
  'frere-hall',
  'clifton-beach',
  'port-grand',
  'pakistan-maritime-museum',
  'empress-market',
  'quaid-e-azam-house',
  'karachi-zoo',
  'manora-island',
  'chaukhandi-tombs',
  'national-museum-pakistan',
];

const QUICK_SEARCHES = ['Clifton Beach', 'Biryani', 'Nihari', 'Museums', 'DHA', 'Shopping malls', 'Hospitals'];

/**
 * What a hero photograph shows and who took it, read from the registry rather
 * than typed into the markup — a hard-coded credit silently starts lying the
 * moment the image behind it is swapped.
 */
function photoCredit(img: ReturnType<typeof imageFor>, fallbackLabel: string) {
  const entry = img.entry;
  if (!entry) return `${fallbackLabel} — no licensed photograph sourced yet`;
  const by = [entry.artist, entry.license].filter(Boolean).join(', ');
  return by ? `${pictureSubject(entry)} — photo: ${by}` : `${pictureSubject(entry)} — credit not stated at source`;
}

export default function Home() {
  useDocumentTitle('');
  const db = useDB();
  const navigate = useNavigate();
  const listings = selectListings(db);
  const categories = selectCategories(db);
  const areas = selectAreas(db);
  const events = selectEvents(db);

  const hero = imageFor('hero-karachi', 'Karachi coastline');
  const today = new Date().toISOString().slice(0, 10);
  const categoryTiles = useMemo(() => populatedCategoryTiles(categories, listings, events), [categories, listings, events]);

  const popularPlaces = useMemo(() => {
    const found = POPULAR_PLACE_SLUGS.map((s) => listings.find((l) => l.slug === s)).filter(
      (l): l is Listing => Boolean(l)
    );
    const extra = listings.filter((l) => l.featured && !found.some((f) => f.id === l.id));
    return [...found, ...extra].slice(0, 12);
  }, [listings]);

  const upcoming = useMemo(
    () => events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6),
    [events, today]
  );

  const { verified: verifiedCount, pinned: sourcedCount, fieldOnly, unchecked } = useMemo(() => coverage(listings), [listings]);

  const byCategory = (id: string, n: number, featuredFirst = true) =>
    listings
      .filter((l) => l.categoryId === id)
      .sort((a, b) => Number(featuredFirst && b.featured) - Number(featuredFirst && a.featured) || a.name.localeCompare(b.name))
      .slice(0, n);

  const restaurants = byCategory('restaurants-cafes', 4);
  const hotels = byCategory('hotels', 4);
  const shopping = byCategory('shopping', 4);
  const promoted = useMemo(
    () => listings.filter((l) => l.promoted || l.featured).sort((a, b) => Number(b.promoted) - Number(a.promoted)).slice(0, 4),
    [listings]
  );

  const mapPoints = useMemo(
    () =>
      popularPlaces.map((l) => ({
        id: l.id,
        title: l.name,
        subtitle: `${categories.find((c) => c.id === l.categoryId)?.name ?? 'Karachi'} · ${pinCaption(l.coordsVerified)}`,
        path: `/place/${l.slug}`,
        lat: l.lat,
        lng: l.lng,
        color: '#0A6A63',
      })),
    [popularPlaces, categories]
  );

  return (
    <div>
      {/* ------------------------------ A. hero ------------------------------
          The headline sits on the page, never on a photograph: white type over
          a bright sky or a marble facade is the one combination that reliably
          fails contrast, and this layout has no blur or translucency in it. */}
      <section className="relative overflow-hidden bg-white">
        <div className="shell grid items-center gap-10 py-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-14 lg:py-16">
          <div>
            <span className="badge bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200">
              <Sparkles className="h-3 w-3" /> Independent Karachi directory
            </span>
            <h1 className="mt-5 max-w-[15ch] font-display text-[clamp(2.4rem,6.2vw,4.1rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-navy-900">
              Discover Everything Karachi.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-navy-600">
              One place for the city&apos;s attractions, food streets, events, hotels, malls, hospitals, universities and
              services — organised by neighbourhood so you can plan a day, a move or a meeting without opening eleven
              different tabs.
            </p>

            <div className="mt-7 max-w-2xl">
              <SearchBox variant="hero" />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-navy-500">Popular:</span>
              {QUICK_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(term)}`)}
                  className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[13px] font-medium text-navy-700 transition-colors hover:border-teal-400 hover:text-teal-700"
                >
                  {term}
                </button>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/explore" className="btn-accent btn-lg">
                <Compass className="h-4 w-4" />
                Explore Karachi
              </Link>
              <button
                type="button"
                className="btn btn-lg border border-navy-200 bg-white text-navy-800 hover:border-teal-400 hover:text-teal-700"
                onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <Layers className="h-4 w-4" />
                Browse categories
              </button>
            </div>

            <dl className="mt-9 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: `${listings.length}`, v: 'Directory records' },
                { k: `${areas.length}`, v: 'Areas covered' },
                { k: `${verifiedCount}`, v: 'Fully source-checked' },
                { k: `${sourcedCount}`, v: 'Sourced map pins' },
              ].map((s) => (
                <div key={s.v} className="rounded-2xl border border-navy-100 bg-mist px-4 py-4">
                  <dt className="font-display text-[28px] font-extrabold leading-none tracking-tight text-navy-900">{s.k}</dt>
                  <dd className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-navy-500">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative isolate min-h-[300px] overflow-hidden rounded-[28px] border border-navy-100 shadow-lift sm:min-h-[420px] lg:min-h-[520px]">
            <img
              src={hero.wide}
              alt={hero.entry ? pictureSubject(hero.entry) : 'Karachi'}
              className="absolute inset-0 -z-10 h-full w-full object-cover"
              onError={(e) => (e.currentTarget.src = hero.fallback)}
            />
            <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2">
              <span className="chip-light">
                <MapIcon className="h-3.5 w-3.5 text-teal-600" />
                {photoCredit(hero, 'Karachi coastline')}
              </span>
              <Link to="/plan" className="chip-solid">
                Plan a day <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------- sourcing band ----------------------------- */}
      {db.settings.demoBanner && (
        <div className="border-y border-amber-200 bg-amber-50">
          <div className="shell flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-[13px] leading-relaxed text-amber-900">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              <strong className="font-bold">How this data is sourced.</strong> {verifiedCount} Karachi destinations have
              their map pin, address and every practical detail they show taken from named sources, each linked with the
              date it was checked; a further {sourcedCount - verifiedCount} have a sourced OpenStreetMap pin and address
              but no checked practical details, and {fieldOnly} more were checked for a single field only — a phone
              number, or an address — so their pin stays marked approximate. The remaining {unchecked} records are
              unconfirmed: this site generates no price, rating, review or opening hour for them, and each page shows
              what has not been checked. Photographs are licence-checked Karachi images from Wikimedia Commons.
            </span>
            <Link to="/sources" className="font-semibold underline underline-offset-2">
              Sources &amp; verification
            </Link>
            <Link to="/image-credits" className="font-semibold underline underline-offset-2">
              Image credits
            </Link>
          </div>
        </div>
      )}

      {/* --------------------------- B. categories -------------------------- */}
      <section className="shell section" id="categories">
        <SectionHeading
          eyebrow="Start here"
          title="Explore categories"
          sub={`${categoryTiles.length} sections with places you can open today, covering what a resident, a newcomer or a visitor actually searches for.`}
          action={
            <Link to="/explore" className="btn-outline btn-sm">
              All categories <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categoryTiles.map((t, i) => (
            <Reveal key={t.category.id} delay={Math.min(i * 25, 200)}>
              <CategoryCard category={t.category} count={t.count} unit={t.unit} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------- C. popular places ------------------------ */}
      <section className="bg-white py-12 sm:py-16">
        <div className="shell">
          <SectionHeading
            eyebrow="The postcard list"
            title="Popular places in Karachi"
            sub="The monuments, beaches, museums and heritage buildings people arrive expecting to see — plus the ones locals add afterwards."
            action={
              <Link to="/category/tourist-places" className="btn-outline btn-sm">
                More attractions <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {popularPlaces.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- D. events ----------------------------- */}
      <section className="shell section">
        <SectionHeading
          eyebrow="What's on"
          title="Upcoming events"
          sub="An event appears here only when a dated source names it — organiser, venue programme or news coverage. Nothing here is invented programming."
          action={
            upcoming.length === 0 ? undefined : (
              <Link to="/events" className="btn-outline btn-sm">
                All events <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )
          }
        />
        {upcoming.length === 0 ? (
          <EmptyState
            title="No verified events yet"
            body="Karachify has not found a dated, attributable source for a Karachi event it can publish. Run filters and verified place pages in the meantime, or submit an event with a link to the organiser's own page."
            action={
              <Link to="/submit-event" className="btn-primary">
                Submit an event
              </Link>
            }
            icon={<CalendarDays className="h-6 w-6" />}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------- E. areas ----------------------------- */}
      <section className="bg-mist py-14 sm:py-20">
        <div className="shell">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">By neighbourhood</p>
              <h2 className="section-title">Discover Karachi by area</h2>
              <p className="section-sub">
                Karachi behaves like several cities joined by a few roads. Pick a locality to see what is genuinely
                within reach of it.
              </p>
            </div>
            <Link to="/areas" className="btn-outline btn-sm">
              All {areas.length} areas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {areas.slice(0, 12).map((a) => (
              <AreaCard key={a.id} area={a} count={listings.filter((l) => l.areaId === a.id).length} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- F. restaurants -------------------------- */}
      <section className="shell section">
        <SectionHeading
          eyebrow="Eat like a Karachite"
          title="Featured restaurants & cafes"
          sub="From Burns Road breakfast queues to DHA dinner rooms — the city eats early, eats late and argues about both."
          action={
            <Link to="/category/restaurants-and-cafes" className="btn-outline btn-sm">
              All food & drink <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {restaurants.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* ---------------------------- G. hotels ---------------------------- */}
      <section className="bg-white py-12 sm:py-16">
        <div className="shell">
          <SectionHeading
            eyebrow="Stay"
            title="Popular hotels & accommodation"
            sub="Business towers on Shahrah-e-Faisal, seafront rooms in Clifton and budget guest houses near Saddar."
            action={
              <Link to="/category/hotels-and-accommodation" className="btn-outline btn-sm">
                All stays <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {hotels.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- H. shopping + I. map --------------------- */}
      <section className="shell section">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading eyebrow="Markets & malls" title="Shopping destinations" sub="Malls for the air-conditioning, bazaars for the price." />
            <div className="grid gap-5 sm:grid-cols-2">
              {shopping.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="Interactive" title="Karachi map preview" sub="Pins marked as an OpenStreetMap position are that place's own mapped feature; the rest sit near the middle of their locality. Open the full map to filter by category and area." />
            <div className="card overflow-hidden p-2">
              <LazyMap points={mapPoints} compact className="h-[340px] w-full" />
            </div>
            <Link to="/map" className="btn-dark mt-4">
              <MapIcon className="h-4 w-4" /> Open the full map
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------- J. featured businesses -------------------- */}
      <section className="bg-mist py-12 sm:py-16">
        <div className="shell">
          <SectionHeading
            eyebrow="Featured places"
            title="Karachify picks"
            sub="These records were chosen to surface, not sold. Nothing here is a paid placement — the build takes no money, so no card carries a promoted badge."
            action={
              <Link to="/advertise" className="btn-outline btn-sm">
                Advertise with us <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {promoted.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-navy-100 bg-white p-5">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-teal-600" />
              <div>
                <p className="font-display text-[17px] font-bold text-navy-800">Run a business in Karachi?</p>
                <p className="text-sm text-navy-500">Submit your listing for review, claim an existing record, or open an owner dashboard.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/list-your-business" className="btn-primary btn-sm">
                List your business
              </Link>
              <Link to="/dashboard" className="btn-outline btn-sm">
                Owner dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- K. guides ---------------------------- */}
      <section className="shell section">
        <SectionHeading
          eyebrow="Guides"
          title="Explore Karachi guides"
          sub="Longer answers to the questions visitors ask before they land: one day, with kids, food, monsoon, heritage."
          action={
            <Link to="/guides" className="btn-outline btn-sm">
              All guides <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {guides.slice(0, 4).map((g) => (
            <GuideCard key={g.id} guide={g} />
          ))}
        </div>
      </section>

      {/* --------------------- L. sourcing / corrections ------------------- */}
      <SourcingBand />

      {/* ------------------------- trust strip ----------------------------- */}
      <section className="shell pb-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, t: 'Sourced, not invented', d: 'A verified page names the source it came from and the date it was checked. Where no source published a detail, the page says so instead of guessing one.' },
            { icon: Flame, t: 'Built for the city', d: 'Areas, zones and travel time matter here more than star ratings — every page is organised by locality.' },
            { icon: SearchIcon, t: 'Free to run', d: 'Static build, browser-local storage, open data and open-licence imagery — no paid API keys or subscriptions anywhere in the stack.' },
          ].map((f) => (
            <div key={f.t} className="card p-5">
              <f.icon className="h-5 w-5 text-teal-600" />
              <p className="mt-3 font-display text-[17px] font-bold text-navy-800">{f.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-500">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SourcingBand() {
  const band = imageFor('hero-karachi-night', 'Karachi at night');

  return (
    <section className="shell section">
      <div className="grid overflow-hidden rounded-[28px] border border-navy-100 bg-white shadow-card lg:grid-cols-[1.08fr_0.92fr]">
        <div className="p-7 sm:p-9 lg:p-11">
          <p className="eyebrow mb-3">Sources</p>
          <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy-900 sm:text-[32px]">
            Every detail has a paper trail
          </h2>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-navy-600">
            Opening hours, admission, addresses and coordinates are read from the operator’s own page, a published tariff
            or OpenStreetMap, written up as a research file, and merged into the app by a script. Nothing is typed into
            the interface by hand — and nothing is guessed when a source did not publish it.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/contact" className="btn-primary">
              Report a correction
            </Link>
            <Link to="/help" className="btn-outline">
              How verification works
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-navy-100 bg-mist p-4 text-[13px] leading-relaxed text-navy-600">
            <strong className="font-bold text-navy-800">No newsletter to join.</strong> This build runs without a server,
            so it asks for no email address and sends nothing anywhere.
          </div>
        </div>

        <div className="relative isolate min-h-[240px] lg:min-h-full">
          <img
            src={band.wide}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            onError={(e) => (e.currentTarget.src = band.fallback)}
          />
          <div className="absolute inset-x-5 bottom-5">
            <span className="chip-light">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              {photoCredit(band, 'Karachi at night')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
