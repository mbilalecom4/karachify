import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Map as MapIcon } from 'lucide-react';
import { guides } from '../data/guides';
import { selectAreas, selectCategories, selectEvents, selectListings, useDB } from '../lib/store';
import { openCountLabel, useTierSummary } from '../lib/openRecords';
import { CategoryCard, AreaCard, GuideCard, EventCard, populatedCategoryTiles } from '../components/cards';
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
  const tier = useTierSummary();

  const groups = ['All', ...Array.from(new Set(categories.map((c) => c.group)))];
  const visibleCategories = useMemo(
    () => (group === 'All' ? categories : categories.filter((c) => c.group === group)),
    [categories, group]
  );
  const tiles = useMemo(() => populatedCategoryTiles(visibleCategories, listings, events), [visibleCategories, listings, events]);
  const openableCount = useMemo(() => populatedCategoryTiles(categories, listings, events).length, [categories, listings, events]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const featuredFirst = useMemo(
    () =>
      [...listings]
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name))
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
        sub={`${categories.length} categories, ${openableCount} of them with places you can open today, ${areas.length} localities, city guides and a searchable map. Start with a category, an area, or just type what you are looking for.`}
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
          {tiles.map((t) => (
            <CategoryCard
              key={t.category.id}
              category={t.category}
              count={t.count}
              unit={t.unit}
              extra={openCountLabel(t.category.id, tier.data)}
            />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/map" className="btn-outline btn-sm">
            <MapIcon className="h-3.5 w-3.5" /> Explore map
          </Link>
          <Link to="/guides" className="btn-outline btn-sm">
            <Compass className="h-3.5 w-3.5" /> City guides
          </Link>
        </div>
      </section>

      <section className="bg-mist py-14">
        <div className="shell">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Localities</p>
              <h2 className="section-title">Karachi by area</h2>
            </div>
            <Link to="/areas" className="btn-outline btn-sm">
              All {areas.length} areas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {areas.slice(0, 6).map((a) => (
              <AreaCard key={a.id} area={a} count={listings.filter((l) => l.areaId === a.id).length} size="card6" />
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
            <GuideCard key={g.id} guide={g} size="card4" />
          ))}
        </div>
      </section>
    </div>
  );
}
