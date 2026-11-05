import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { selectAreas, selectCategories, selectEvents, selectListings, useDB } from '../lib/store';
import { areaImageKey, imageFor } from '../lib/media';
import { EventCard } from '../components/cards';
import { ListingExplorer } from '../components/Explorer';
import { LazyMap } from '../components/LazyMap';
import { NearbyEssentials } from '../components/NearbyEssentials';
import { PageHero } from '../components/Page';
import { EmptyState, SectionHeading } from '../components/ui';
import { coordText, pinCaption, plural } from '../lib/format';

export default function AreaPage() {
  const { slug = '' } = useParams();
  const db = useDB();
  const areas = selectAreas(db);
  const categories = selectCategories(db);
  const listings = selectListings(db);
  const events = selectEvents(db);

  const area = areas.find((a) => a.slug === slug);
  const items = useMemo(() => (area ? listings.filter((l) => l.areaId === area.id) : []), [listings, area]);
  const today = new Date().toISOString().slice(0, 10);
  const areaEvents = useMemo(
    () => events.filter((e) => e.areaId === area?.id && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    [events, area, today]
  );
  const points = useMemo(
    () =>
      items.slice(0, 60).map((l) => ({
        id: l.id,
        title: l.name,
        subtitle: `${categories.find((c) => c.id === l.categoryId)?.name ?? 'Listing'} · ${pinCaption(l.coordsVerified)}`,
        path: `/place/${l.slug}`,
        lat: l.lat,
        lng: l.lng,
        color: '#0A6A63',
      })),
    [items, categories]
  );
  const neighbours = useMemo(
    () =>
      areas
        .filter((a) => a.id !== area?.id && (a.zone === area?.zone || Math.abs(a.lat - (area?.lat ?? 0)) < 0.05))
        .slice(0, 6),
    [areas, area]
  );

  if (!area) {
    return (
      <div className="shell section">
        <EmptyState
          title="Unknown area"
          body="That locality is not one Karachify covers yet. Every covered locality is listed on the areas page."
          action={
            <Link to="/areas" className="btn-primary">
              Browse all areas
            </Link>
          }
        />
      </div>
    );
  }

  const countsByCategory = categories
    .map((c) => ({ category: c, count: items.filter((l) => l.categoryId === c.id).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHero
        mediaKey={areaImageKey(area.id)}
        label={`${area.name}, Karachi`}
        eyebrow={`${area.zone} zone · Karachi`}
        title={area.name}
        sub={area.blurb}
        trail={[{ label: 'Home', to: '/' }, { label: 'Areas', to: '/areas' }, { label: area.name }]}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="chip-light">{plural(items.length, 'listing')}</span>
          <span className="chip-light">{plural(countsByCategory.length, 'category', 'categories')}</span>
          <span className="chip-light">Approx. {coordText(area.lat, area.lng)}</span>
          <a
            className="badge bg-teal-700 text-white"
            href={`https://www.google.com/maps/dir/?api=1&destination=${area.lat},${area.lng}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin className="h-3 w-3" /> Directions
          </a>
        </div>
        <p className="mt-3 max-w-xl text-[13px] text-navy-200">
          A pin labelled "OpenStreetMap position" is that place's own mapped feature. The rest sit near the locality
          centre and are not addresses — open a listing for the address its source states.
        </p>
      </PageHero>

      <section className="border-b border-navy-100 bg-white">
        <div className="shell no-scrollbar flex gap-2 overflow-x-auto py-4">
          {countsByCategory.map(({ category, count }) => (
            <Link key={category.id} to={`/category/${category.slug}?area=${area.id}`} className="chip whitespace-nowrap">
              {category.name}
              <span className="text-navy-400">{count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="shell">
        <NearbyEssentials
          lat={area.lat}
          lng={area.lng}
          subject={area.name}
          positionLabel={`the centre of ${area.name}`}
          approximate
        />
      </section>

      <section className="shell section">
        <SectionHeading
          eyebrow="In this area"
          title={`Everything in ${area.name}`}
          sub="Search within the locality, narrow it to a category from the chips above, or switch to list view for a quicker scan."
        />
        <ListingExplorer
          items={items}
          showArea={false}
          pageSize={db.settings.listingsPerPage}
          emptyTitle="Nothing in this area matches those filters"
          emptyBody="This locality has fewer records in that category than others. Try clearing the search, or browse the whole category."
        />
      </section>

      {points.length > 0 && (
        <section className="bg-white py-12">
          <div className="shell">
            <SectionHeading
              eyebrow="Map"
              title={`${area.name} on the map`}
              sub="Pins for verified destinations sit on their OpenStreetMap node; the rest mark the neighbourhood, not the doorway. Click one for a preview card and a link to the full listing."
              action={
                <Link to="/map" className="btn-outline btn-sm">
                  Open full map <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="card overflow-hidden p-2">
              <LazyMap points={points} compact className="h-[360px] w-full" />
            </div>
          </div>
        </section>
      )}

      {areaEvents.length > 0 && (
        <section className="shell section">
          <SectionHeading
            eyebrow="What's on"
            title={`Events in ${area.name}`}
            action={
              <Link to="/events" className="btn-outline btn-sm">
                All events <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {areaEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {neighbours.length > 0 && (
        <section className="shell pb-16">
          <SectionHeading eyebrow="Nearby" title="Also worth checking" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {neighbours.map((a) => (
              <Link key={a.id} to={`/area/${a.slug}`} className="card card-hover flex items-center justify-between gap-3 p-4">
                <span>
                  <span className="block font-semibold text-navy-800">{a.name}</span>
                  <span className="block text-[13px] text-navy-500">
                    {plural(listings.filter((l) => l.areaId === a.id).length, 'listing')} · {a.zone} zone
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-teal-600" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
