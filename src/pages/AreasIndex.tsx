import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { selectAreas, selectListings, useDB } from '../lib/store';
import { AreaCard } from '../components/cards';
import { PageHero } from '../components/Page';
import { EmptyState, SectionHeading, Select, TextInput } from '../components/ui';

export default function AreasIndex() {
  const db = useDB();
  const areas = selectAreas(db);
  const listings = selectListings(db);
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('all');

  const zones = Array.from(new Set(areas.map((a) => a.zone))).sort();
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return areas
      .filter((a) => (zone === 'all' ? true : a.zone === zone))
      .filter((a) => (term ? `${a.name} ${a.blurb} ${a.zone}`.toLowerCase().includes(term) : true))
      .map((a) => ({ area: a, count: listings.filter((l) => l.areaId === a.id).length }))
      .sort((x, y) => y.count - x.count || x.area.name.localeCompare(y.area.name));
  }, [areas, listings, q, zone]);

  return (
    <div>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi areas"
        eyebrow="Localities"
        title="Discover Karachi by area"
        sub="Clifton and DHA look nothing like Lyari or Orangi. Open a locality to see the places, food, schools, hospitals and services within it."
        trail={[{ label: 'Home', to: '/' }, { label: 'Areas' }]}
      />

      <section className="shell section">
        <div className="card mb-6 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search areas — Gulshan, Saddar, Malir…"
              aria-label="Search areas"
              className="pl-10"
            />
          </div>
          <Select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Filter by zone" className="lg:w-56">
            <option value="all">All zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z} zone
              </option>
            ))}
          </Select>
        </div>

        <SectionHeading
          eyebrow={`${areas.length} localities`}
          title="Choose an area"
          sub="Listing counts include every unverified record tagged to that locality."
        />

        {filtered.length === 0 ? (
          <EmptyState
            title="No area matches that search"
            body="Try a shorter word — for example “clifton”, “saddar” or “malir” — or clear the zone filter."
            action={
              <button
                className="btn-outline"
                onClick={() => {
                  setQ('');
                  setZone('all');
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(({ area, count }) => (
              <AreaCard key={area.id} area={area} count={count} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
