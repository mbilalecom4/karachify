import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Megaphone,
  Moon,
  PhoneCall,
  Route,
  Send,
  Store,
  Ticket,
} from 'lucide-react';
import { actions, useDB } from '../lib/store';
import { isValidEmail, looksLikePhone } from '../lib/format';
import { Field, Select, TextArea, TextInput, useToast } from '../components/ui';
import { Note, PageHero } from '../components/Page';

const SERVICES = [
  {
    icon: Route,
    title: 'Plan your tour with us',
    body: 'Build a day-by-day route from the directory yourself in the planner — it orders stops by map distance and shows which pins are checked. A human-assisted itinerary is requested through the form below.',
    to: '/plan',
    cta: 'Open the planner',
  },
  {
    icon: CalendarDays,
    title: 'Plan your event with us',
    body: 'Weddings, conferences and launches start with the venue. Browse the event venues in the directory, then submit the event itself so it can be listed with its official tickets link.',
    to: '/category/wedding-and-event-venues',
    cta: 'Browse event venues',
  },
  {
    icon: Ticket,
    title: 'Book tickets & tables',
    body: 'Karachify does not sell tickets or hold tables, and it never invents a booking link. Event records point at the organiser’s own page; a restaurant booking goes to the venue’s published number. Ask below and the request is recorded for follow-up.',
    to: '/contact',
    cta: 'Ask us to find it',
  },
  {
    icon: Store,
    title: 'List your business',
    body: 'Add a Karachi business to the directory with its address, hours and contact details. A submission enters the review queue instead of appearing unverified on a page.',
    to: '/list-your-business',
    cta: 'Submit a business',
  },
  {
    icon: Megaphone,
    title: 'Advertise with us',
    body: 'Promoted slots sit next to organic results and are always labelled. Paid placement never changes a rating, a review or a verification badge.',
    to: '/advertise',
    cta: 'See the placements',
  },
  {
    icon: BadgeCheck,
    title: 'Claim or correct a listing',
    body: 'If a record is yours, or something on it is wrong, claim it or send the correction with the page that proves it. Corrections go through the same source check as everything else.',
    to: '/contact',
    cta: 'Contact the team',
  },
  {
    icon: Moon,
    title: 'Open 24 hours',
    body: 'The records whose own published page states round-the-clock hours, each with the hours claim and the page it came from.',
    to: '/open-now',
    cta: 'See 24-hour places',
  },
  {
    icon: PhoneCall,
    title: 'Emergency numbers',
    body: 'Rescue, police, fire, ambulance and the city helplines, with the government pages that publish each number.',
    to: '/services',
    cta: 'Open city services',
  },
];

const REQUEST_TYPES = [
  'Tour or itinerary planning',
  'Event planning',
  'Booking help (tickets or table)',
  'Listing help or correction',
  'Advertising',
  'Something else',
];

export default function OurServices() {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', service: REQUEST_TYPES[0], message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ref, setRef] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Tell us who is asking';
    if (!isValidEmail(form.email)) next.email = 'A working email address is needed';
    if (form.phone.trim() && !looksLikePhone(form.phone)) next.phone = 'That phone number does not look complete';
    if (form.message.trim().length < 12) next.message = 'A sentence or two helps — dates, group size, what you need';
    setErrors(next);
    if (Object.keys(next).length) return;
    const enquiry = actions.addEnquiry({
      kind: 'contact',
      subject: `Service request — ${form.service}`,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      message: form.message.trim(),
    });
    setRef(enquiry.id);
    toast.push('Request logged on this device', 'success');
  };

  return (
    <div>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi services"
        eyebrow="Our services"
        title="Plan it with us"
        sub="Tours, events, listings and corrections — what this build can do for you on its own, and what it can only record until a real inbox exists."
        trail={[{ label: 'Home', to: '/' }, { label: 'Our services' }]}
      />

      <section className="shell section space-y-8">
        <Note>
          <strong className="text-navy-700">What works today.</strong> The planner, the business form, the event form and
          the advertising page are self-serve and work in this browser. A request sent through the form at the bottom is
          stored on your device — it appears on your profile page — but nothing is emailed, because this build has no
          server and no inbox at the other end. That is stated on the form as well, not hidden.
        </Note>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="card flex h-full flex-col p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-3 font-display text-[16.5px] font-bold leading-snug text-navy-800">{s.title}</h2>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-navy-500">{s.body}</p>
                <Link to={s.to} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700">
                  {s.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="card p-5 sm:p-7" id="request">
          <h2 className="font-display text-2xl font-bold text-navy-800">Tell us what you need</h2>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-navy-500">
            Dates, group size or the place you have in mind are the most useful things to include. This form is the same
            local inbox used on the contact page.
          </p>

          {ref ? (
            <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-5">
              <p className="flex items-center gap-2 font-semibold text-teal-900">
                <CheckCircle2 className="h-5 w-5" /> Request logged
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-teal-900/80">
                Reference <span className="font-mono text-[12.5px]">{ref}</span>. It is stored in this browser and shown on
                your profile page. Nothing was sent — this build has no server.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/profile" className="btn-primary btn-sm">
                  Open my profile
                </Link>
                <button type="button" className="btn-outline btn-sm" onClick={() => { setRef(null); setForm({ name: '', email: '', phone: '', service: REQUEST_TYPES[0], message: '' }); }}>
                  Send another
                </button>
              </div>
            </div>
          ) : (
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
              <Field label="Your name" required error={errors.name}>
                <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" error={Boolean(errors.name)} />
              </Field>
              <Field label="Email" required error={errors.email}>
                <TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" error={Boolean(errors.email)} />
              </Field>
              <Field label="Phone (optional)" error={errors.phone}>
                <TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03xx xxxxxxx" error={Boolean(errors.phone)} />
              </Field>
              <Field label="What do you need?">
                <Select value={form.service} onChange={(e) => set('service', e.target.value)}>
                  {REQUEST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Details" required error={errors.message} className="sm:col-span-2">
                <TextArea
                  rows={4}
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="Dates, group size, places in mind — anything that makes the request specific."
                  error={Boolean(errors.message)}
                />
              </Field>
              <div className="sm:col-span-2">
                <button type="submit" className="btn-primary">
                  <Send className="h-4 w-4" /> Log the request
                </button>
                <p className="mt-2 text-[12px] text-navy-400">
                  Stored in this browser only. Nothing is emailed, and no one outside this device sees it.
                </p>
              </div>
            </form>
          )}
        </div>

        <p className="text-[13px] text-navy-500">
          Not sure whether a place is worth the trip?{' '}
          <Link to="/sources" className="link font-semibold">
            Every record says what has been checked
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
