import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  ExternalLink,
  Clock3,
  MapPin,
  Share2,
  Ticket,
  Heart,
  Navigation,
} from 'lucide-react';
import { actions, prefsFor, selectAreas, selectEvents, useDB } from '../lib/store';
import { failToPlaceholder, imageFor, pictureSubject } from '../lib/media';
import { EventCard } from '../components/cards';
import { LazyMap } from '../components/LazyMap';
import { Note } from '../components/Page';
import { Breadcrumbs, EmptyState, IllustrativeStamp, SectionHeading, StatusBadge, useToast } from '../components/ui';
import { coordText, dateRange, timeRange, toICS } from '../lib/format';
import { shareUrl } from '../lib/pageMeta';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export default function EventDetail() {
  const { slug = '' } = useParams();
  const db = useDB();
  const toast = useToast();
  const events = selectEvents(db);
  const areas = selectAreas(db);

  const event = events.find((e) => e.slug === slug);
  useDocumentTitle(event ? event.name : 'Event');
  const past = event ? event.date < new Date().toISOString().slice(0, 10) : false;

  const similar = useMemo(
    () =>
      event
        ? events
            .filter((e) => e.id !== event.id && (e.eventCategory === event.eventCategory || e.areaId === event.areaId))
            .slice(0, 3)
        : [],
    [events, event]
  );

  if (!event) {
    return (
      <div className="shell section">
        <EmptyState
          title="Event not found"
          body="The event board ships empty, so this page can only have come from one created locally in the admin panel — and it may have been deleted since. The board is still browsable by date, area and type."
          action={
            <Link to="/events" className="btn-primary">
              Back to events
            </Link>
          }
        />
      </div>
    );
  }

  const media = imageFor(event.slug, event.name);
  const area = areas.find((a) => a.id === event.areaId);
  const saved = prefsFor(db).savedEvents.includes(event.id);

  const downloadICS = () => {
    const blob = new Blob(
      [toICS({ title: event.name, description: event.description, location: `${event.venue}, Karachi`, date: event.date, endDate: event.endDate, startTime: event.startTime, endTime: event.endTime })],
      { type: 'text/calendar' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.slug}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.push('Calendar file downloaded');
  };

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-navy-900">
        <div className="absolute inset-0 -z-10">
          <img {...media.wideImg('hero')} alt={media.entry ? pictureSubject(media.entry) : event.name} decoding="async" className="h-full w-full object-cover" onError={(e) => failToPlaceholder(e.currentTarget, media.fallback)} />
          <div className="media-scrim-flat absolute inset-0" />
        </div>
        <span className="absolute right-4 top-20 z-10">
          <IllustrativeStamp entry={media.entry} />
        </span>
        <div className="shell pb-9 pt-8">
          <div className="max-w-4xl rounded-[28px] bg-navy-900 p-6 shadow-lift sm:p-7">
          <div className="[&_a]:text-teal-200 [&_a:hover]:text-white [&_span]:text-navy-100">
            <Breadcrumbs trail={[{ label: 'Home', to: '/' }, { label: 'Events', to: '/events' }, { label: event.name }]} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-teal-700 text-white">{event.eventCategory}</span>
            <StatusBadge status={event.status} className="bg-white text-navy-800 ring-1 ring-inset ring-navy-200" />
            {past && <span className="badge bg-navy-100 text-navy-700">Past event</span>}
          </div>
          <h1 className="on-media mt-3 max-w-3xl font-display text-[clamp(1.8rem,4.4vw,2.6rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[40px]">{event.name}</h1>
          <p className="on-media mt-3 max-w-2xl text-[16px] leading-relaxed text-white">{event.description}</p>
          <dl className="on-media mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-300" />
              <div>
                <dt className="sr-only">Date</dt>
                <dd className="font-semibold text-white">{dateRange(event.date, event.endDate)}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-teal-300" />
              <div>
                <dt className="sr-only">Time</dt>
                <dd className="font-semibold text-white">{timeRange(event.startTime, event.endTime)}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-teal-300" />
              <div>
                <dt className="sr-only">Venue</dt>
                <dd className="font-semibold text-white">
                  {event.venue}
                  {area ? `, ${area.name}` : ''}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-teal-300" />
              <div>
                <dt className="sr-only">Tickets</dt>
                <dd className="font-semibold text-white">{event.ticketPrice}</dd>
              </div>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {event.sourceUrl && (
              <a
                className="btn btn-sm bg-teal-700 text-white hover:bg-teal-800"
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" /> Event source
              </a>
            )}
            <button
              className={`btn btn-sm ${saved ? 'bg-rose-500 text-white' : 'bg-white text-navy-900 hover:bg-navy-50'}`}
              onClick={() => {
                const next = actions.toggleSavedEvent(event.id);
                toast.push(next ? 'Event saved to your list' : 'Event removed from your list', next ? 'success' : 'info');
              }}
            >
              <Heart className={`h-4 w-4 ${saved ? 'fill-white' : ''}`} /> {saved ? 'Saved' : 'Save event'}
            </button>
            <button className="btn btn-sm btn-on-media" onClick={downloadICS}>
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </button>
            <button
              className="btn btn-sm btn-on-media"
              onClick={async () => {
                const url = shareUrl(`/events/${event.slug}`);
                if (navigator.share) {
                  try {
                    await navigator.share({ title: event.name, text: event.description, url });
                    return;
                  } catch {
                    /* dismissed — copy instead */
                  }
                }
                try {
                  await navigator.clipboard.writeText(url);
                  toast.push('Event link copied');
                } catch {
                  toast.push(`Copy this link: ${url}`, 'info');
                }
              }}
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <a className="btn btn-sm btn-on-media" href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}&travelmode=driving`} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" /> Directions to venue
            </a>
          </div>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-8">
            <div>
              <Note tone={event.status === 'verified' ? 'info' : 'warn'}>
                {event.status === 'verified' ? (
                  <>
                    This event is dated against the source that announced it —{' '}
                    <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                      {event.sourceUrl} <ExternalLink className="h-3 w-3" />
                    </a>
                    . Karachify sells no tickets and takes no registrations; book through the organiser.
                  </>
                ) : (
                  <>
                    This event was <strong>published from a submission</strong>, not from a source we checked. The date,
                    venue and price are what the submitter wrote. Karachify sells no tickets and takes no registrations —
                    confirm with the organiser before you travel.
                  </>
                )}
              </Note>
            </div>

            <article>
              <h2 className="section-title mb-3">About this event</h2>
              <p className="text-[15px] leading-relaxed text-navy-600">{event.description}</p>
              <h3 className="mt-5 font-display text-lg font-bold text-navy-800">Who is running it</h3>
              <p className="mt-1 text-[15px] text-navy-600">
                Stated organiser: <strong className="text-navy-800">{event.organiser}</strong>
                {event.organiser === 'Not stated' ? ' — the submission did not name one.' : '.'}
              </p>
            </article>

            <article>
              <h2 className="section-title mb-3">Tickets</h2>
              <div className="card divide-y divide-navy-100">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold text-navy-800">As published by the source</p>
                    <p className="text-[13px] text-navy-500">{event.ticketNote}</p>
                  </div>
                  <p className="font-display font-bold text-navy-800">{event.ticketPrice}</p>
                </div>
              </div>
              <p className="mt-2 text-[13px] text-navy-500">
                Karachify lists the one price its source stated and invents no tiers. Payment is not connected to this
                site — buy from the organiser.
              </p>
            </article>

            <article>
              <h2 className="section-title mb-3">Venue & location</h2>
              <div className="card overflow-hidden p-2">
                <LazyMap
                  compact
                  className="h-[320px] w-full"
                  points={[
                    {
                      id: event.id,
                      title: event.venue,
                      subtitle: `${area?.name ?? 'Karachi'} · locality centre, not a doorway`,
                      path: `/events/${event.slug}`,
                      lat: event.lat,
                      lng: event.lng,
                      color: '#0A6A63',
                    },
                  ]}
                />
              </div>
              <p className="mt-2 text-[13px] text-navy-500">
                Approximate position, derived from the venue area centre: {coordText(event.lat, event.lng)}. {area && (
                  <Link to={`/area/${area.slug}`} className="link">
                    See what else is in {area.name}
                  </Link>
                )}
              </p>
            </article>

            <article>
              <h2 className="section-title mb-3">Photo</h2>
              <figure>
                <img {...media.wideImg('figure')} alt={media.entry ? pictureSubject(media.entry) : event.name} loading="lazy" decoding="async" className="w-full rounded-xl border border-navy-100" onError={(e) => failToPlaceholder(e.currentTarget, media.fallback)} />
                <figcaption className="mt-2 text-[13px] text-navy-500">
                  {media.entry ? (
                    <>
                      {media.entry.kind === 'related'
                        ? `Illustrative photograph — shows ${pictureSubject(media.entry)}, a like-for-like Karachi picture, not this event. `
                        : `Photograph of ${event.name} `}
                      via Wikimedia Commons
                      {media.entry.artist ? ` · ${media.entry.artist}` : ''}
                      {media.entry.license ? ` · ${media.entry.license}` : ''} ·{' '}
                      <a href={media.entry.filePage} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                        File page <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  ) : (
                    'No suitable photograph for this subject yet — Karachify shows a designed placeholder instead of an unrelated picture.'
                  )}
                </figcaption>
              </figure>
            </article>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">Event details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                {[
                  { t: 'Date', d: dateRange(event.date, event.endDate) },
                  { t: 'Time', d: timeRange(event.startTime, event.endTime) },
                  { t: 'Venue', d: event.venue },
                  { t: 'Area', d: area?.name ?? 'Karachi' },
                  { t: 'Type', d: event.eventCategory },
                  { t: 'Organiser', d: event.organiser },
                  { t: 'Tickets', d: `${event.ticketPrice} — ${event.ticketNote}` },
                ].map((r) => (
                  <div key={r.t} className="flex justify-between gap-3 border-b border-navy-50 pb-2 last:border-0">
                    <dt className="text-[12px] font-bold uppercase tracking-wide text-navy-400">{r.t}</dt>
                    <dd className="text-right text-navy-700">{r.d}</dd>
                  </div>
                ))}
              </dl>
              <Note className="mt-4">
                A date here is never shifted to keep the event looking upcoming. When it passes, the entry simply moves to
                the past list, and Karachify sells no tickets for it either way.
              </Note>
            </div>
            <div className="card p-5">
              <p className="font-display text-[17px] font-bold text-navy-800">Find a venue for your own event</p>
              <p className="mt-1 text-sm text-navy-500">Wedding halls, lawns, convention centres and auditoriums in the dataset.</p>
              <Link to="/category/wedding-and-event-venues" className="btn-outline btn-sm mt-3">
                Browse event venues
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="bg-white py-12">
          <div className="shell">
            <SectionHeading eyebrow="You might also like" title="Similar events" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

