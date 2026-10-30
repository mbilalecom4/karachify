import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Compass,
  Flame,
  Info,
  Layers,
  Mail,
  Map as MapIcon,
  Search as SearchIcon,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { guides } from '../data/guides';
import type { Listing } from '../types';
import { selectAreas, selectCategories, selectEvents, selectListings, actions, useDB } from '../lib/store';
import { imageFor } from '../lib/media';
import { SearchBox } from '../components/SearchBox';
import { GuideCard, ListingCard, AreaCard, EventCard, CategoryCard, categoryTileCounts } from '../components/cards';
import { KarachifyMap } from '../components/KarachifyMap';
import { Field, Reveal, SectionHeading, TextInput, useToast } from '../components/ui';
import { isValidEmail } from '../lib/format';
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

  const byCategory = (id: string, n: number, featuredFirst = true) =>
    listings
      .filter((l) => l.categoryId === id)
      .sort((a, b) => Number(featuredFirst && b.featured) - Number(featuredFirst && a.featured) || (b.rating ?? 0) - (a.rating ?? 0))
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
        subtitle: `${categories.find((c) => c.id === l.categoryId)?.name ?? 'Karachi'} · approximate demo location`,
        path: `/place/${l.slug}`,
        lat: l.lat,
        lng: l.lng,
        color: '#13A89E',
      })),
    [popularPlaces, categories]
  );

  return (
    <div>
      {/* ------------------------------ A. hero ------------------------------ */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={hero.wide} alt="Karachi coastline" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.src = hero.fallback)} />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/80 via-navy-950/60 to-navy-950/85" />
        </div>
        <div className="shell flex flex-col items-center py-20 text-center sm:py-28">
          <span className="badge bg-teal-500/20 text-teal-100 ring-1 ring-inset ring-teal-300/40">
            <Sparkles className="h-3 w-3" /> Karachi city discovery · demo build
          </span>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold leading-[1.08] text-white sm:text-6xl">
            Discover Everything Karachi.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-navy-100 sm:text-lg">
            One place for the city&apos;s attractions, food streets, events, hotels, malls, hospitals, universities and
            services — organised by neighbourhood so you can plan a day, a move or a meeting without opening eleven
            different tabs.
          </p>
          <div className="mt-8 w-full max-w-3xl">
            <SearchBox variant="hero" />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[13px] font-semibold text-navy-200">Popular:</span>
            {QUICK_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => navigate(`/search?q=${encodeURIComponent(term)}`)}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                {term}
              </button>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/explore" className="btn-primary btn-lg">
              <Compass className="h-4 w-4" />
              Explore Karachi
            </Link>
            <button
              type="button"
              className="btn btn-lg border border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20"
              onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <Layers className="h-4 w-4" />
              Browse categories
            </button>
          </div>
          <dl className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: `${listings.length}`, v: 'Listings' },
              { k: `${categories.length}`, v: 'Categories' },
              { k: `${areas.length}`, v: 'Areas covered' },
              { k: `${events.length}`, v: 'Events on the board' },
            ].map((s) => (
              <div key={s.v} className="rounded-xl border border-white/15 bg-white/10 px-3 py-4 backdrop-blur">
                <dt className="font-display text-2xl font-extrabold text-white">{s.k}</dt>
                <dd className="text-[13px] font-medium uppercase tracking-wide text-navy-100">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --------------------- demo transparency band ---------------------- */}
      {db.settings.demoBanner && (
        <div className="border-y border-amber-200 bg-amber-50">
          <div className="shell flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-[13px] leading-relaxed text-amber-900">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              <strong className="font-bold">Showcase build.</strong> Listings, timings, prices, phone numbers and reviews
              are realistic demo records, clearly labelled. Photographs are real, licence-checked Karachi images from
              Wikimedia Commons with attribution on the credits page.
            </span>
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
          sub={`${categories.length} sections covering the things a resident, a newcomer or a visitor actually searches for.`}
          action={
            <Link to="/explore" className="btn-outline btn-sm">
              All categories <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categories.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i * 25, 200)}>
              <CategoryCard category={c} {...categoryTileCounts(c, listings, events)} />
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
          sub="Sample programming so you can see how the events system works — dates, venues, ticket tiers and the enquiry form."
          action={
            <Link to="/events" className="btn-outline btn-sm">
              All events <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      {/* ---------------------------- E. areas ----------------------------- */}
      <section className="bg-navy-800 py-12 sm:py-16">
        <div className="shell">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-1.5 text-teal-300">By neighbourhood</p>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Discover Karachi by area</h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-navy-200">
                Karachi behaves like several cities joined by a few roads. Pick a locality to see what is genuinely
                within reach of it.
              </p>
            </div>
            <Link to="/areas" className="btn btn-sm border border-white/30 text-white hover:bg-white/10">
              All {areas.length} areas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            <SectionHeading eyebrow="Interactive" title="Karachi map preview" sub="Every pin below is a real demo record with an approximate location. Open the full map to filter by category and area." />
            <div className="card overflow-hidden p-2">
              <KarachifyMap points={mapPoints} compact className="h-[340px] w-full" />
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
            eyebrow="Promotional placements"
            title="Featured businesses"
            sub="Paid and featured slots are always labelled. In this showcase they are demo records, not real advertisers."
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

      {/* -------------------------- L. newsletter -------------------------- */}
      <NewsletterBand />

      {/* ------------------------- trust strip ----------------------------- */}
      <section className="shell pb-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, t: 'Honest demo data', d: 'Nothing pretends to be verified. Sample records say "Sample data"; real landmarks link to their source.' },
            { icon: Flame, t: 'Built for the city', d: 'Areas, zones and travel time matter here more than star ratings — every page is organised by locality.' },
            { icon: SearchIcon, t: 'Free to run', d: 'Static build, local storage persistence and open-licence imagery: no paid services anywhere in this demo.' },
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

function NewsletterBand() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const band = imageFor('hero-karachi-night', 'Karachi at night');

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={band.wide} alt="" aria-hidden className="h-full w-full object-cover" onError={(e) => (e.currentTarget.src = band.fallback)} />
        <div className="absolute inset-0 bg-navy-950/85" />
      </div>
      <div className="shell grid gap-8 py-14 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="eyebrow mb-2 text-teal-300">Newsletter</p>
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Get the Karachi briefing</h2>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-navy-100">
            One email a week: what is on this weekend, which new place opened, and the seasonal practical stuff —
            monsoon routes, beach weather, Eid shopping hours. In this demo your address is stored locally and never
            sent anywhere.
          </p>
        </div>
        <form
          className="card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValidEmail(email)) {
              setError('Enter a valid email address, e.g. you@example.com');
              return;
            }
            setError(undefined);
            actions.addSubmission({ kind: 'newsletter', name: email, email, description: 'Newsletter signup from the homepage band.' });
            setEmail('');
            toast.push('Subscribed (demo). You can review this signup in the admin queue.');
          }}
        >
          <Field label="Email address" error={error} required>
            <TextInput
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              error={Boolean(error)}
            />
          </Field>
          <button type="submit" className="btn-primary mt-2 w-full">
            <Mail className="h-4 w-4" /> Subscribe to the demo newsletter
          </button>
          <p className="mt-2 text-[12px] leading-relaxed text-navy-400">
            Demo only: no email service is connected. Production would use a keyed provider such as Resend, Postmark or
            Mailchimp.
          </p>
        </form>
      </div>
    </section>
  );
}
