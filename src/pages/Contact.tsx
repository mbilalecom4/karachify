import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail, MapPin, MessageSquare } from 'lucide-react';
import { actions, useDB } from '../lib/store';
import { Field, Select, TextArea, TextInput, useToast } from '../components/ui';
import { Note, PageHero, Prose } from '../components/Page';
import { isValidEmail } from '../lib/format';

export default function Contact() {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({ kind: 'general', name: '', email: '', phone: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<string | null>(null);
  const [extra, setExtra] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi skyline"
        eyebrow="Contact"
        title="Talk to the Karachify team"
        sub="Corrections, partnership questions, or a business that is missing from the directory — this is where it starts."
        trail={[{ label: 'Home', to: '/' }, { label: 'Contact' }]}
      />

      <div className="shell section">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            {sent ? (
              <div className="card p-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
                  <CheckCircle2 className="h-7 w-7 text-teal-600" />
                </span>
                <h2 className="mt-4 font-display text-2xl font-bold text-navy-800">Message logged</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-navy-500">
                  Reference <span className="font-mono text-[13px] text-navy-700">{sent}</span>. The message is stored in
                  your browser and appears in your profile — nothing is emailed, because this build has no server and no
                  inbox at the other end.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link to="/profile" className="btn-primary">
                    See my enquiries
                  </Link>
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setSent(null);
                      setExtra(false);
                      setForm({ kind: 'general', name: '', email: '', phone: '', subject: '', message: '' });
                    }}
                  >
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="card p-6 sm:p-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next: Record<string, string> = {};
                  if (form.name.trim().length < 2) next.name = 'Please give us a name to reply to';
                  if (!isValidEmail(form.email)) next.email = 'A valid email is required';
                  if (form.subject.trim().length < 4) next.subject = 'Add a short subject line';
                  if (form.message.trim().length < 20) next.message = 'Tell us a bit more (20+ characters)';
                  if (extra && !/^[+\d][\d\s-]{6,}$/.test(form.phone.trim())) next.phone = 'If you add a phone, make it a plausible number';
                  setErrors(next);
                  if (Object.keys(next).length) {
                    toast.push('Please fix the highlighted fields', 'error');
                    return;
                  }
                  const label = form.kind === 'general' ? form.subject.trim() : `${form.subject.trim()} (${form.kind})`;
                  const enq = actions.addEnquiry({
                    kind: 'contact',
                    subject: label,
                    name: form.name.trim(),
                    email: form.email.trim().toLowerCase(),
                    phone: form.phone.trim() || undefined,
                    message: form.message.trim(),
                    userId: db.sessionId ?? undefined,
                  });
                  actions.addSubmission({
                    kind: 'contact',
                    name: form.subject.trim(),
                    description: form.message.trim(),
                    email: form.email.trim().toLowerCase(),
                    phone: form.phone.trim() || undefined,
                    status: 'pending',
                  });
                  toast.push('Message saved on this device');
                  setSent(enq.id);
                }}
              >
                <h2 className="font-display text-xl font-bold text-navy-800">Send a message</h2>
                <p className="mt-1.5 text-sm text-navy-500">Every field except phone is required.</p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="What is this about?" className="sm:col-span-2">
                    <Select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                      <option value="general">General question</option>
                      <option value="correction">A listing or photo is wrong</option>
                      <option value="business">Listing my business</option>
                      <option value="event">Submitting an event</option>
                      <option value="advertise">Advertising enquiry</option>
                      <option value="press">Press or partnership</option>
                    </Select>
                  </Field>
                  <Field label="Your name" required error={errors.name}>
                    <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} error={Boolean(errors.name)} />
                  </Field>
                  <Field label="Email" required error={errors.email}>
                    <TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={Boolean(errors.email)} />
                  </Field>
                  <Field label="Phone" error={errors.phone} hint={extra ? 'Optional, but helpful for quick questions.' : 'Optional.'}>
                    <TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} error={Boolean(errors.phone)} onBlur={() => setExtra(true)} />
                  </Field>
                  <Field label="Subject" required error={errors.subject} className="sm:col-span-2">
                    <TextInput value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. Wrong closing hour for a pharmacy in Saddar" error={Boolean(errors.subject)} />
                  </Field>
                  <Field label="Message" required error={errors.message} hint={`${form.message.trim().length} characters`} className="sm:col-span-2">
                    <TextArea value={form.message} onChange={(e) => set('message', e.target.value)} error={Boolean(errors.message)} placeholder="Include the listing name or link so we can find it quickly." />
                  </Field>
                </div>

                <button type="submit" className="btn-primary mt-6">
                  <MessageSquare className="h-4 w-4" /> Send message
                </button>
              </form>
            )}

            <section className="mt-10">
              <h2 className="section-title">Other ways in</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="card p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-navy-800">
                    <Mail className="h-4 w-4 text-teal-600" /> Email
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-500">
                    No Karachify address is configured, so none is printed here. A message that needs to reach a person has
                    to go through the form above until this build is hosted with a mail service.
                  </p>
                </div>
                <div className="card p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-navy-800">
                    <MapPin className="h-4 w-4 text-teal-600" /> Office
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-500">
                    There is no street address to visit. Karachify is a static site: the pages, the data files and the
                    verification records all live in one public repository.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <Note tone="warn">
              This form is functional but local: submissions are stored in your browser so you can see the whole flow.
              There is no inbox at the other end.
            </Note>
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">Faster routes</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link to="/list-your-business" className="link">
                    Add or claim a business
                  </Link>
                </li>
                <li>
                  <Link to="/submit-event" className="link">
                    Submit an event
                  </Link>
                </li>
                <li>
                  <Link to="/advertise" className="link">
                    Advertising and promoted placement
                  </Link>
                </li>
                <li>
                  <Link to="/help" className="link">
                    Help centre and FAQ
                  </Link>
                </li>
                <li>
                  <Link to="/image-credits" className="link">
                    Report a photo attribution problem
                  </Link>
                </li>
              </ul>
            </div>
            <Prose className="card p-5">
              <h3>Reporting a factual error</h3>
              <p>
                Tell us the listing, the field that is wrong and a source — an official site, a licence notice or a recent
                photograph. The record is badged "Not verified yet" until a source is attached, rather than quietly edited
                on the strength of an email.
              </p>
            </Prose>
          </aside>
        </div>
      </div>
    </>
  );
}
