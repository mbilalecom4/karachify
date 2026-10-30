import { Link } from 'react-router-dom';
import { Camera, Database, Eye, Heart, Layers, Search } from 'lucide-react';
import { selectAreas, selectCategories, selectEvents, selectListings, useDB } from '../lib/store';
import { resolvedMediaCount } from '../lib/media';
import { plural } from '../lib/format';
import { Note, PageHero, Prose } from '../components/Page';
import { SectionHeading } from '../components/ui';

export default function About() {
  const db = useDB();
  const listings = selectListings(db);
  const events = selectEvents(db);
  const areas = selectAreas(db);
  const categories = selectCategories(db);

  const facts = [
    { icon: Database, label: 'Directory records', value: String(listings.length) },
    { icon: Layers, label: 'Categories', value: String(categories.length) },
    { icon: Eye, label: 'Areas mapped', value: String(areas.length) },
    { icon: Heart, label: 'Sample events', value: String(events.length) },
  ];

  return (
    <>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="About"
        title="A city index built for the way Karachi is actually visited"
        sub="Karachify gathers places, events, services and areas into one searchable map — then tells you honestly which parts are verified and which are sample data."
        trail={[{ label: 'Home', to: '/' }, { label: 'About' }]}
      />

      <div className="shell section">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="card p-5">
              <f.icon className="h-5 w-5 text-teal-600" />
              <p className="mt-3 font-display text-3xl font-extrabold text-navy-800">{f.value}</p>
              <p className="text-sm text-navy-500">{f.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <Prose>
            <h2>Why this exists</h2>
            <p>
              Karachi is enormous and it changes fast. The information that matters when you are trying to reach a place —
              which block, which turn, whether it is open on a Friday, whether the photograph you found online is even the
              right building — is scattered across social pages, outdated directories and word of mouth. A visitor planning
              a weekend, a family finding a clinic at night, or someone new to the city looking for a park near their
              office all hit the same wall.
            </p>
            <p>
              Karachify starts from the geography instead of the advertisement. Every record belongs to an area, every area
              sits on the map, and every category page is a real browser with search, filters, sorting and an empty state —
              not a list of links to someone else’s listing site.
            </p>

            <h2>What is honest in this build</h2>
            <p>
              This deployment is a working demonstration, and it says so on screen. Sample listings carry a
              <span className="badge-demo mx-1 align-middle">Sample data</span> badge, generated reviews are labelled as
              demo, prices and phone numbers are marked, and event programming is invented rather than copied from a real
              organiser. Coordinates are approximate pins, not surveyed locations.
            </p>
            <p>
              Where a fact could not be confirmed, the record shows “Pricing to confirm” or “Needs review” instead of
              guessing. That is deliberate: a directory that invents opening hours is worse than no directory.
            </p>

            <h2>Photography</h2>
            <p>
              Images are hotlinked from Wikimedia projects, and each candidate is checked for two things before it is used:
              the article must actually be about the subject, and it must be about Karachi, Sindh or Pakistan. War, disaster
              and incident pages are rejected outright even when they mention a neighbourhood. {resolvedMediaCount}
              photographs currently pass those gates and carry a credit link, an artist and a licence.
            </p>
            <p>
              For the rest, Karachify renders a designed placeholder naming the real subject. A labelled placeholder is
              truthful; a picture of another city dressed up as Karachi is not.
            </p>

            <h2>How it is built</h2>
            <p>
              React and TypeScript with Tailwind CSS, MapLibre GL for the interactive map and OpenStreetMap raster tiles for
              the demo. The data layer is a single store module whose shape mirrors the SQL schema in
              <code>docs/database-schema.sql</code>, so moving from localStorage to Supabase means replacing selectors,
              not rewriting pages. Routing uses hash URLs so a static host never 404s on a deep link.
            </p>

            <h2>What comes next</h2>
            <ul>
              <li>Verified business claims with a document check, so owners can edit their own listings.</li>
              <li>Real event sourcing from venue pages, with a “confirmed” badge and an organiser contact.</li>
              <li>Self-hosted or licensed map tiles, and saved public-transport routes to each place.</li>
              <li>Second city on the same data model, with Karachi as the reference implementation.</li>
            </ul>
          </Prose>

          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">Principles</h2>
              <ul className="mt-3 space-y-3 text-sm text-navy-600">
                {[
                  ['Label the fiction', 'Demo records look like demo records.'],
                  ['Search the real dataset', 'No results page should ever claim a place exists.'],
                  ['Karachi imagery only', 'Placeholder beats a wrong photograph.'],
                  ['Free to explore', 'No account, no paywall, no tracking pixel.'],
                ].map(([t, d]) => (
                  <li key={t}>
                    <strong className="text-navy-800">{t}.</strong> {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-navy-800">
                <Search className="h-4 w-4 text-teal-600" /> Try it
              </h2>
              <p className="mt-2 text-sm text-navy-500">
                Search “biryani”, filter to Clifton, sort by rating and open a listing. Then try the map and the event
                calendar — the same dataset drives all of it.
              </p>
              <div className="mt-4 space-y-2">
                <Link to="/explore" className="btn-primary w-full">
                  Explore Karachi
                </Link>
                <Link to="/map" className="btn-outline w-full">
                  Open the map
                </Link>
                <Link to="/image-credits" className="btn-ghost w-full">
                  <Camera className="h-4 w-4" /> Image credits
                </Link>
              </div>
            </div>
            <Note>
              Karachify is an independent project and is not the official tourism platform of any Karachi authority.
              Official information should be confirmed with the relevant department before you rely on it.
            </Note>
          </aside>
        </div>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Coverage"
            title="What is in the directory right now"
            sub="Counts come from the same store the pages read, so they never drift from what you can actually browse."
          />
          <div className="card divide-y divide-navy-50">
            {categories
              .map((c) => ({ c, n: listings.filter((l) => l.categoryId === c.id).length }))
              .sort((a, b) => b.n - a.n)
              .slice(0, 12)
              .map(({ c, n }) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <Link to={`/category/${c.slug}`} className="font-semibold text-navy-800 hover:text-teal-700">
                    {c.name}
                  </Link>
                  <span className="text-sm text-navy-500">{plural(n, 'record', 'records')}</span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </>
  );
}
