import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  ExternalLink,
  Clock3,
  MapPin,
  Share2,
  Ticket,
  UserRound,
  Heart,
  Navigation,
} from 'lucide-react';
import { actions, prefsFor, selectAreas, selectEvents, useDB } from '../lib/store';
import { imageFor } from '../lib/media';
import { EventCard } from '../components/cards';
import { KarachifyMap } from '../components/KarachifyMap';
import { Note } from '../components/Page';
import { Breadcrumbs, EmptyState, Field, Modal, SectionHeading, StatusBadge, TextArea, TextInput, useToast } from '../components/ui';
import { coordText, dateRange, isValidEmail, plural, timeRange, toICS } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export default function EventDetail() {
  const { slug = '' } = useParams();
  const db = useDB();
  const toast = useToast();
  const events = selectEvents(db);
  const areas = selectAreas(db);

  const event = events.find((e) => e.slug === slug);
  useDocumentTitle(event ? event.name : 'Event');
  const [registerOpen, setRegisterOpen] = useState(false);
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
          body="This event may have been removed in the demo admin. The full board is still browsable by date, area and type."
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
    toast.push('Calendar file downloaded (sample event)');
  };

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-navy-900">
        <div className="absolute inset-0 -z-10">
          <img src={media.wide} alt={event.name} className="h-full w-full object-cover opacity-65" onError={(e) => (e.currentTarget.src = media.fallback)} />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/85 to-navy-950/50" />
        </div>
        <div className="shell pb-9 pt-8">
          <div className="[&_a]:text-teal-200 [&_span]:text-navy-200">
            <Breadcrumbs trail={[{ label: 'Home', to: '/' }, { label: 'Events', to: '/events' }, { label: event.name }]} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-teal-500 text-white">{event.eventCategory}</span>
            <StatusBadge status={event.status} />
            {past && <span className="badge bg-navy-100 text-navy-700">Past event</span>}
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold leading-tight text-white sm:text-[40px]">{event.name}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-navy-100">{event.description}</p>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-navy-100">
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
            <button className="btn btn-sm bg-teal-500 text-white hover:bg-teal-600" onClick={() => setRegisterOpen(true)}>
              <UserRound className="h-4 w-4" /> {past ? 'Register interest' : 'Register / enquire'}
            </button>
            <button
              className={`btn btn-sm ${saved ? 'bg-rose-500 text-white' : 'border border-white/40 bg-white/10 text-white hover:bg-white/20'}`}
              onClick={() => {
                const next = actions.toggleSavedEvent(event.id);
                toast.push(next ? 'Event saved to your list' : 'Event removed from your list', next ? 'success' : 'info');
              }}
            >
              <Heart className={`h-4 w-4 ${saved ? 'fill-white' : ''}`} /> {saved ? 'Saved' : 'Save event'}
            </button>
            <button className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={downloadICS}>
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </button>
            <button
              className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20"
              onClick={async () => {
                const url = `${window.location.origin}${window.location.pathname}#/events/${event.slug}`;
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
            <a className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20" href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}&travelmode=driving`} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" /> Directions to venue
            </a>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-8">
            <div>
              <Note tone="warn">
                This is <strong>sample programming</strong> created for the Karachify showcase. The name, date, venue
                and ticket price are not a real event, and no tickets are sold here.
              </Note>
            </div>

            <article>
              <h2 className="section-title mb-3">About this event</h2>
              <p className="text-[15px] leading-relaxed text-navy-600">{event.description}</p>
              <h3 className="mt-5 font-display text-lg font-bold text-navy-800">Who is running it</h3>
              <p className="mt-1 text-[15px] text-navy-600">
                Listed organiser: <strong className="text-navy-800">{event.organiser}</strong> (demo value).
              </p>
            </article>

            <article>
              <h2 className="section-title mb-3">Tickets</h2>
              <div className="card divide-y divide-navy-100">
                {[
                  { tier: 'General admission', price: event.ticketPrice, note: event.ticketNote },
                  { tier: 'Group of 4+', price: 'PKR 6,000', note: 'Demo tier — sample discount logic.' },
                  { tier: 'Student (with ID)', price: 'PKR 1,200', note: 'Demo tier.' },
                ].map((t) => (
                  <div key={t.tier} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold text-navy-800">{t.tier}</p>
                      <p className="text-[13px] text-navy-500">{t.note}</p>
                    </div>
                    <p className="font-display font-bold text-navy-800">
                      {t.price} <span className="text-[11px] font-semibold uppercase text-amber-600">demo</span>
                    </p>
                  </div>
                ))}
              </div>
              <button className="btn-primary mt-4" onClick={() => setRegisterOpen(true)}>
                <UserRound className="h-4 w-4" /> Reserve / ask a question
              </button>
              <p className="mt-2 text-[13px] text-navy-500">
                Payment is not connected. In production this block would link to a ticketing provider API.
              </p>
            </article>

            <article>
              <h2 className="section-title mb-3">Venue & location</h2>
              <div className="card overflow-hidden p-2">
                <KarachifyMap
                  compact
                  className="h-[320px] w-full"
                  points={[
                    {
                      id: event.id,
                      title: event.venue,
                      subtitle: `${area?.name ?? 'Karachi'} · approximate demo location`,
                      path: `/events/${event.slug}`,
                      lat: event.lat,
                      lng: event.lng,
                      color: '#102A43',
                    },
                  ]}
                />
              </div>
              <p className="mt-2 text-[13px] text-navy-500">
                Approximate demo coordinates: {coordText(event.lat, event.lng)}. {area && (
                  <Link to={`/area/${area.slug}`} className="link">
                    See what else is in {area.name}
                  </Link>
                )}
              </p>
            </article>

            <article>
              <h2 className="section-title mb-3">Photo</h2>
              <figure>
                <img src={media.wide} alt={event.name} className="w-full rounded-xl border border-navy-100" onError={(e) => (e.currentTarget.src = media.fallback)} />
                <figcaption className="mt-2 text-[13px] text-navy-500">
                  {media.entry ? (
                    <>
                      Karachi-related image via Wikimedia Commons
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
                Dates on this board are rebased against today so the upcoming tab always has something to show — that
                is a demo convenience, not a real calendar.
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
            <SectionHeading eyebrow="You might also like" title="Similar sample events" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </div>
        </section>
      )}

      <RegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} eventId={event.id} name={event.name} slug={event.slug} />
    </div>
  );
}

function RegisterModal({ open, onClose, eventId, name, slug }: { open: boolean; onClose: () => void; eventId: string; name: string; slug: string }) {
  const db = useDB();
  const toast = useToast();
  const user = db.users.find((u) => u.id === db.sessionId);
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', seats: '2', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Modal open={open} onClose={onClose} title={`Register interest — ${name}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (form.name.trim().length < 2) next.name = 'Your name is required';
          if (!isValidEmail(form.email)) next.email = 'Enter a valid email address';
          const seats = Number(form.seats);
          if (!Number.isFinite(seats) || seats < 1 || seats > 20) next.seats = 'Choose between 1 and 20 seats';
          setErrors(next);
          if (Object.keys(next).length) return;
          actions.addEnquiry({
            kind: 'event-registration',
            subject: `${name} — registration interest (${seats} seats)`,
            refId: eventId,
            name: form.name.trim(),
            email: form.email.trim(),
            message: form.message.trim() || `${seats} seats requested on the demo event page #${slug}.`,
            userId: db.sessionId ?? undefined,
          });
          setForm({ ...form, message: '' });
          onClose();
          toast.push('Registration saved locally (demo mode)');
        }}
      >
        <Note tone="warn">
          No ticketing service is connected to this build, so this form records the request in your browser and in the
          demo admin queue only.
        </Note>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name}>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={Boolean(errors.name)} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={Boolean(errors.email)} />
          </Field>
        </div>
        <Field label="Seats" required error={errors.seats}>
          <TextInput type="number" min={1} max={20} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} error={Boolean(errors.seats)} />
        </Field>
        <Field label="Anything the organiser should know?" hint="Optional.">
          <TextArea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </Field>
        <button type="submit" className="btn-primary">
          Submit registration (demo)
        </button>
      </form>
    </Modal>
  );
}
