import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Megaphone, Sparkles, Store, Tag } from 'lucide-react';
import { actions, selectAreas, selectListings, useDB } from '../lib/store';
import { Field, Select, TextArea, TextInput, useToast } from '../components/ui';
import { Note, PageHero } from '../components/Page';
import { isValidEmail } from '../lib/format';

const packages = [
  {
    name: 'Owner-edited listing',
    price: 'Free',
    real: 'Working today — submit a claim from any listing page',
    best: 'Any Karachi business whose page needs correcting',
    features: ['Full listing with gallery and map pin', 'Category and area placement', 'Editable from the owner dashboard'],
    tone: 'border-navy-100',
  },
  {
    name: 'Featured place',
    price: 'Not priced yet',
    real: 'No payment is taken, quoted or invoiced anywhere on this site',
    best: 'Restaurants, hotels and venues with something to announce',
    features: ['Featured badge on category and area pages', 'Slot in the homepage featured strip', 'Priority in “recommended” sorting'],
    tone: 'border-teal-300',
  },
  {
    name: 'Promoted placement',
    price: 'Not priced yet',
    real: 'A price would be agreed by email before anything runs — never invented here',
    best: 'Seasonal campaigns, once there is measured traffic to sell against',
    features: ['“Promoted” label on the card, never a disguised one', 'Enquiry form so we can agree scope and cost first', 'Monthly impression summary'],
    tone: 'border-navy-200',
  },
];

export default function Advertise() {
  const db = useDB();
  const toast = useToast();
  const listings = selectListings(db);
  const areas = selectAreas(db);
  const [form, setForm] = useState({ business: '', package: 'featured', area: '', email: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<string | null>(null);

  return (
    <>
      <PageHero
        mediaKey="banner-shopping-malls"
        label="Karachi commerce"
        eyebrow="Partnerships"
        title="Advertise with Karachify"
        sub="Promoted slots sit next to organic results and are always labelled. No disguised ads, no buying your way to a fake rating."
        trail={[{ label: 'Home', to: '/' }, { label: 'Advertise' }]}
      />

      <div className="shell section">
        <div className="grid gap-5 lg:grid-cols-3">
          {packages.map((p) => (
            <div key={p.name} className={`card flex flex-col p-6 ${p.tone}`}>
              <div className="flex items-center gap-2">
                {p.name === 'Promoted placement' ? <Megaphone className="h-5 w-5 text-navy-600" /> : p.name === 'Featured place' ? <Sparkles className="h-5 w-5 text-teal-600" /> : <Tag className="h-5 w-5 text-navy-600" />}
                <h2 className="font-display text-lg font-bold text-navy-800">{p.name}</h2>
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold text-navy-800">{p.price}</p>
              <p className="text-[13px] text-navy-400">{p.real}</p>
              <p className="mt-3 text-sm text-navy-500">{p.best}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-navy-600">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> {f}
                  </li>
                ))}
              </ul>
              <button
                className={`btn mt-6 w-full ${p.name === 'Featured place' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setForm((f) => ({ ...f, package: p.name === 'Owner-edited listing' ? 'upgrade' : p.name === 'Featured place' ? 'featured' : 'promoted' }));
                  document.getElementById('advertise-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  toast.push(`${p.name} selected — send us the details`, 'info');
                }}
              >
                Choose this
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <form
            id="advertise-form"
            className="card p-6 sm:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              const next: Record<string, string> = {};
              if (form.business.trim().length < 3) next.business = 'Which business is this for?';
              if (!form.area) next.area = 'Pick the area you want to reach';
              if (!isValidEmail(form.email)) next.email = 'A working email, please';
              setErrors(next);
              if (Object.keys(next).length) return;
              const sub = actions.addSubmission({
                kind: 'business',
                name: `Advertising enquiry — ${form.business.trim()} (${form.package})`,
                areaId: form.area,
                description: form.message.trim() || 'Enquiry submitted from the advertising page.',
                email: form.email.trim().toLowerCase(),
              });
              toast.push('Saved in this browser — no payment is taken and nothing is emailed', 'info');
              setSent(sub.id);
            }}
          >
            <h2 className="font-display text-xl font-bold text-navy-800">Request a slot</h2>
            <p className="mt-1.5 text-sm text-navy-500">
              This form records your enquiry in this browser so you can follow the flow end to end. There is no payment,
              invoicing or campaign reporting behind it — nothing on this page is priced because nothing is for sale yet.
            </p>

            {sent && (
              <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
                Enquiry saved with reference <span className="font-mono text-[13px]">{sent}</span>.{' '}
                <Link to="/profile" className="font-semibold underline">
                  View it in your enquiries
                </Link>
                .
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Business or event name" required error={errors.business} className="sm:col-span-2">
                <TextInput value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} error={Boolean(errors.business)} />
              </Field>
              <Field label="Package">
                <Select value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })}>
                  <option value="upgrade">Owner-edited listing</option>
                  <option value="featured">Featured place</option>
                  <option value="promoted">Promoted placement</option>
                </Select>
              </Field>
              <Field label="Area to target" required error={errors.area}>
                <Select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} error={Boolean(errors.area)}>
                  <option value="">Choose an area…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Contact email" required error={errors.email} className="sm:col-span-2">
                <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={Boolean(errors.email)} />
              </Field>
              <Field label="What are you promoting?" className="sm:col-span-2" hint="Dates, offer, and what success looks like for you.">
                <TextArea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </Field>
            </div>

            <button type="submit" className="btn-primary mt-6">
              <Store className="h-4 w-4" /> Save enquiry
            </button>
          </form>

          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">Where your promotion appears</h2>
              <ul className="mt-3 space-y-2 text-sm text-navy-600">
                <li>{listings.length} directory records across category and area pages</li>
                <li>Search results page, grouped by type</li>
                <li>The interactive Karachi map list panel</li>
                <li>Homepage featured strips for restaurants, hotels and shopping</li>
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-bold text-navy-800">House rules</h2>
              <ul className="mt-3 space-y-2 text-sm text-navy-600">
                <li>Promoted records keep a visible “Promoted” label.</li>
                <li>Paid placement never changes a rating or a review.</li>
                <li>Unverified claims (awards, “oldest in Karachi”) need a source.</li>
                <li>Medical and financial listings get extra review before promotion.</li>
              </ul>
            </div>
            <Note tone="warn">
              Nothing here is priced, because Karachify takes no money and has no billing system. The “Promoted” badge is
              switched on from the admin dashboard to show what a paid slot would look like; no listing on this site
              carries it right now, and no advertiser has paid for one.
            </Note>
          </aside>
        </div>
      </div>
    </>
  );
}
