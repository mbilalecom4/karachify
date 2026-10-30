import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Map as MapIcon, Sparkles } from 'lucide-react';
import { guides } from '../data/guides';
import { selectAreas, selectCategories, selectEvents, selectListings, useDB } from '../lib/store';
import { CategoryCard, AreaCard, GuideCard, EventCard, categoryTileCounts } from '../components/cards';
import { SearchBox } from '../components/SearchBox';
import { PageHero } from '../components/Page';
import { SectionHeading, Tabs } from '../components/ui';
import { ListingExplorer } from '../components/Explorer';

export default function Explore() {
  const db = useDB();
  const categories = selectCategories(db);
  const areas = selectAreas(db);
  const listings = selectListings(db);
  const events = selectEvents(db);
  const [group, setGroup] = useState('All');

  const groups = ['All', ...Array.from(new Set(categories.map((c) => c.group)))];
  const visibleCategories = useMemo(
    () => (group === 'All' ? categories : categories.filter((c) => c.group === group)),
    [categories, group]
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const featuredFirst = useMemo(
    () =>
      [...listings]
        .sort(
          (a, b) =>
            Number(b.featured) - Number(a.featured) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0) || a.name.localeCompare(b.name)
        )
        .slice(0, 12),
    [listings]
  );

  return (
    <div>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="Explore"
        title="Everything Karachify covers, in one place"
        sub={`${categories.length} categories, ${areas.length} localities, events, guides and a searchable map. Start with a category, an area, or just type what you are looking for.`}
        trail={[{ label: 'Home', to: '/' }, { label: 'Explore' }]}
      >
        <div className="max-w-2xl">
          <SearchBox variant="page" />
        </div>
      </PageHero>

      <section className="shell section">
        <SectionHeading
          eyebrow="Categories"
          title="Browse by category"
          sub="Every card opens a full listing page with its own search, area filter, sorting and grid or list view."
          action={
            <div className="flex w-full min-w-0 flex-wrap gap-3 sm:w-auto">
              <Tabs tabs={groups.map((g) => ({ id: g, label: g }))} active={group} onChange={setGroup} size="sm" />
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleCategories.map((c) => (
            <CategoryCard key={c.id} category={c} {...categoryTileCounts(c, listings, events)} />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/map" className="btn-outline btn-sm">
            <MapIcon className="h-3.5 w-3.5" /> Explore map
          </Link>
          <Link to="/events" className="btn-outline btn-sm">
            <Sparkles className="h-3.5 w-3.5" /> What is on
          </Link>
          <Link to="/guides" className="btn-outline btn-sm">
            <Compass className="h-3.5 w-3.5" /> City guides
          </Link>
        </div>
      </section>

      <section className="bg-navy-800 py-12">
        <div className="shell">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-1.5 text-teal-300">Localities</p>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Karachi by area</h2>
            </div>
            <Link to="/areas" className="btn btn-sm border border-white/30 text-white hover:bg-white/10">
              All {areas.length} areas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {areas.slice(0, 6).map((a) => (
              <AreaCard key={a.id} area={a} count={listings.filter((l) => l.areaId === a.id).length} />
            ))}
          </div>
        </div>
      </section>

      <section className="shell section">
        <SectionHeading
          eyebrow="Start here"
          title="Featured Karachi places"
          sub="An editorial shortlist, not a visitor-count ranking — Karachify publishes no traffic or popularity figures it cannot source."
          action={
            <Link to="/search?q=karachi" className="btn-outline btn-sm">
              Search everything <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <ListingExplorer items={featuredFirst} pageSize={12} />
      </section>

      {upcoming.length > 0 && (
        <section className="bg-white py-12">
          <div className="shell">
            <SectionHeading
              eyebrow="Sample programming"
              title="Next three events"
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
          </div>
        </section>
      )}

      <section className="shell section">
        <SectionHeading
          eyebrow="Guides"
          title="Karachi city guides"
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
    </div>
  );
}
