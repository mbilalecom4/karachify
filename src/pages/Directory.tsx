import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Database, ExternalLink, MapPin, ShieldAlert } from 'lucide-react';
import { areaById, categories as allCategories } from '../data/taxonomy';
import { selectListings, useDB } from '../lib/store';
import { openAsListings, useOpenRecords, useTierSummary, withoutCheckedDuplicates } from '../lib/openRecords';
import { ListingExplorer } from '../components/Explorer';
import { PageHero, Note } from '../components/Page';
import { EmptyState, SectionHeading, SkeletonGrid } from '../components/ui';

/**
 * The wider directory: everything the OpenStreetMap dump knows about Karachi,
 * published as it is. It is one file per category, fetched only when a category
 * is opened, so the page paints from a 7 KB summary rather than 7 MB of records.
 */
export default function Directory() {
  const { categoryId: chosen = '' } = useParams();
  const db = useDB();
  const tier = useTierSummary();
  const open = useOpenRecords(chosen || undefined, Boolean(chosen));
  const curated = selectListings(db);

  const rows = tier.data?.categories ?? [];
  const active = rows.find((c) => c.id === chosen) ?? null;
  const category = allCategories.find((c) => c.id === chosen);

  /* The checked pages own their place; a dump record that duplicates one would
     otherwise offer a second, worse page for the same beach. */
  const listings = useMemo(
    () => (open.data ? withoutCheckedDuplicates(openAsListings(open.data), curated) : []),
    [open.data, curated]
  );

  const areas = useMemo(() => {
    const t = tier.data?.areas ?? [];
    return t.map((a) => ({ ...a, area: areaById.get(a.id) })).filter((a) => a.area);
  }, [tier.data]);

  /* An open record's trail links back to its tile as /directory#category-x.
     HashRouter swallows that second fragment and the tiles only exist once the
     summary has arrived, so the jump has to be made by hand. */
  useEffect(() => {
    if (!tier.data) return;
    const id = window.location.hash.match(/#(category-[\w-]+)$/)?.[1];
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [tier.data]);

  return (
    <div>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi"
        eyebrow="Wider map"
        title="The wider Karachi directory"
        sub="Every place OpenStreetMap has mapped in this city, published without a check. This is a discovery list, not a recommendation."
        trail={[{ label: 'Home', to: '/' }, { label: 'Directory' }]}
      />

      <section className="shell section">
        {tier.failed ? (
          <EmptyState
            title="The directory counts could not be loaded"
            body="They come from a small file served next to the site. The curated pages under Explore do not need it and still work."
            action={
              <button className="btn-outline" onClick={tier.retry}>
                Try again
              </button>
            }
          />
        ) : !tier.data ? (
          <SkeletonGrid count={6} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-5">
                <p className="eyebrow">Records here</p>
                <p className="mt-1 font-display text-[30px] font-extrabold leading-none text-navy-800">
                  {tier.data.total.toLocaleString()}
                </p>
                <p className="mt-1.5 text-[13.5px] text-navy-500">
                  across {rows.length} categories of the city
                  {tier.data.alreadyChecked > 0 &&
                    ` · ${tier.data.alreadyChecked} of them describe a place that already has a checked page, so the tiles below leave those out`}
                </p>
              </div>
              <div className="card p-5">
                <p className="eyebrow">Checked by hand</p>
                <p className="mt-1 font-display text-[30px] font-extrabold leading-none text-navy-800">{curated.length}</p>
                <p className="mt-1.5 text-[13.5px] text-navy-500">the rest of this page has not been opened by anyone at Karachify</p>
              </div>
              <div className="card p-5">
                <p className="eyebrow">Read from the map on</p>
                <p className="mt-1 font-display text-[22px] font-extrabold leading-tight text-navy-800">{tier.data.retrievedAt}</p>
                <p className="mt-1.5 text-[13.5px] text-navy-500">{tier.data.licence}</p>
              </div>
            </div>

            <Note tone="warn" className="mt-5">
              <span className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  A record on this page means a volunteer put a point or a building outline on OpenStreetMap and gave it a name. It does
                  not mean Karachify has been there, phoned it, or confirmed it still trades. Nothing here carries a star rating, a review
                  count or a written description, because no source supplied one — a phone number or opening hour appears only when the map
                  record itself held it, and it is labelled as unconfirmed.
                </span>
              </span>
            </Note>

            <div className="mt-6 flex flex-wrap gap-2">
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm inline-flex items-center gap-1.5">
                OpenStreetMap copyright <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm inline-flex items-center gap-1.5">
                ODbL licence <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Link to="/sources" className="btn-ghost btn-sm inline-flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" /> How Karachify uses sources
              </Link>
            </div>

            <div className="mt-12">
              <SectionHeading
                eyebrow="Choose a category"
                title="What is in the dump"
                sub="Opening one fetches that category alone — the largest is a few hundred kilobytes compressed, and nothing else is downloaded."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((c) => {
                const cat = allCategories.find((x) => x.id === c.id);
                const on = c.id === chosen;
                return (
                  <Link
                    key={c.id}
                    to={`/directory/${c.id}`}
                    id={`category-${c.id}`}
                    className={`card card-hover flex items-center justify-between gap-3 p-4 ${on ? 'ring-2 ring-teal-600' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-navy-800">{cat?.name ?? c.id}</span>
                      <span className="block text-[13px] text-navy-500">
                        {c.unchecked.toLocaleString()} place{c.unchecked === 1 ? '' : 's'}
                        {c.withContact > 0 && ` · ${c.withContact.toLocaleString()} with a phone or website`}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-teal-600" />
                  </Link>
                );
              })}
            </div>

            <div className="mt-14">
              <SectionHeading
                eyebrow="Or start from a neighbourhood"
                title="Records by area"
                sub="Pick a category above to browse these by name. The area pages themselves only carry the records Karachify has checked."
              />
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map((a) => (
                <li key={a.id} className="card flex items-center justify-between gap-3 px-4 py-3">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
                    <span className="truncate text-[15px] font-semibold text-navy-800">{a.area!.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[13px] text-navy-500">{a.count.toLocaleString()} mapped</span>
                    <Link to={`/area/${a.area!.slug}`} className="text-[13px] font-semibold text-teal-700 hover:text-teal-800">
                      checked pages
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {chosen && (
        <section className="bg-white py-12">
          <div className="shell">
            <SectionHeading
              eyebrow="Open records"
              title={category?.name ?? 'This category'}
              sub="Every name below is a map feature, not a reviewed business. The stamp on each card says the same thing."
            />
            {open.failed ? (
              <EmptyState
                title="That category did not load"
                body="The file sits next to the site and a dropped connection is enough to miss it. Nothing is shown in its place."
                action={
                  <button className="btn-outline" onClick={open.retry}>
                    Try again
                  </button>
                }
              />
            ) : open.data ? (
              <ListingExplorer items={listings} pageSize={db.settings.listingsPerPage} showArea />
            ) : (
              <SkeletonGrid count={8} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
