import { Link } from 'react-router-dom';
import { Camera, Database, Eye, Heart, Layers, MapPin, Search, ShieldCheck } from 'lucide-react';
import { coverage, selectAreas, selectCategories, selectListings, useDB } from '../lib/store';
import { useTierSummary } from '../lib/openRecords';
import { resolvedMediaCount } from '../lib/media';
import { plural } from '../lib/format';
import { Note, PageHero, Prose } from '../components/Page';
import { SectionHeading } from '../components/ui';

export default function About() {
  const db = useDB();
  const listings = selectListings(db);
  const areas = selectAreas(db);
  const categories = selectCategories(db);
  const { verified: verifiedCount, pinned: sourcedCount, fieldOnly, unchecked, audited } = coverage(listings);
  const tier = useTierSummary();

  const facts = [
    { icon: Database, label: 'Checked records', value: String(listings.length) },
    { icon: Layers, label: 'Categories', value: String(categories.length) },
    { icon: Eye, label: 'Areas mapped', value: String(areas.length) },
    { icon: Heart, label: 'Records with a source', value: String(audited) },
    {
      icon: MapPin,
      label: 'Open records, unchecked',
      value: tier.data ? tier.data.total.toLocaleString() : '—',
    },
  ];

  return (
    <>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="About"
        title="A city index built for the way Karachi is actually visited"
        sub="Karachify gathers places, services and areas into one searchable map — then tells you, field by field, which part came from a named source and which part nobody has checked yet."
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
              {verifiedCount} records are fully source-checked: the map pin, the address and every practical detail those
              pages show — hours, admission or contact numbers where the operator states them — were read from the
              operator’s own website, a museum’s published tariff or OpenStreetMap, and each page links the source
              together with the date it was checked. Those pages carry a
              <span className="badge-verified mx-1 align-middle">Source-verified</span> badge.
            </p>
            <p>
              A further {sourcedCount - verifiedCount} destinations sit between the two states: their position is the
              place’s own OpenStreetMap feature and their address was copied from that record, dated, but their hours,
              admission and contacts have not been confirmed against the operator. Those pages show the sourced fields
              with their date and leave the unchecked ones blank.
            </p>
            <p>
              {fieldOnly} records were checked for one field and one field only. A city-wide hotline is not a building:
              the number it publishes on a government page can be confirmed while its office cannot be located, so those
              pages carry a sourced phone number or address and mark the pin itself approximate.
            </p>
            <p>
              The remaining {unchecked} records are ones nobody at Karachify has checked yet. Those pages carry no star
              rating, no review
              count, no invented price band and no survey-grade pin — they say “Rating not verified”, “Pricing to confirm”
              or “Approximate position” instead of offering a plausible guess, and Karachify does not claim the business
              still trades under the name shown. Records whose own data files described them as placeholder entries —
              generic clinics, salons, agencies and hotels written to demonstrate a layout — were deleted rather than
              relabelled, along with the fabricated ratings, demo phone numbers and sample opening hours that shipped in
              the earlier build.
            </p>
            <p>
              The event board is empty for the same reason. Karachify has not found a dated, attributable source for a
              Karachi event it can publish, so it publishes none — an invented calendar looked better and was worse.
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
              React and TypeScript with Tailwind CSS, MapLibre GL for the interactive map and OpenStreetMap raster tiles —
              no API key, no quota and no billing account anywhere in the stack. Verified data is never typed into the
              app by hand: it is written up as research JSON under <code>docs/verification</code>, generated into
              <code>src/data/verified-overrides.json</code> by <code>.tools/apply-verification.mjs</code>, and merged over
              the seed records at load. The client-side store is shaped to match
              <code>docs/database-schema.sql</code>, so moving off browser storage means replacing selectors, not
              rewriting pages. Routing uses hash URLs so a static host never 404s on a deep link.
            </p>

            <h2>What comes next</h2>
            <ul>
              <li>Verified business claims with a document check, so owners can edit their own listings.</li>
              <li>Real event sourcing from venue pages, with a “confirmed” badge and an organiser contact.</li>
              <li>Working through the directory category by category until every record has a source and a date.</li>
              <li>Self-hosted or licensed map tiles, and saved public-transport routes to each place.</li>
              <li>Second city on the same data model, with Karachi as the reference implementation.</li>
            </ul>
          </Prose>

          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">Principles</h2>
              <ul className="mt-3 space-y-3 text-sm text-navy-600">
                {[
                  ['Blank beats invented', 'An unsourced field stays empty and says so.'],
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
                Search “biryani”, filter to Clifton and open a record — then open Mazar-e-Quaid and compare it: the
                verified page names the source for every hour, rupee and coordinate, with the date it was checked.
              </p>
              <div className="mt-4 space-y-2">
                <Link to="/explore" className="btn-primary w-full">
                  Explore Karachi
                </Link>
                <Link to="/map" className="btn-outline w-full">
                  Open the map
                </Link>
                <Link to="/sources" className="btn-ghost w-full">
                  <ShieldCheck className="h-4 w-4" /> Sources &amp; verification
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
              .map((c) => {
                const n = listings.filter((l) => l.categoryId === c.id).length;
                const open = tier.data?.categories.find((t) => t.id === c.id)?.unchecked ?? 0;
                return { c, n, open };
              })
              .sort((a, b) => b.open + b.n - (a.open + a.n))
              .map(({ c, n, open }) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <Link to={`/category/${c.slug}`} className="font-semibold text-navy-800 hover:text-teal-700">
                    {c.name}
                  </Link>
                  <span className="text-sm text-navy-500">
                    {plural(n, 'checked record', 'checked records')}
                    {open > 0 && <span className="text-navy-400"> · {open.toLocaleString()} more on the map, unchecked</span>}
                  </span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </>
  );
}
