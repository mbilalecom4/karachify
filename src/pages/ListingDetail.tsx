import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bed,
  CalendarClock,
  ExternalLink,
  Heart,
  Info,
  Utensils,
  Share2,
  Star,
  GraduationCap,
  Landmark,
  MapPin,
  Navigation,
  Phone,
  ShoppingBag,
  Trees,
  Building2,
  Images,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Handshake,
} from 'lucide-react';
import type { DetailLayout, Listing } from '../types';
import { actions, prefsFor, reviewsFor, selectAreas, selectCategories, selectListings, useDB } from '../lib/store';
import { imageFor, placeholderImage } from '../lib/media';
import { categoryById } from '../data/taxonomy';
import { FeaturedBadge, ListingCard } from '../components/cards';
import { KarachifyMap } from '../components/KarachifyMap';
import { Note } from '../components/Page';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import {
  Breadcrumbs,
  EmptyState,
  Field,
  Modal,
  SectionHeading,
  Select,
  Stars,
  StatusBadge,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { coordText, copyText, directionsUrl, mapLinkUrl, isValidEmail, plural, priceLabel } from '../lib/format';

const LAYOUT_META: Record<DetailLayout, { icon: typeof Landmark; kicker: string }> = {
  attraction: { icon: Landmark, kicker: 'Visitor guide' },
  restaurant: { icon: Utensils, kicker: 'Food & drink' },
  hotel: { icon: Bed, kicker: 'Stay' },
  hospital: { icon: Info, kicker: 'Healthcare' },
  education: { icon: GraduationCap, kicker: 'Education' },
  shopping: { icon: ShoppingBag, kicker: 'Shopping' },
  park: { icon: Trees, kicker: 'Outdoors' },
  'event-venue': { icon: CalendarClock, kicker: 'Venue' },
  service: { icon: Building2, kicker: 'Service' },
  transport: { icon: Navigation, kicker: 'Transport' },
  government: { icon: BadgeCheck, kicker: 'Government' },
  emergency: { icon: Info, kicker: 'Emergency' },
  religious: { icon: Landmark, kicker: 'Faith' },
  sports: { icon: Star, kicker: 'Sport & fitness' },
};

interface GalleryFrame {
  src: string;
  caption: string;
  real: boolean;
}

function buildGallery(listing: Listing): GalleryFrame[] {
  const media = imageFor(listing.slug, listing.name);
  const frames: GalleryFrame[] = [];
  if (media.entry) {
    const who = media.entry.kind === 'related' ? `${media.entry.subject} (illustrative)` : listing.name;
    frames.push({ src: media.wide, caption: who, real: true });
    if (media.thumb !== media.wide) frames.push({ src: media.thumb, caption: `${who} — card crop`, real: true });
  }
  const extra = [
    `${listing.name} — angle 2`,
    `${listing.name} — interior`,
    categoryById.get(listing.categoryId)?.name ?? 'Karachi',
  ];
  for (const label of extra) {
    if (frames.length >= 4) break;
    frames.push({ src: placeholderImage(label, 'Photo not sourced'), caption: `${label} (placeholder)`, real: false });
  }
  return frames.slice(0, 4);
}

export default function ListingDetail() {
  const { slug = '' } = useParams();
  const db = useDB();
  const toast = useToast();
  const listings = selectListings(db);
  const categories = selectCategories(db);
  const areas = selectAreas(db);

  const listing = useMemo(() => listings.find((l) => l.slug === slug), [listings, slug]);
  useDocumentTitle(listing ? listing.name : 'Listing');
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  const nearby = useMemo(
    () =>
      listing
        ? listings
            .filter((l) => l.id !== listing.id && l.areaId === listing.areaId)
            .slice(0, 4)
            .map((l) => ({ l, distance: distance(listing, l) }))
        : [],
    [listings, listing]
  );

  const related = useMemo(
    () =>
      listing
        ? listings
            .filter((l) => l.id !== listing.id && l.categoryId === listing.categoryId)
            .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.rating ?? 0) - (a.rating ?? 0))
            .slice(0, 4)
        : [],
    [listings, listing]
  );

  const reviews = useMemo(() => (listing ? reviewsFor(db, listing.id) : []), [db, listing]);

  if (!listing) {
    return (
      <div className="shell section">
        <EmptyState
          title="Listing not found"
          body="This record may have been deleted in the demo admin, or the link is out of date. Browse the catalogue instead."
          action={
            <Link to="/explore" className="btn-primary">
              Back to explore
            </Link>
          }
        />
      </div>
    );
  }

  const category = categories.find((c) => c.id === listing.categoryId);
  const area = areas.find((a) => a.id === listing.areaId);
  const layout = (category?.detailLayout ?? 'service') as DetailLayout;
  const meta = LAYOUT_META[layout];
  const media = imageFor(listing.slug, listing.name);
  const gallery = buildGallery(listing);
  const favourites = prefsFor(db).favouriteListings;
  const isFavourite = favourites.includes(listing.id);

  return (
    <div>
      {/* ------------------------------- header ------------------------------- */}
      <section className="relative isolate overflow-hidden bg-navy-900">
        <div className="absolute inset-0 -z-10">
          <img src={media.wide} alt={listing.name} className="h-full w-full object-cover opacity-70" onError={(e) => (e.currentTarget.src = media.fallback)} />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/80 to-navy-950/40" />
        </div>
        <div className="shell pb-8 pt-8">
          <div className="[&_a]:text-teal-200 [&_span]:text-navy-200">
            <Breadcrumbs
              trail={[
                { label: 'Home', to: '/' },
                { label: category?.name ?? 'Category', to: `/category/${category?.slug ?? 'explore'}` },
                { label: listing.name },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-teal-500 text-white">{category?.name ?? 'Listing'}</span>
            <StatusBadge status={listing.status} />
            {listing.promoted && <span className="badge-promo">Promoted · demo placement</span>}
            {listing.featured && !listing.promoted && <FeaturedBadge />}
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold leading-tight text-white sm:text-[40px]">{listing.name}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-navy-100">{listing.tagline}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-navy-100">
            {listing.rating != null ? (
              <span className="inline-flex items-center gap-1.5">
                <Stars value={listing.rating} />
                <span className="text-navy-200">({plural(listing.reviewCount ?? 0, 'verified review', 'verified reviews')})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[13px] text-navy-200">
                <Star className="h-3.5 w-3.5" /> No verified rating for this place
              </span>
            )}
            <Link to={`/area/${area?.slug ?? 'areas'}`} className="inline-flex items-center gap-1.5 hover:text-teal-200">
              <MapPin className="h-4 w-4 text-teal-300" />
              {area?.name ?? 'Karachi'}, Karachi
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <meta.icon className="h-4 w-4 text-teal-300" />
              {meta.kicker}
            </span>
            {listing.priceRange && <span className="inline-flex items-center gap-1.5">{priceLabel(listing.priceRange)}</span>}
          </div>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              className={`btn btn-sm ${isFavourite ? 'bg-rose-500 text-white' : 'border border-white/40 bg-white/10 text-white hover:bg-white/20'}`}
              onClick={() => {
                const next = actions.toggleFavourite(listing.id);
                toast.push(next ? `Saved ${listing.name} to favourites` : `Removed ${listing.name} from favourites`, next ? 'success' : 'info');
              }}
            >
              <Heart className={`h-4 w-4 ${isFavourite ? 'fill-white' : ''}`} />
              {isFavourite ? 'Saved' : 'Save to favourites'}
            </button>
            <button
              className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20"
              onClick={async () => {
                const url = `${window.location.origin}${window.location.pathname}#/place/${listing.slug}`;
                if (navigator.share) {
                  try {
                    await navigator.share({ title: `${listing.name} — Karachify`, text: listing.tagline, url });
                    return;
                  } catch {
                    /* user dismissed the share sheet — fall back to copying */
                  }
                }
                try {
                  await copyText(url);
                  toast.push('Link copied to clipboard');
                } catch {
                  toast.push(`Copy this link: ${url}`, 'info');
                }
              }}
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <a className="btn btn-sm bg-teal-500 text-white hover:bg-teal-600" href={directionsUrl(listing.lat, listing.lng, listing.name)} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" /> Get directions
            </a>
            <button className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setEnquiryOpen(true)}>
              <Phone className="h-4 w-4" /> {layout === 'hotel' ? 'Booking enquiry' : 'Enquire'}
            </button>
            <button className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setClaimOpen(true)}>
              <Handshake className="h-4 w-4" /> Claim this business
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------- gallery ------------------------------- */}
      <section className="shell py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {gallery.map((f, i) => (
            <button
              key={`${f.caption}-${i}`}
              onClick={() => {
                setActive(i);
                setLightbox(true);
              }}
              className={`group relative overflow-hidden rounded-xl border border-navy-100 bg-navy-50 text-left ${i === 0 ? 'sm:col-span-2 lg:row-span-1' : ''}`}
              aria-label={`Open photo ${i + 1}: ${f.caption}`}
            >
              <span className={`block ${i === 0 ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
                <img src={f.src} alt={f.caption} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </span>
              <span className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-gradient-to-t from-navy-950/90 to-transparent px-3 py-2">
                <span className="text-[12px] font-semibold text-white">{f.caption}</span>
                <span className={`badge ${f.real ? 'bg-teal-500/85 text-white' : 'bg-amber-400/90 text-navy-900'}`}>{f.real ? 'Photo' : 'Demo'}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-navy-500">
          {media.entry ? (
            media.entry.kind === 'related' ? (
              <>
                Illustrative photograph — the image shows <em>{media.entry.subject}</em>, a Karachi scene of the same kind, not{' '}
                {listing.name}. {media.entry.artist ? `By ${media.entry.artist}` : 'Wikimedia Commons'}
                {media.entry.license ? ` · ${media.entry.license}` : ''} ·{' '}
                <a href={media.entry.filePage} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                  File page <ExternalLink className="h-3 w-3" />
                </a>
                . A photograph of this exact subject has not been sourced yet.
              </>
            ) : (
              <>
                Photograph of {listing.name} from Wikimedia Commons
                {media.entry.artist ? ` by ${media.entry.artist}` : ''}
                {media.entry.license ? ` · ${media.entry.license}` : ''} ·{' '}
                <a href={media.entry.filePage} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                  File page <ExternalLink className="h-3 w-3" />
                </a>
                . Frames marked “Demo” are designed placeholders used until a licensed photo of this exact subject is
                sourced.
              </>
            )
          ) : (
            <>No licensed photograph of this exact subject has been sourced yet, so Karachify shows a designed placeholder instead of an unrelated picture.</>
          )}
        </p>
      </section>

      {/* -------------------------------- body -------------------------------- */}
      <section className="shell pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-9">
            <article>
              <h2 className="section-title mb-3">{layout === 'attraction' ? 'History & introduction' : 'About this listing'}</h2>
              <p className="text-[15px] leading-relaxed text-navy-600">{listing.description}</p>
              {listing.tags.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {listing.tags.map((t) => (
                    <li key={t} className="chip">
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <LayoutSection listing={listing} layout={layout} category={category?.name ?? ''} />

            {listing.facilities && listing.facilities.length > 0 && (
              <article>
                <h2 className="section-title mb-3">Facilities & services</h2>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {listing.facilities.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 rounded-xl border border-navy-100 bg-white p-3 text-sm text-navy-700">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            )}

            <article>
              <h2 className="section-title mb-3">Visitor reviews</h2>
              <Note>
                Karachify does not invent reviews. Nothing appears here until a visitor actually writes one — the sample
                ratings this build used to generate have been removed, and a verified public rating appears only when a
                source for it exists.
              </Note>
              {listing.rating != null && (
                <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-navy-100 bg-white p-4">
                  <div>
                    <p className="font-display text-3xl font-extrabold text-navy-800">{listing.rating.toFixed(1)}</p>
                    <Stars value={listing.rating} showValue={false} />
                  </div>
                  <p className="text-sm text-navy-500">
                    Verified rating from {plural(listing.reviewCount ?? 0, 'recorded review', 'recorded reviews')}.
                    {listing.lastVerified && ` Checked ${listing.lastVerified}.`}
                  </p>
                </div>
              )}
              {reviews.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-navy-200 bg-navy-50/60 p-4 text-sm text-navy-500">
                  No visitor reviews yet for {listing.name}. If you have been, yours would be the first — it is stored on
                  this device until Karachify has a real review backend.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {reviews.slice(0, 8).map((r) => (
                    <li key={r.id} className="card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-navy-800">{r.author}</p>
                        <span className="flex items-center gap-2">
                          <Stars value={r.rating} showValue={false} />
                          <span className="text-[13px] text-navy-400">{r.date}</span>
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-navy-600">{r.text}</p>
                      <p className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-navy-400">
                        Written on this device
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <AddReview listingId={listing.id} name={listing.name} />
            </article>

            <LocationBlock listing={listing} area={area?.name ?? 'Karachi'} />
          </div>

          {/* ------------------------------ sidebar ------------------------------ */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">Contact & practicals</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <Row icon={<MapPin className="h-4 w-4" />} label="Address">
                  {listing.address}
                  {area && (
                    <>
                      <br />
                      <Link to={`/area/${area.slug}`} className="link">
                        Open {area.name} area page
                      </Link>
                    </>
                  )}
                  {!listing.lastVerified && (
                    <span className="mt-0.5 block text-[12px] text-navy-400">Not yet checked against an official source.</span>
                  )}
                </Row>
                <Row icon={<Phone className="h-4 w-4" />} label="Phone">
                  {listing.phone ?? <span className="text-navy-400">No published number for this record.</span>}
                </Row>
                {listing.website && (
                  <Row icon={<ExternalLink className="h-4 w-4" />} label="Website">
                    <a href={listing.website} target="_blank" rel="noopener noreferrer" className="link">
                      {listing.website.replace(/^https?:\/\//, '')}
                    </a>
                  </Row>
                )}
                <Row icon={<CalendarClock className="h-4 w-4" />} label="Opening hours">
                  {listing.hours?.length ? (
                    <>
                      <ul className="space-y-1">
                        {listing.hours.map((h) => (
                          <li key={h.day} className="flex justify-between gap-3">
                            <span className="text-navy-500">{h.day}</span>
                            <span className="font-medium text-navy-800">{h.open}</span>
                          </li>
                        ))}
                      </ul>
                      <span className="mt-1 block text-[12px] text-navy-400">
                        {listing.lastVerified ? `Checked against a source on ${listing.lastVerified}.` : 'Not verified against an official source — confirm before travelling.'}
                      </span>
                    </>
                  ) : (
                    <span className="text-navy-400">Opening hours have not been verified for this place.</span>
                  )}
                </Row>
              </dl>
              <div className="mt-4 grid gap-2">
                <a className="btn-dark btn-sm" href={directionsUrl(listing.lat, listing.lng, listing.name)} target="_blank" rel="noopener noreferrer">
                  <Navigation className="h-3.5 w-3.5" /> Get directions
                </a>
                <a className="btn-outline btn-sm" href={mapLinkUrl(listing.lat, listing.lng)} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-3.5 w-3.5" /> View on OpenStreetMap
                </a>
                <button className="btn-outline btn-sm" onClick={() => setEnquiryOpen(true)}>
                  <Phone className="h-3.5 w-3.5" /> {layout === 'hotel' ? 'Booking enquiry' : 'Send an enquiry'}
                </button>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">Verification & source</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={listing.status} />
                <span className="badge bg-navy-50 text-navy-600">{meta.kicker}</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-navy-500">
                {listing.status === 'verified'
                  ? 'Verified against the sources listed here, including coordinates and opening hours. Anything the source did not state is left blank rather than guessed.'
                  : 'This record has not been checked against an official source yet. Do not treat its address, prices or timings as fact.'}
              </p>
              {listing.sourceUrl && (
                <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-flex items-center gap-1 text-[13px]">
                  Read the source <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <p className="mt-3 text-[12px] text-navy-400">
                {listing.coordsVerified
                  ? `Map position verified via OpenStreetMap: ${coordText(listing.lat, listing.lng)}`
                  : `Approximate position, derived from the area centre — not a surveyed location: ${coordText(listing.lat, listing.lng)}`}
              </p>
              {listing.lastVerified && (
                <p className="mt-1 text-[12px] text-navy-400">Fields on this page last verified {listing.lastVerified}.</p>
              )}
              <button className="btn-outline btn-sm mt-3 w-full" onClick={() => setClaimOpen(true)}>
                <Handshake className="h-3.5 w-3.5" /> Claim this business
              </button>
            </div>
          </aside>
        </div>
      </section>

      {/* ------------------------------- nearby ------------------------------- */}
      {nearby.length > 0 && (
        <section className="bg-white py-12">
          <div className="shell">
            <SectionHeading eyebrow={`${area?.name ?? 'This area'}`} title="Nearby in the dataset" sub="Straight-line distance between the map positions recorded for each place." />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {nearby.map(({ l, distance: d }) => (
                <div key={l.id}>
                  <ListingCard listing={l} />
                  <p className="mt-1.5 text-[12px] text-navy-400">≈ {d.toFixed(1)} km away (approx.)</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="shell section">
          <SectionHeading
            eyebrow={`More in ${category?.name ?? 'this category'}`}
            title="Related listings"
            action={
              category ? (
                <Link to={`/category/${category.slug}`} className="btn-outline btn-sm">
                  Browse the category
                </Link>
              ) : undefined
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------- modals ------------------------------- */}
      <Modal open={lightbox} onClose={() => setLightbox(false)} title={gallery[active]?.caption ?? listing.name} size="lg">
        <figure>
          <img src={gallery[active]?.src} alt={gallery[active]?.caption ?? listing.name} className="w-full rounded-xl bg-navy-50" />
          <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-navy-500">
            <span>
              Photo {active + 1} of {gallery.length}
              {gallery[active]?.real && media.entry ? ` · ${media.entry.artist ?? 'Wikimedia Commons contributor'} · ${media.entry.license ?? 'licence see file page'}` : ' · designed demo placeholder'}
            </span>
            <span className="flex gap-2">
              <button className="btn-outline btn-sm" onClick={() => setActive((i) => (i - 1 + gallery.length) % gallery.length)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <button className="btn-outline btn-sm" onClick={() => setActive((i) => (i + 1) % gallery.length)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </span>
          </figcaption>
        </figure>
      </Modal>

      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        listing={listing}
        kind={layout === 'hotel' ? 'hotel-booking' : 'listing'}
      />
      <ClaimModal open={claimOpen} onClose={() => setClaimOpen(false)} listing={listing} />
    </div>
  );
}

/* ------------------------------ small pieces ------------------------------ */

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-teal-600">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[12px] font-bold uppercase tracking-wide text-navy-400">{label}</dt>
        <dd className="text-navy-700">{children}</dd>
      </div>
    </div>
  );
}

function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const s = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function LocationBlock({ listing, area }: { listing: Listing; area: string }) {
  const points = useMemo(
    () => [
      {
        id: listing.id,
        title: listing.name,
        subtitle: `${area} · approximate demo location`,
        path: `/place/${listing.slug}`,
        lat: listing.lat,
        lng: listing.lng,
        color: '#13A89E',
      },
    ],
    [listing, area]
  );
  return (
    <article>
      <h2 className="section-title mb-3">Location</h2>
      <div className="card overflow-hidden p-2">
        <KarachifyMap points={points} compact interactive className="h-[300px] w-full" />
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-navy-500">
        The pin sits at an approximate demo location so the map interactions can be demonstrated. Base map tiles are
        provided by OpenStreetMap contributors; directions open in your preferred map service.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn-outline btn-sm" href={directionsUrl(listing.lat, listing.lng, listing.name)} target="_blank" rel="noopener noreferrer">
          <Navigation className="h-3.5 w-3.5" /> Directions
        </a>
        <Link className="btn-outline btn-sm" to={`/map?focus=${listing.slug}`}>
          <Images className="h-3.5 w-3.5" /> Show on the Karachi map
        </Link>
      </div>
    </article>
  );
}

function AddReview({ listingId, name }: { listingId: string; name: string }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [rating, setRating] = useState('5');
  const [author, setAuthor] = useState('');

  return (
    <form
      className="card mt-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (author.trim().length < 2) {
          toast.push('Add your name first', 'error');
          return;
        }
        if (text.trim().length < 10) {
          toast.push('Write at least 10 characters', 'error');
          return;
        }
        actions.addReview({
          listingId,
          author: author.trim(),
          rating: Number(rating),
          date: new Date().toISOString().slice(0, 10),
          text: text.trim(),
          demo: true,
        });
        setText('');
        toast.push('Review added locally (demo data)');
      }}
    >
      <p className="font-display text-[15px] font-bold text-navy-800">Add your own sample review</p>
      <p className="mt-1 text-[13px] text-navy-500">Stored in your browser only — nothing is published or sent.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Your name" required>
          <TextInput value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Ayesha K." />
        </Field>
        <Field label="Rating">
          <Select value={rating} onChange={(e) => setRating(e.target.value)}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n > 1 ? 's' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Review" required className="mt-3">
        <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder={`What should someone know about ${name}?`} />
      </Field>
      <button type="submit" className="btn-primary btn-sm mt-3">
        Save sample review
      </button>
    </form>
  );
}

function EnquiryModal({ open, onClose, listing, kind }: { open: boolean; onClose: () => void; listing: Listing; kind: 'listing' | 'hotel-booking' }) {
  const db = useDB();
  const toast = useToast();
  const user = db.users.find((u) => u.id === db.sessionId);
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Modal open={open} onClose={onClose} title={kind === 'hotel-booking' ? `Booking enquiry — ${listing.name}` : `Enquire about ${listing.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (form.name.trim().length < 2) next.name = 'Tell them who you are';
          if (!isValidEmail(form.email)) next.email = 'Enter a valid email address';
          if (form.message.trim().length < 12) next.message = 'Add a little more detail (12+ characters)';
          setErrors(next);
          if (Object.keys(next).length) return;
          actions.addEnquiry({
            kind,
            subject: `${listing.name} — ${kind === 'hotel-booking' ? 'booking enquiry' : 'listing enquiry'}`,
            refId: listing.id,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            message: form.message.trim(),
            userId: db.sessionId ?? undefined,
          });
          actions.addSubmission({
            kind: 'contact',
            name: `${listing.name} enquiry`,
            categoryId: listing.categoryId,
            areaId: listing.areaId,
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            description: form.message.trim(),
          });
          setForm((f) => ({ ...f, message: '', phone: '' }));
          onClose();
          toast.push('Enquiry saved in this browser (demo mode — no email is sent)');
        }}
        className="space-y-4"
      >
        <Note tone="warn">
          Karachify is running without a backend in this build, so enquiries are recorded locally and appear in the
          demo admin queue. Connect Supabase plus an email provider to deliver them for real.
        </Note>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" required error={errors.name}>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={Boolean(errors.name)} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={Boolean(errors.email)} />
          </Field>
        </div>
        <Field label="Phone" hint="Optional. Include the city code if you are calling from abroad.">
          <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 …" />
        </Field>
        <Field label="Message" required error={errors.message} hint={kind === 'hotel-booking' ? 'Mention dates, room type and number of guests.' : 'Ask about availability, timings or services.'}>
          <TextArea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} error={Boolean(errors.message)} />
        </Field>
        <button type="submit" className="btn-primary">
          Save enquiry (demo)
        </button>
      </form>
    </Modal>
  );
}

function ClaimModal({ open, onClose, listing }: { open: boolean; onClose: () => void; listing: Listing }) {
  const db = useDB();
  const toast = useToast();
  const user = db.users.find((u) => u.id === db.sessionId);
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', relationship: 'Owner', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Modal open={open} onClose={onClose} title={`Claim ${listing.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (form.name.trim().length < 2) next.name = 'Your full name is required';
          if (!isValidEmail(form.email)) next.email = 'Enter a valid business email address';
          if (form.notes.trim().length < 15) next.notes = 'Explain how you are connected to this business (15+ characters)';
          setErrors(next);
          if (Object.keys(next).length) return;
          actions.addSubmission({
            kind: 'claim',
            name: `${listing.name} — ownership claim`,
            categoryId: listing.categoryId,
            areaId: listing.areaId,
            listingId: listing.id,
            email: form.email.trim(),
            description: `${form.relationship}: ${form.notes.trim()}`,
          });
          onClose();
          toast.push('Claim submitted for review (you can approve it in the demo admin)');
        }}
        className="space-y-4"
      >
        <Note>
          A real claim needs document verification — a Sindh Revenue Board or KMC registration, a utility bill or an
          authorised letterhead. This demo only records the request in the admin queue.
        </Note>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" required error={errors.name}>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={Boolean(errors.name)} />
          </Field>
          <Field label="Business email" required error={errors.email}>
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={Boolean(errors.email)} />
          </Field>
        </div>
        <Field label="Your relationship to this listing">
          <Select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
            {['Owner', 'Manager', 'Marketing', 'Family member', 'Legal representative'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Notes for the review team" required error={errors.notes}>
          <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} error={Boolean(errors.notes)} />
        </Field>
        <button type="submit" className="btn-primary">
          Submit claim (demo)
        </button>
      </form>
    </Modal>
  );
}

/* -------------------------- category-intelligent bits ------------------------- */

function LayoutSection({ listing, layout, category }: { listing: Listing; layout: DetailLayout; category: string }) {
  const hash = [...listing.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  const pick = <T,>(arr: T[], n: number, offset = 0) => Array.from({ length: n }, (_, i) => arr[(hash + offset + i) % arr.length]);

  if (layout === 'restaurant') {
    const menu = [
      { item: listing.cuisine?.[0] ? `${listing.cuisine[0]} signature` : 'House signature dish', price: 'PKR 850', note: 'demo' },
      { item: 'Breakfast plate', price: 'PKR 650', note: 'demo' },
      { item: 'Sharing platter (2–3 people)', price: 'PKR 2,400', note: 'demo' },
      { item: 'Chai & mithai', price: 'PKR 250', note: 'demo' },
    ];
    return (
      <article>
        <h2 className="section-title mb-3">Food & prices</h2>
        {listing.cuisine?.length ? (
          <div className="flex flex-wrap gap-2">
            {listing.cuisine.map((c) => (
              <span key={c} className="chip">
                <Utensils className="h-3.5 w-3.5 text-teal-600" /> {c}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-3 text-sm text-navy-500">
          Price band: <strong className="text-navy-800">{listing.priceRange ?? 'Demo'}</strong> · {priceLabel(listing.priceRange)}
        </p>
        <h3 className="mt-5 font-display font-bold text-navy-800">Sample menu</h3>
        <ul className="mt-2 divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100 bg-white">
          {menu.map((m) => (
            <li key={m.item} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-navy-700">{m.item}</span>
              <span className="whitespace-nowrap text-sm font-semibold text-navy-800">
                {m.price} <span className="text-[11px] font-normal uppercase text-amber-600">demo</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-navy-500">Menu items and prices are invented for this showcase.</p>
      </article>
    );
  }

  if (layout === 'hotel') {
    const rooms = ['Standard double', 'Deluxe twin', 'Executive suite', 'Family room'];
    return (
      <article>
        <h2 className="section-title mb-3">Rooms & rates</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {pick(rooms, 4).map((r, i) => (
            <div key={r + i} className="card p-4">
              <p className="flex items-center gap-2 font-semibold text-navy-800">
                <Bed className="h-4 w-4 text-teal-600" /> {r}
              </p>
              <p className="mt-1 text-sm text-navy-500">
                From <strong className="text-navy-800">PKR {(12 + i * 6) * 10000 - (i % 2) * 5000}</strong>{' '}
                <span className="text-[11px] uppercase text-amber-600">demo rate</span> per night
              </p>
              <ul className="mt-2 space-y-1 text-[13px] text-navy-500">
                <li>Air conditioning, backup power</li>
                <li>Breakfast {i % 2 ? 'included' : 'available'}</li>
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-navy-500">Room types and rates are invented for this showcase; use the booking enquiry button to see how the flow works.</p>
      </article>
    );
  }

  if (layout === 'hospital') {
    const departments = ['Emergency & trauma', 'Medicine', 'Surgery', 'Paediatrics', 'Obstetrics', 'Cardiology', 'Orthopaedics', 'Diagnostic imaging'];
    return (
      <article>
        <h2 className="section-title mb-3">Departments & access</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {pick(departments, 6).map((d, i) => (
            <div key={d + i} className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3 text-sm">
              <span className="text-navy-700">{d}</span>
              <span className="badge bg-navy-50 text-navy-600">Demo</span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Note tone="warn">
            Karachify does not publish live bed, ambulance or waiting-time status. Confirm emergency availability by
            phone with the hospital directly.
          </Note>
        </div>
      </article>
    );
  }

  if (layout === 'education') {
    return (
      <article>
        <h2 className="section-title mb-3">Programmes & admissions</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {['Undergraduate', 'Postgraduate', 'Evening / weekend', 'Short certifications'].map((p, i) => (
            <li key={p} className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3 text-sm">
              <span className="text-navy-700">{p}</span>
              <span className="text-[12px] uppercase text-amber-600">{i % 2 ? 'demo' : 'sample'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-navy-500">
          Fee structures, intake dates and programme lists are illustrative — always check the institution&apos;s own
          admissions office.
        </p>
      </article>
    );
  }

  if (layout === 'attraction') {
    return (
      <article>
        <h2 className="section-title mb-3">Visitor information</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { t: 'Getting there', d: 'Rideshare and route-hailing work door to door; the area around most landmarks has limited parked-car space on weekends.' },
            { t: 'Best time', d: 'October to March is comfortable. Monsoon afternoons and May heat both change the plan.' },
            { t: 'Costs', d: 'Ticket and parking prices in this listing are demo values until verified.' },
          ].map((b) => (
            <div key={b.t} className="card p-4">
              <p className="font-display font-bold text-navy-800">{b.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-500">{b.d}</p>
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (layout === 'shopping') {
    return (
      <article>
        <h2 className="section-title mb-3">What you will find</h2>
        <p className="text-[15px] leading-relaxed text-navy-600">
          {listing.facilities?.length
            ? listing.facilities.slice(0, 6).join(' · ')
            : 'Mixed retail, food court and services floors.'}
        </p>
        <p className="mt-2 text-sm text-navy-500">
          Brand mixes and sale calendars change constantly; treat {category.toLowerCase()} details here as a starting
          point and confirm before travelling across the city.
        </p>
      </article>
    );
  }

  return (
    <article>
      <h2 className="section-title mb-3">Practical notes</h2>
      <ul className="space-y-2 text-[15px] leading-relaxed text-navy-600">
        <li className="flex gap-2.5">
          <Info className="mt-1 h-4 w-4 shrink-0 text-teal-600" />
          <span>
            {listing.address} — in {listing.tags[0] ? `${listing.tags[0].toLowerCase()}, ` : ''}Karachi. Access and
            entry details on this page are demo values.
          </span>
        </li>
        <li className="flex gap-2.5">
          <CalendarClock className="mt-1 h-4 w-4 shrink-0 text-teal-600" />
          <span>
            {(listing.hours?.[0]?.open ?? 'No published timings in this record')} — verify before you rely on it,
            especially on Fridays and public holidays.
          </span>
        </li>
      </ul>
    </article>
  );
}
