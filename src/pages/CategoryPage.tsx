import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { selectAreas, selectCategories, selectListings, useDB } from '../lib/store';
import { ListingCard } from '../components/cards';
import { ListingExplorer } from '../components/Explorer';
import { PageHero } from '../components/Page';
import { EmptyState, SectionHeading } from '../components/ui';
import { guides } from '../data/guides';

export default function CategoryPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const areaParam = params.get('area') ?? undefined;
  const db = useDB();
  const categories = selectCategories(db);
  const areas = selectAreas(db);
  const listings = selectListings(db);

  const category = categories.find((c) => c.slug === slug);
  const items = useMemo(() => (category ? listings.filter((l) => l.categoryId === category.id) : []), [listings, category]);

  if (!category) {
    return (
      <div className="shell section">
        <EmptyState
          title="That category does not exist"
          body="The link may be outdated, or the category was removed in the demo admin. Browse every category from the explore page."
          action={
            <Link to="/explore" className="btn-primary">
              Back to explore
            </Link>
          }
        />
      </div>
    );
  }

  const byGroup = categories.filter((c) => c.group === category.group && c.id !== category.id);
  const relatedGuides = guides.filter((g) => g.tag.toLowerCase().includes(category.name.split(' ')[0].toLowerCase())).slice(0, 3);
  const topAreas = areas
    .map((a) => ({ area: a, count: items.filter((l) => l.areaId === a.id).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div>
      <PageHero
        mediaKey={`banner-${category.id}`}
        label={category.name}
        eyebrow={`Category · ${category.group}`}
        title={category.name}
        sub={category.blurb}
        trail={[{ label: 'Home', to: '/' }, { label: 'Explore', to: '/explore' }, { label: category.name }]}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-navy-100">
          <span className="badge bg-white/15 text-white ring-1 ring-inset ring-white/25">
            {items.length} demo listing{items.length === 1 ? '' : 's'}
          </span>
          <Link to="/map" className="inline-flex items-center gap-1.5 font-semibold text-teal-200 hover:text-teal-100">
            <MapPin className="h-4 w-4" /> See them on the map
          </Link>
        </div>
      </PageHero>

      <section className="border-b border-navy-100 bg-white">
        <div className="shell no-scrollbar flex gap-2 overflow-x-auto py-4">
          {byGroup.map((c) => (
            <Link key={c.id} to={`/category/${c.slug}`} className="chip whitespace-nowrap">
              {c.name}
            </Link>
          ))}
          <Link to="/explore" className="chip whitespace-nowrap font-semibold text-teal-700">
            All categories <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <section className="shell section">
        <SectionHeading
          eyebrow="Browse"
          title={`Everything in ${category.name}`}
          sub="Filter by area, search inside the category, switch between grid and list, and load more as you go. All records are demo data."
        />
        <ListingExplorer
          items={items}
          defaultAreaId={areas.some((a) => a.id === areaParam) ? areaParam : undefined}
          emptyTitle={`No ${category.name.toLowerCase()} match those filters`}
          pageSize={db.settings.listingsPerPage}
        />
      </section>

      {topAreas.length > 0 && (
        <section className="bg-white py-12">
          <div className="shell">
            <SectionHeading eyebrow="Where they cluster" title={`${category.name} by area`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {topAreas.map(({ area, count }) => (
                <Link key={area.id} to={`/area/${area.slug}`} className="card card-hover flex items-center justify-between gap-3 p-4">
                  <span>
                    <span className="block font-semibold text-navy-800">{area.name}</span>
                    <span className="block text-[13px] text-navy-500">{count} listing{count === 1 ? '' : 's'} in this category</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-teal-600" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {relatedGuides.length > 0 && (
        <section className="shell section">
          <SectionHeading eyebrow="Read next" title="Guides that cover this category" />
          <div className="grid gap-5 sm:grid-cols-3">
            {relatedGuides.map((g) => (
              <Link key={g.id} to={`/guides/${g.slug}`} className="card card-hover p-5">
                <p className="eyebrow mb-1.5">{g.tag}</p>
                <p className="font-display text-[17px] font-bold text-navy-800">{g.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-navy-500">{g.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {items.filter((l) => l.featured).length > 0 && (
        <section className="shell pb-16">
          <SectionHeading eyebrow="Hand-picked" title="Start with these" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items
              .filter((l) => l.featured)
              .slice(0, 4)
              .map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
