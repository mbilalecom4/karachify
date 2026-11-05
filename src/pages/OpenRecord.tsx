import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, ExternalLink, Flag, Mail, MapPin, Phone, ShieldAlert, Globe } from 'lucide-react';
import { areaById, categoryById } from '../data/taxonomy';
import { humanTag, openToListing, osmIdOf, useOpenRecord } from '../lib/openRecords';
import { imgAttrs, mediaFor } from '../lib/media';
import { coordText } from '../lib/format';
import { applyPageMeta, metaForMissing, metaForOpenRecord } from '../lib/pageMeta';
import { Breadcrumbs, EmptyState, StatusBadge } from '../components/ui';
import { ReportModal } from '../components/ReportModal';

/**
 * One record from the OpenStreetMap dump.
 *
 * This page is deliberately plainer than a curated listing page: there are no
 * checked opening hours to table and nothing to rate. What it does have is the
 * map record itself and a running account of which of its fields came from
 * where. A photograph appears only for the handful of records whose own map
 * entry links to an article, and whose Commons file is named for the place —
 * everything else keeps the gap visibly empty.
 */
export default function OpenRecord() {
  const { categoryId = '', slug = '' } = useParams();
  const { record, missing, failed, retry } = useOpenRecord(categoryId, slug);
  const [reporting, setReporting] = useState(false);

  const category = categoryById.get(categoryId);

  /* MetaManager keeps no head for this path — the name behind it lives in a tier
     file rather than the bundle — so the page writes its own once it knows what
     it found. A read that failed says nothing at all: the record is not missing,
     it is unread, and the head must not claim otherwise. */
  useEffect(() => {
    if (record) applyPageMeta(metaForOpenRecord(record));
    else if (missing) applyPageMeta(metaForMissing(`/directory/${categoryId}/${slug}`, 'open record'));
  }, [record, missing, categoryId, slug]);
  const trail = [
    { label: 'Home', to: '/' },
    { label: 'Wider directory', to: '/directory' },
    { label: category?.name ?? 'Category', to: `/directory#category-${categoryId}` },
  ];

  if (missing || failed || !record) {
    return (
      <div className="shell section">
        <div className="mx-auto max-w-2xl">
          <Breadcrumbs trail={trail} />
          {failed ? (
            <EmptyState
              title="That record could not be loaded"
              body="An open record is read from the slice of 200 that holds its name, served next to the site. A dropped connection is enough to miss it, and nothing is shown in its place rather than a remembered copy."
              action={
                <button className="btn-outline" onClick={retry}>
                  Try again
                </button>
              }
            />
          ) : (
            <EmptyState
              title="No open record with that address"
              body="No slice of this category holds a record with that name. It may have been mapped since this dump was taken, or the link may have been typed by hand."
              action={
                <Link to="/directory" className="btn-primary">
                  Back to the wider directory
                </Link>
              }
            />
          )}
        </div>
      </div>
    );
  }

  const area = areaById.get(record.areaId);
  const listing = openToListing(record);
  const photo = mediaFor(`open:${categoryId}:${slug}`);
  const osm = osmIdOf(record.sourceUrl);
  const facts: { label: string; value: string; href?: string; icon: typeof MapPin }[] = [];
  if (record.phone) facts.push({ label: 'Phone', value: record.phone, href: `tel:${record.phone.replace(/[^\d+]/g, '')}`, icon: Phone });
  if (record.website) facts.push({ label: 'Website', value: record.website.replace(/^https?:\/\//, ''), href: record.website, icon: Globe });
  if (record.email) facts.push({ label: 'Email', value: record.email, href: `mailto:${record.email}`, icon: Mail });
  if (record.hours?.length)
    facts.push({ label: 'Opening hours', value: record.hours.map((h) => `${h.day}: ${h.open}`).join(' · '), icon: Clock });
  if (record.facilities?.length) facts.push({ label: 'Amenities', value: record.facilities.join(', '), icon: MapPin });

  return (
    <div className="shell section">
      <div className="mx-auto max-w-3xl">
        <div className="[&_a]:text-teal-200 [&_a:hover]:text-white [&_span]:text-navy-100">
          <Breadcrumbs trail={[...trail, { label: record.name }]} />
        </div>

        <div className="rounded-[28px] bg-navy-900 p-6 shadow-lift sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-teal-700 text-white">{category?.name ?? 'Open record'}</span>
            <StatusBadge status={listing.status} coordsVerified={listing.coordsVerified} className="bg-white text-navy-800 ring-1 ring-inset ring-navy-200" />
          </div>
          <h1 className="mt-3 font-display text-[clamp(1.7rem,4.2vw,2.4rem)] font-extrabold leading-[1.12] tracking-[-0.03em] text-white">
            {record.name}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white">
            {record.subcategory ? `Tagged “${humanTag(record.subcategory)}” in ${area?.name ?? 'Karachi'}, Karachi.` : `In ${area?.name ?? 'Karachi'}, Karachi.`}
          </p>
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-navy-950/60 p-3 text-[13px] leading-relaxed text-navy-100">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              Nobody at Karachify has been to this place, phoned it, or opened its own page. Everything below is what a volunteer mapper
              recorded in OpenStreetMap, read on {record.retrievedAt ?? record.createdAt}. It may be out of date, misnamed, or describe a
              building that no longer trades.
            </span>
          </p>
        </div>

        {photo && (
          <figure className="card mt-6 overflow-hidden p-0">
            <img
              {...imgAttrs(photo, photo.wide ?? photo.thumb, 'figure')}
              alt={`${record.name}, photographed for Wikimedia Commons`}
              loading="lazy"
              decoding="async"
              className="h-[clamp(190px,30vw,320px)] w-full object-cover"
            />
            <figcaption className="px-4 py-3 text-[12.5px] leading-relaxed text-navy-500">
              Photograph from Wikimedia Commons
              {photo.artist ? ` by ${photo.artist}` : ''}
              {photo.license ? ` · ${photo.license}` : ''}
              {photo.via === 'Wikimedia Commons'
                ? ' · found by searching Commons for this name'
                : photo.via
                  ? ` · found in the article “${photo.via}”, which the map record links to`
                  : ''} ·{' '}
              <a href={photo.filePage} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
                file page
              </a>
              . Karachify did not take this picture and has not stood at this address; the photograph is shown because the file is named
              for this place, not because the place was checked.
            </figcaption>
          </figure>
        )}

        <section className="card mt-6 p-5 sm:p-6">
          <h2 className="font-display text-[19px] font-bold text-navy-800">Where it is</h2>
          <p className="mt-2 flex items-start gap-2 text-[15px] text-navy-700">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-teal-600" />
            <span>{record.address || 'No address recorded on the map.'}</span>
          </p>
          <p className="mt-2 text-[14px] text-navy-500">{coordText(record.lat, record.lng)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={record.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm inline-flex items-center gap-1.5"
            >
              OpenStreetMap record {osm ? `· ${osm}` : ''} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={`https://www.openstreetmap.org/?mlat=${record.lat}&mlon=${record.lng}#map=17/${record.lat}/${record.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm inline-flex items-center gap-1.5"
            >
              View the surrounding map <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {record.wikipedia && (
              <a
                href={`https://en.wikipedia.org/wiki/${record.wikipedia.replace(/^en:/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline btn-sm inline-flex items-center gap-1.5"
              >
                Wikipedia <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {record.wikidata && (
              <a
                href={`https://www.wikidata.org/wiki/${record.wikidata}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline btn-sm inline-flex items-center gap-1.5"
              >
                Wikidata <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <p className="mt-3 text-[12.5px] text-navy-400">
            {record.licence ?? 'OpenStreetMap contributors'} · this record was added to the map before Karachify read it, and Karachify
            cannot say when.
          </p>
        </section>

        {facts.length > 0 ? (
          <section className="card mt-4 p-5 sm:p-6">
            <h2 className="font-display text-[19px] font-bold text-navy-800">What the map record carries</h2>
            <ul className="mt-3 divide-y divide-navy-100">
              {facts.map((f) => (
                <li key={f.label} className="flex items-start gap-3 py-3">
                  <f.icon className="mt-1 h-4 w-4 shrink-0 text-teal-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold uppercase tracking-wide text-navy-400">{f.label}</span>
                    {f.href ? (
                      <a
                        href={f.href}
                        target={f.href.startsWith('http') ? '_blank' : undefined}
                        rel="noopener noreferrer nofollow"
                        className="block break-words text-[15px] font-semibold text-teal-700 hover:text-teal-800"
                      >
                        {f.value}
                      </a>
                    ) : (
                      <span className="block break-words text-[15px] text-navy-700">{f.value}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-navy-500">
              These were typed into OpenStreetMap by a contributor. Karachify has not rung the number or opened the website to see whether
              they still belong to this place.
            </p>
          </section>
        ) : (
          <section className="card mt-4 p-5 sm:p-6">
            <h2 className="font-display text-[19px] font-bold text-navy-800">What the map record carries</h2>
            <p className="mt-2 text-[15px] text-navy-600">
              A name and a position, and nothing else. No phone number, website, opening hour or price is shown here because none was
              recorded — the space is left empty rather than filled with something plausible.
            </p>
          </section>
        )}

        <section className="card mt-4 p-5 sm:p-6">
          <h2 className="font-display text-[19px] font-bold text-navy-800">What has not been checked</h2>
          <ul className="mt-3 space-y-1.5 text-[14.5px] text-navy-600">
            <li>That this place exists, or exists under this name</li>
            <li>That it is open, or open at the hours shown</li>
            <li>Any rating, review count or price band — none is published, because none was sourced</li>
            <li>Whether the phone, website or email still belongs to it</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-outline btn-sm inline-flex items-center gap-1.5" onClick={() => setReporting(true)}>
              <Flag className="h-3.5 w-3.5" /> Report a problem with this record
            </button>
            {category && (
              <Link to={`/category/${category.slug}`} className="btn-ghost btn-sm">
                Browse {category.name}
              </Link>
            )}
            {area && <Link to={`/area/${area.slug}`} className="btn-ghost btn-sm">More in {area.name}</Link>}
          </div>
        </section>
      </div>

      <ReportModal open={reporting} onClose={() => setReporting(false)} listing={listing} />
    </div>
  );
}
