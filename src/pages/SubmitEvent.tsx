import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CheckCircle2 } from 'lucide-react';
import { actions, selectAreas, useDB } from '../lib/store';
import { Field, Select, TextArea, TextInput, useToast } from '../components/ui';
import { Note, PageHero } from '../components/Page';
import { isValidEmail } from '../lib/format';
import type { EventCategory } from '../types';

export const EVENT_CATEGORIES: EventCategory[] = [
  'Concerts',
  'Festivals',
  'Exhibitions',
  'Sports',
  'Conferences',
  'Workshops',
  'Food Festivals',
  'Family',
  'Cultural',
  'Community',
  'Theatre',
  'Religious',
];

const today = () => new Date().toISOString().slice(0, 10);

export default function SubmitEvent() {
  const db = useDB();
  const toast = useToast();
  const areas = selectAreas(db);
  const [form, setForm] = useState({
    name: '',
    eventCategory: '',
    areaId: '',
    venue: '',
    date: today(),
    endDate: '',
    startTime: '17:00',
    endTime: '21:00',
    ticketPrice: 'Free',
    organiser: '',
    email: '',
    phone: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (done) {
    return (
      <div className="shell section">
        <div className="card mx-auto max-w-2xl p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
            <CheckCircle2 className="h-7 w-7 text-teal-600" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800">“{done.name}” is awaiting review</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-navy-500">
            Reference <span className="font-mono text-[13px] text-navy-700">{done.id}</span>. No event is published
            automatically — a moderator has to approve it, because invented dates presented as real events are worse
            than no event at all.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/profile" className="btn-primary">
              My submissions
            </Link>
            <button className="btn-ghost" onClick={() => setDone(null)}>
              Submit another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHero
        mediaKey="banner-events"
        label="Karachi events"
        eyebrow="Organisers"
        title="Submit an event in Karachi"
        sub="Concert, exhibition, cricket clinic, food festival or community mela — tell us the who, where and when and it goes into the review queue."
        trail={[{ label: 'Home', to: '/' }, { label: 'Events', to: '/events' }, { label: 'Submit an event' }]}
      />

      <div className="shell section">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <form
            className="card p-6 sm:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              const next: Record<string, string> = {};
              if (form.name.trim().length < 4) next.name = 'Use the full event title';
              if (!form.eventCategory) next.eventCategory = 'Pick the type of event';
              if (!form.areaId) next.areaId = 'Pick where it is happening';
              if (form.venue.trim().length < 4) next.venue = 'Name the venue or ground';
              if (!form.date) next.date = 'Choose the start date';
              if (form.endDate && form.endDate < form.date) next.endDate = 'The end date cannot be before the start date';
              if (form.endTime <= form.startTime) next.endTime = 'The finish time must be after the start time';
              if (form.organiser.trim().length < 3) next.organiser = 'Who is running it?';
              if (!isValidEmail(form.email)) next.email = 'We need an email to confirm details';
              if (form.description.trim().length < 40) next.description = 'Give visitors at least two sentences (40+ characters)';
              setErrors(next);
              if (Object.keys(next).length) {
                toast.push('Please fix the highlighted fields', 'error');
                return;
              }
              const sub = actions.addSubmission({
                kind: 'event',
                name: form.name.trim(),
                categoryId: 'events',
                areaId: form.areaId,
                description: `${form.description.trim()}\n\nVenue: ${form.venue.trim()} · ${form.date}${
                  form.endDate ? ` → ${form.endDate}` : ''
                } · ${form.startTime}–${form.endTime} · Tickets: ${form.ticketPrice} · Organiser: ${form.organiser.trim()}`,
                email: form.email.trim().toLowerCase(),
                phone: form.phone.trim() || undefined,
                address: form.venue.trim(),
              });
              toast.push('Event submitted for review');
              setDone({ id: sub.id, name: form.name.trim() });
            }}
          >
            <h2 className="font-display text-xl font-bold text-navy-800">Event details</h2>
            <p className="mt-1.5 text-sm text-navy-500">Be precise — this is what appears on the public page.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Event title" required error={errors.name} className="sm:col-span-2">
                <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Karachi Literature Festival — Evening Reading" error={Boolean(errors.name)} />
              </Field>
              <Field label="Event type" required error={errors.eventCategory}>
                <Select value={form.eventCategory} onChange={(e) => set('eventCategory', e.target.value)} error={Boolean(errors.eventCategory)}>
                  <option value="">Choose a type…</option>
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Area" required error={errors.areaId}>
                <Select value={form.areaId} onChange={(e) => set('areaId', e.target.value)} error={Boolean(errors.areaId)}>
                  <option value="">Choose an area…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Venue" required error={errors.venue} className="sm:col-span-2">
                <TextInput value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. Beach Road, Do Darya" error={Boolean(errors.venue)} />
              </Field>
              <Field label="Start date" required error={errors.date}>
                <TextInput type="date" value={form.date} min={today()} onChange={(e) => set('date', e.target.value)} error={Boolean(errors.date)} />
              </Field>
              <Field label="End date" error={errors.endDate} hint="Leave empty for a single-day event.">
                <TextInput type="date" value={form.endDate} min={form.date} onChange={(e) => set('endDate', e.target.value)} error={Boolean(errors.endDate)} />
              </Field>
              <Field label="Start time" required>
                <TextInput type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
              </Field>
              <Field label="End time" required error={errors.endTime}>
                <TextInput type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} error={Boolean(errors.endTime)} />
              </Field>
              <Field label="Ticket price" hint="Say “Free”, a PKR amount, or “Donation”.">
                <TextInput value={form.ticketPrice} onChange={(e) => set('ticketPrice', e.target.value)} />
              </Field>
              <Field label="Organiser" required error={errors.organiser}>
                <TextInput value={form.organiser} onChange={(e) => set('organiser', e.target.value)} placeholder="Name of the group or venue" error={Boolean(errors.organiser)} />
              </Field>
              <Field label="Contact email" required error={errors.email}>
                <TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" error={Boolean(errors.email)} />
              </Field>
              <Field label="Contact phone" hint="Optional.">
                <TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+92 21 xxxx xxxx" />
              </Field>
              <Field label="Description" required error={errors.description} hint={`${form.description.trim().length} characters`} className="sm:col-span-2">
                <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What happens, who it suits, how to get in, accessibility…" error={Boolean(errors.description)} />
              </Field>
            </div>

            <button type="submit" className="btn-primary mt-7 w-full sm:w-auto">
              <CalendarPlus className="h-4 w-4" /> Submit event for review
            </button>
          </form>

          <aside className="space-y-4">
            <Note tone="warn">
              Every event already in this showcase is clearly badged “Sample event”. Approved submissions will appear the
              same way until a real organiser source is attached to them.
            </Note>
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">Before you submit</h2>
              <ul className="mt-3 space-y-2 text-sm text-navy-600">
                <li>Check the date is in the future.</li>
                <li>Use the venue name people actually search for.</li>
                <li>Mention ticketing honestly — “free entry” only if it truly is.</li>
                <li>One submission per event; updates can be sent later.</li>
              </ul>
            </div>
            <div className="card p-5">
              <p className="text-sm font-semibold text-navy-800">Looking for a place to hold it?</p>
              <p className="mt-1.5 text-sm text-navy-500">Browse venues, grounds and halls already mapped in Karachi.</p>
              <Link to="/category/event-venues" className="btn-outline mt-4 w-full">
                Event venues
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
