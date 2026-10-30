import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PhoneCall } from 'lucide-react';
import { selectCategories, selectListings, useDB } from '../lib/store';
import { CategoryCard } from '../components/cards';
import { ListingExplorer } from '../components/Explorer';
import { Note, PageHero } from '../components/Page';
import { EmptyState, SectionHeading } from '../components/ui';

/** The header's "Services" page: every Essentials category in one browser. */
export default function ServicesHub() {
  const db = useDB();
  const categories = selectCategories(db);
  const listings = selectListings(db);
  const essential = categories.filter((c) => c.group === 'Essentials' || c.group === 'City Life');
  const items = useMemo(() => listings.filter((l) => essential.some((c) => c.id === l.categoryId)), [listings, essential]);
  const emergency = listings.filter((l) => l.categoryId === 'emergency');

  return (
    <div>
      <PageHero
        mediaKey="banner-professional-services"
        label="Services in Karachi"
        eyebrow="City services"
        title="Services, essentials and everyday help"
        sub="Healthcare, education, transport, government offices, emergency numbers and the professional services a Karachi household actually calls."
        trail={[{ label: 'Home', to: '/' }, { label: 'Services' }]}
      />

      <section className="shell section">
        <SectionHeading eyebrow="Pick a service" title="Service categories" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {essential.map((c) => (
            <CategoryCard key={c.id} category={c} count={listings.filter((l) => l.categoryId === c.id).length} />
          ))}
        </div>
      </section>

      {emergency.length > 0 && (
        <section className="bg-white py-10">
          <div className="shell">
            <SectionHeading
              eyebrow="Before you need it"
              title="Emergency services"
              sub="Numbers and coverage areas in this demo are illustrative. Confirm the current numbers with official sources before relying on them."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {emergency.slice(0, 6).map((l) => (
                <Link key={l.id} to={`/place/${l.slug}`} className="card card-hover flex items-start gap-3 p-4">
                  <PhoneCall className="mt-1 h-5 w-5 shrink-0 text-rose-500" />
                  <span>
                    <span className="block font-display font-bold text-navy-800">{l.name}</span>
                    <span className="block text-[13px] text-navy-500">{l.phone ?? 'Number not published'}</span>
                    <span className="mt-1 block text-sm text-navy-600">{l.tagline}</span>
                  </span>
                </Link>
              ))}
            </div>
            <div className="mt-5">
              <Note tone="warn">
                These are demo records. Never store a real emergency contact in a showcase dataset — for production this
                block should be sourced from the Sindh government and Rescue 1122 published numbers and reviewed
                monthly.
              </Note>
            </div>
          </div>
        </section>
      )}

      <section className="shell section">
        {items.length === 0 ? (
          <EmptyState title="No service listings yet" body="Every listing was removed from the demo data. Reset the demo dataset from the admin settings to restore it." />
        ) : (
          <ListingExplorer items={items} emptyTitle="No service listing matches those filters" pageSize={db.settings.listingsPerPage} />
        )}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/list-your-business" className="btn-primary btn-sm">
            List your service business <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link to="/map" className="btn-outline btn-sm">
            Find services on the map
          </Link>
        </div>
      </section>
    </div>
  );
}
