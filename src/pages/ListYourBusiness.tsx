import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ImageIcon, Store, Trash2 } from 'lucide-react';
import { actions, selectAreas, selectCategories, useDB } from '../lib/store';
import { Field, ImageWithFallback, Select, TextArea, TextInput, useToast } from '../components/ui';
import { Note, PageHero } from '../components/Page';
import { isValidEmail } from '../lib/format';

interface Shot {
  url: string;
  name: string;
  stored: boolean;
}

const empty = {
  name: '',
  categoryId: '',
  areaId: '',
  address: '',
  description: '',
  email: '',
  phone: '',
  website: '',
};

export default function ListYourBusiness() {
  const db = useDB();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shots, setShots] = useState<Shot[]>([]);
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);

  const categories = selectCategories(db).filter((c) => c.id !== 'events');
  const areas = selectAreas(db);
  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .slice(0, 4 - shots.length)
      .map((f) => ({ url: URL.createObjectURL(f), name: f.name, stored: false }));
    setShots((s) => [...s, ...next]);
  };

  if (done) {
    return (
      <div className="shell section">
        <div className="card mx-auto max-w-2xl p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
            <CheckCircle2 className="h-7 w-7 text-teal-600" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800">{done.name} is in the review queue</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-navy-500">
            Reference <span className="font-mono text-[13px] text-navy-700">{done.id}</span>. In this demo the queue is
            the admin dashboard on this same browser — approving it publishes a live listing page you can share.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard" className="btn-primary">
              Track it in my dashboard
            </Link>
            <Link to="/admin" className="btn-outline">
              Open the admin queue
            </Link>
            <button
              className="btn-ghost"
              onClick={() => {
                setDone(null);
                setForm(empty);
                setShots([]);
              }}
            >
              List another business
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHero
        mediaKey="banner-professional-services"
        label="Karachi businesses"
        eyebrow="For businesses"
        title="List your business on Karachify"
        sub="Free in this showcase. One form, one review step, and your place gets a page with photos, timings, a map pin and a favourites button."
        trail={[{ label: 'Home', to: '/' }, { label: 'List your business' }]}
      />

      <div className="shell section">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <form
            className="card p-6 sm:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              const next: Record<string, string> = {};
              if (form.name.trim().length < 3) next.name = 'Give the exact name customers should see';
              if (!form.categoryId) next.categoryId = 'Pick the closest category';
              if (!form.areaId) next.areaId = 'Pick the area you are in';
              if (form.address.trim().length < 8) next.address = 'Add a street or landmark so people can find you';
              if (form.description.trim().length < 30) next.description = 'Write at least a sentence or two (30+ characters)';
              if (!isValidEmail(form.email)) next.email = 'We need a working email to send the decision to';
              if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 7) next.phone = 'That phone number looks too short';
              setErrors(next);
              if (Object.keys(next).length) {
                toast.push('Please fix the highlighted fields', 'error');
                return;
              }
              const sub = actions.addSubmission({
                kind: 'business',
                name: form.name.trim(),
                categoryId: form.categoryId,
                areaId: form.areaId,
                description: form.description.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.trim() || undefined,
                address: form.address.trim(),
                images: shots.filter((s) => s.stored).map((s) => s.url),
              });
              toast.push('Submitted for review — this demo does not email anyone');
              setDone({ id: sub.id, name: form.name.trim() });
            }}
          >
            <h2 className="font-display text-xl font-bold text-navy-800">Business details</h2>
            <p className="mt-1.5 text-sm text-navy-500">Fields marked with * are required.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Business name" required error={errors.name} className="sm:col-span-2">
                <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Bismark New Taj Restaurant" error={Boolean(errors.name)} />
              </Field>
              <Field label="Category" required error={errors.categoryId}>
                <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} error={Boolean(errors.categoryId)}>
                  <option value="">Choose a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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
              <Field label="Address or nearest landmark" required error={errors.address} className="sm:col-span-2">
                <TextInput value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="e.g. Shop 4, Block 5, Khyban-e-Badaban, DHA" error={Boolean(errors.address)} />
              </Field>
              <Field
                label="Description"
                required
                error={errors.description}
                hint={`${form.description.trim().length} characters — what you serve, since when, what makes it easy to visit.`}
                className="sm:col-span-2"
              >
                <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} error={Boolean(errors.description)} />
              </Field>
              <Field label="Contact email" required error={errors.email}>
                <TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="owner@example.com" error={Boolean(errors.email)} />
              </Field>
              <Field label="Phone" error={errors.phone} hint="Optional — published exactly as you type it, and badged as owner-stated until a source confirms it.">
                <TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+92 21 xxxx xxxx" error={Boolean(errors.phone)} />
              </Field>
              <Field label="Website or Instagram" className="sm:col-span-2" hint="Optional.">
                <TextInput value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" />
              </Field>
            </div>

            <div className="mt-7">
              <p className="field-label">Photos</p>
              <div className="rounded-xl border border-dashed border-navy-200 bg-mist p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                    <ImageIcon className="h-4 w-4" /> Choose images
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
                  <span className="text-[13px] text-navy-500">Up to 4 images. Free hosting cannot store uploads — see the note.</span>
                </div>
                {shots.length > 0 && (
                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {shots.map((s, i) => (
                      <li key={`${s.name}-${i}`} className="relative overflow-hidden rounded-lg border border-navy-100 bg-white">
                        <ImageWithFallback src={s.url} alt={s.name} label={s.name} wrapperClass="aspect-[4/3] w-full" />
                        <button
                          type="button"
                          aria-label={`Remove ${s.name}`}
                          className="absolute right-1.5 top-1.5 rounded-full bg-white/95 p-1 text-navy-600 shadow-card hover:text-rose-600"
                          onClick={() => setShots((list) => list.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <TextInput
                    placeholder="…or paste an image URL and press Add"
                    className="max-w-sm"
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const el = e.currentTarget;
                      const url = el.value.trim();
                      if (!/^https?:\/\//i.test(url)) {
                        setErrors((x) => ({ ...x, image: 'Enter a full https:// image link' }));
                        return;
                      }
                      setErrors((x) => {
                        const rest = { ...x };
                        delete rest.image;
                        return rest;
                      });
                      setShots((s) => [...s, { url, name: url.split('/').pop() ?? 'Photo', stored: true }]);
                      el.value = '';
                    }}
                  />
                </div>
                {errors.image && <p className="mt-2 text-[13px] font-medium text-rose-600">{errors.image}</p>}
              </div>
            </div>

            <button type="submit" className="btn-primary mt-7 w-full sm:w-auto">
              <Store className="h-4 w-4" /> Submit for review
            </button>
            <p className="mt-3 text-sm text-navy-500">
              Already listed?{' '}
              <Link to="/profile" className="link">
                Check your submissions
              </Link>{' '}
              or claim an existing page from a listing detail.
            </p>
          </form>

          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">What happens next</h2>
              <ol className="mt-3 space-y-3 text-sm text-navy-600">
                {[
                  ['Queued', 'Your entry lands in the admin review queue with status “pending”.'],
                  ['Reviewed', 'A moderator checks category, area and wording — approve or reject.'],
                  ['Published', 'Approving creates a real listing page with its own URL and map pin.'],
                  ['Managed', 'Owner accounts can edit the listing later from the dashboard.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-[12px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span>
                      <strong className="text-navy-800">{t}.</strong> {d}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <Note tone="warn">
              This build has no server. Uploaded files are previewed in the browser and then discarded; only image links
              you paste are stored. A phone number or timing entered here is published exactly as you typed it and badged
              as owner-stated — Karachify does not check it before it appears.
            </Note>
            <div className="card p-5">
              <p className="text-sm font-semibold text-navy-800">Pricing</p>
              <p className="mt-1.5 text-sm text-navy-500">
                Listings are free. No card in this build carries a "Promoted" badge, because there is no billing system to
                sell one from — the advertising page explains where such placement would sit.
              </p>
              <Link to="/advertise" className="btn-ghost btn-sm mt-3">
                See advertising options
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
