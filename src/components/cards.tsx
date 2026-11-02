import { Link } from 'react-router-dom';
import { Heart, MapPin, Star, Ticket, Clock3, ArrowRight, ShieldCheck, Image } from 'lucide-react';
import type { Area, Category, CityEvent, Guide, Listing } from '../types';
import { areaImageKey, imageFor, pictureSubject, type MediaEntry } from '../lib/media';
import { actions, prefsFor, useDB } from '../lib/store';
import { IllustrativeStamp, useToast } from './ui';
import { CategoryIcon } from '../lib/icons';
import { admissionLabel, dateRange, plural, priceLabel, timeRange } from '../lib/format';
import { areaById, categoryById } from '../data/taxonomy';

/* ------------------------------- badges ---------------------------------- */

/** The label is editable in the admin settings, so every badge reads it from there. */
export function FeaturedBadge() {
  const db = useDB();
  return <span className="badge-featured">{db.settings.featuredBadgeLabel}</span>;
}

/* ------------------------------- favourite ------------------------------ */

export function FavouriteButton({
  listingId,
  name,
  className = 'absolute right-3 top-3 z-10',
}: {
  listingId: string;
  name: string;
  className?: string;
}) {
  const db = useDB();
  const toast = useToast();
  const on = prefsFor(db).favouriteListings.includes(listingId);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      className={`${className} flex h-9 w-9 items-center justify-center rounded-full border border-navy-100 bg-white/95 shadow-card transition-transform hover:scale-105`}
      onClick={() => {
        const next = actions.toggleFavourite(listingId);
        toast.push(next ? `Saved ${name} to your favourites` : `Removed ${name} from favourites`, next ? 'success' : 'info');
      }}
    >
      <Heart className={`h-4 w-4 ${on ? 'fill-rose-500 text-rose-500' : 'text-navy-500'}`} />
    </button>
  );
}

/* ------------------------------ listing ------------------------------- */

/** Small opaque stamp on the photo itself: what a reader of a travel card reads first. */
function MediaStamp({ listing }: { listing: Listing }) {
  if (listing.status === 'verified')
    return (
      <span className="chip-solid">
        <ShieldCheck className="h-3.5 w-3.5 text-teal-300" />
        Source-verified
      </span>
    );
  if (listing.coordsVerified)
    return (
      <span className="chip-light">
        <MapPin className="h-3.5 w-3.5 text-teal-600" />
        Mapped pin · details unchecked
      </span>
    );
  return <span className="chip-light">Not verified yet</span>;
}

export function ListingCard({
  listing,
  view = 'grid',
  showArea = true,
}: {
  listing: Listing;
  view?: 'grid' | 'list';
  showArea?: boolean;
}) {
  const media = imageFor(listing.slug, listing.name);
  const category = categoryById.get(listing.categoryId);
  const area = areaById.get(listing.areaId);

  const meta = (
    <>
      <span className="inline-flex items-center gap-1 truncate">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600" />
        {showArea ? area?.name ?? 'Karachi' : 'Karachi'}
      </span>
      {listing.rating != null ? (
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {listing.rating.toFixed(1)}
          {listing.reviewCount != null && (
            <span className="text-navy-400">({plural(listing.reviewCount, 'verified review', 'verified reviews')})</span>
          )}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-navy-400">
          <Star className="h-3.5 w-3.5" />
          Rating not verified
        </span>
      )}
      {admissionLabel(listing.entryFees) ?? (listing.priceRange && <span>{priceLabel(listing.priceRange)}</span>)}
    </>
  );

  if (view === 'list') {
    return (
      <article className="card card-hover relative flex flex-col gap-4 overflow-hidden p-0 sm:flex-row">
        <Link to={`/place/${listing.slug}`} className="block shrink-0 sm:w-64" aria-label={`View ${listing.name}`}>
          <ImageBlock media={media} alt={listing.name} className="h-44 w-full sm:h-full" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryPill category={category} />
            {listing.promoted && <span className="badge-promo">Promoted · demo</span>}
            {listing.featured && !listing.promoted && <FeaturedBadge />}
          </div>
          <h3 className="text-[19px] font-bold leading-snug tracking-[-0.01em]">
            <Link to={`/place/${listing.slug}`} className="hover:text-teal-700">
              {listing.name}
            </Link>
          </h3>
          <p className="line-clamp-2 text-[14px] leading-relaxed text-navy-500">{listing.description}</p>
          <IllustrativeCaption entry={media.entry} name={listing.name} />
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[13px] text-navy-500">{meta}</div>
        </div>
        <FavouriteButton listingId={listing.id} name={listing.name} />
      </article>
    );
  }

  return (
    <article className="card card-hover relative flex flex-col overflow-hidden">
      <Link to={`/place/${listing.slug}`} className="group relative block" aria-label={`View ${listing.name}`}>
        <ImageBlock media={media} alt={listing.name} className="aspect-[3/2] w-full" />
        <span className="absolute inset-x-3 bottom-3">
          <MediaStamp listing={listing} />
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill category={category} />
          {listing.promoted && <span className="badge-promo">Promoted · demo</span>}
          {listing.featured && !listing.promoted && <FeaturedBadge />}
        </div>
        <h3 className="text-[17px] font-bold leading-snug tracking-[-0.01em]">
          <Link to={`/place/${listing.slug}`} className="hover:text-teal-700">
            {listing.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-[14px] leading-relaxed text-navy-500">{listing.tagline || listing.description}</p>
        <IllustrativeCaption entry={media.entry} name={listing.name} />
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[13px] text-navy-500">{meta}</div>
      </div>
      <FavouriteButton listingId={listing.id} name={listing.name} />
    </article>
  );
}

function ImageBlock({ media, alt, className }: { media: ReturnType<typeof imageFor>; alt: string; className?: string }) {
  return (
    <span className={`block overflow-hidden bg-navy-50 ${className}`}>
      <img
        src={media.thumb}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.04]"
        onError={(e) => {
          if (media.fallback && e.currentTarget.src !== media.fallback) e.currentTarget.src = media.fallback;
        }}
      />
    </span>
  );
}

/** A 'related' picture depicts a different Karachi scene, so the card says
 *  which one rather than letting the photo imply it shows this place. */
function IllustrativeCaption({ entry, name }: { entry?: MediaEntry; name: string }) {
  if (entry?.kind !== 'related') return null;
  return (
    <p className="flex items-start gap-1.5 text-[11px] font-medium leading-snug text-navy-500">
      <Image className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>Photo shows {pictureSubject(entry)} — a like-for-like Karachi picture, not {name} itself.</span>
    </p>
  );
}

function CategoryPill({ category }: { category?: Category }) {  if (!category) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-navy-600">
      <CategoryIcon name={category.icon} className="h-3.5 w-3.5 text-teal-600" />
      {category.name}
    </span>
  );
}

/* -------------------------------- event -------------------------------- */

export function EventCard({ event, view = 'grid' }: { event: CityEvent; view?: 'grid' | 'list' }) {
  const media = imageFor(event.slug, event.name);
  const area = areaById.get(event.areaId);
  const d = new Date(`${event.date}T00:00:00`);
  const day = Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PK', { day: '2-digit' });
  const month = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PK', { month: 'short' });

  const shell = view === 'list' ? 'card card-hover relative flex flex-col overflow-hidden sm:flex-row' : 'card card-hover relative flex flex-col overflow-hidden';

  return (
    <article className={shell}>
      <Link
        to={`/events/${event.slug}`}
        className={`block overflow-hidden bg-navy-50 ${view === 'list' ? 'sm:w-56 sm:shrink-0' : ''}`}
        aria-label={`View ${event.name}`}
      >
        <span className={`block ${view === 'list' ? 'h-44 w-full sm:h-full' : 'aspect-[16/10] w-full'}`}>
          <img
            src={media.thumb}
            alt={event.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.04]"
            onError={(e) => {
              if (media.fallback && e.currentTarget.src !== media.fallback) e.currentTarget.src = media.fallback;
            }}
          />
        </span>
      </Link>
      <span className={`absolute left-3 top-3 z-10 flex flex-col items-center justify-center rounded-xl bg-white/95 px-3 py-2 text-center shadow-card`}>
        <span className="text-[17px] font-extrabold leading-none text-navy-800">{day}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{month}</span>
      </span>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-navy-50 text-navy-700">{event.eventCategory}</span>
          {event.status !== 'verified' && (
            <span className="badge-demo">{event.status === 'demo' ? 'Sample event' : 'Not verified yet'}</span>
          )}
        </div>
        <h3 className="text-[17px] font-bold leading-snug">
          <Link to={`/events/${event.slug}`} className="hover:text-teal-700">
            {event.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-navy-500">{event.description}</p>
        <ul className="mt-auto space-y-1 pt-1 text-[13px] text-navy-500">
          <li className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-teal-600" />
            {dateRange(event.date, event.endDate)} · {timeRange(event.startTime, event.endTime)}
          </li>
          <li className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-teal-600" />
            {event.venue}
            {area ? `, ${area.name}` : ''}
          </li>
          <li className="flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5 text-teal-600" />
            {event.ticketPrice}
          </li>
        </ul>
        <Link to={`/events/${event.slug}`} className="btn-outline btn-sm mt-2 self-start">
          View details
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

/* -------------------------------- area --------------------------------- */

export function AreaCard({ area, count }: { area: Area; count: number }) {
  const media = imageFor(areaImageKey(area.id), area.name);
  return (
    <Link to={`/area/${area.slug}`} className="card card-hover group flex h-auto flex-col overflow-hidden p-0">
      {/* An aspect box instead of a fixed pixel height: a fixed height plus
          object-cover is what sliced the roofline off these photos. */}
      <span className="relative block aspect-[4/3] overflow-hidden bg-navy-50 sm:aspect-[16/10]">
        <img
          src={media.thumb}
          alt={`${area.name}, Karachi`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { if (media.fallback && e.currentTarget.src !== media.fallback) e.currentTarget.src = media.fallback; }}
        />
      </span>
      <span className="flex flex-1 items-center justify-between gap-3 bg-navy-800 px-4 py-3">
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold text-white">{area.name}</span>
          <span className="mt-0.5 block text-[13px] font-medium text-navy-100">{area.zone} zone · {plural(count, 'listing')}</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-white transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

/* ------------------------------- category ------------------------------- */

/** The Events section is populated by event records, not listings, so its tile must not read "0 places". */
export function categoryTileCounts(c: Category, listings: Listing[], events: CityEvent[]) {
  return c.id === 'events'
    ? { count: events.length, unit: ['event', 'events'] as [string, string] }
    : { count: listings.filter((l) => l.categoryId === c.id).length };
}

/**
 * A tile that reads "0 places" advertises an empty shelf, so grids drop it. The
 * route still resolves — this only stops us pointing at sections with nothing
 * behind them yet.
 */
export function populatedCategoryTiles(categories: Category[], listings: Listing[], events: CityEvent[]) {
  return categories
    .map((c) => ({ category: c, ...categoryTileCounts(c, listings, events) }))
    .filter((t) => t.count > 0);
}

export function CategoryCard({
  category,
  count,
  unit = ['place', 'places'],
}: {
  category: Category;
  count: number;
  unit?: [string, string];
}) {
  const media = imageFor(`banner-${category.id}`, category.name);
  return (
    <Link to={`/category/${category.slug}`} className="card card-hover group flex h-auto flex-col overflow-hidden p-0">
      <span className="relative block aspect-[4/3] overflow-hidden bg-navy-50 sm:aspect-[16/10]">
        <img
          src={media.thumb}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { if (media.fallback && e.currentTarget.src !== media.fallback) e.currentTarget.src = media.fallback; }}
        />
      </span>
      <span className="flex flex-1 items-center gap-3 bg-navy-800 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700">
          <CategoryIcon name={category.icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="font-display text-[15px] font-bold leading-snug text-white">{category.name}</span>
          <span className="mt-0.5 block text-[12px] font-semibold text-navy-100">{plural(count, unit[0], unit[1])}</span>
        </span>
      </span>
    </Link>
  );
}

/* -------------------------------- guide -------------------------------- */

export function GuideCard({ guide }: { guide: Guide }) {
  const media = imageFor(`guide-${guide.slug}`, guide.title);
  return (
    <Link to={`/guides/${guide.slug}`} className="card card-hover group flex flex-col overflow-hidden">
      <span className="relative block aspect-[16/9] overflow-hidden bg-navy-50">
        <img
          src={media.thumb}
          alt={guide.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { if (media.fallback && e.currentTarget.src !== media.fallback) e.currentTarget.src = media.fallback; }}
        />
        <span className="absolute bottom-2.5 right-2.5">
          <IllustrativeStamp entry={media.entry} />
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-teal-700">
          {guide.tag} · {guide.readMinutes} min read
        </span>
        <span className="font-display text-[17px] font-bold leading-snug text-navy-800 group-hover:text-teal-700">{guide.title}</span>
        <span className="line-clamp-2 text-sm leading-relaxed text-navy-500">{guide.excerpt}</span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-navy-700">
          Read guide <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </Link>
  );
}
