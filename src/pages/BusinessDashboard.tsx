import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Store, PlusCircle } from 'lucide-react';
import {
  actions,
  currentUser,
  selectAreas,
  selectCategories,
  selectListings,
  useDB,
} from '../lib/store';
import { EmptyState, Field, Modal, Select, StatusBadge, TextArea, TextInput, useToast } from '../components/ui';
import { Note } from '../components/Page';
import type { Listing } from '../types';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const statusTone: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-teal-50 text-teal-700 ring-teal-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function BusinessDashboard() {
  useDocumentTitle('Business dashboard');
  const db = useDB();
  const toast = useToast();
  const user = currentUser(db);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [draft, setDraft] = useState({ name: '', tagline: '', description: '', phone: '', address: '', facilities: '', priceRange: '' });

  const listings = selectListings(db);
  const categories = selectCategories(db);
  const areas = selectAreas(db);

  const mine = useMemo(() => {
    if (!user) return [];
    const ids = db.submissions.filter((s) => s.listingId && s.email?.toLowerCase() === user.email).map((s) => s.listingId as string);
    const fromSubmissions = listings.filter((l) => ids.includes(l.id));
    /* A `user-` id only says somebody submitted it, not that this person did.
       Without the email match, every demo login would open every other
       business's page and be able to rewrite it. */
    const community = listings.filter(
      (l) => l.ownerEmail === user.email && !fromSubmissions.some((x) => x.id === l.id),
    );
    return [...fromSubmissions, ...community];
  }, [user, db.submissions, listings]);

  const mySubmissions = user ? db.submissions.filter((s) => s.email?.toLowerCase() === user.email) : [];

  const openEdit = (l: Listing) => {
    setEditing(l);
    setDraft({
      name: l.name,
      tagline: l.tagline,
      description: l.description,
      phone: l.phone ?? '',
      address: l.address,
      facilities: l.facilities.join(', '),
      priceRange: l.priceRange ?? '',
    });
  };

  if (!user) {
    return (
      <div className="shell section">
        <h1 className="mb-6 font-display text-2xl font-bold text-navy-800 sm:text-3xl">Business dashboard</h1>
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title="Business dashboard needs a demo sign-in"
          body="Owner accounts can edit the listings they submitted. Use the demo owner account, or submit a business and sign in with the email you used."
          action={
            <span className="flex gap-3">
              <Link to="/login" className="btn-primary">
                Log in as owner@karachify.demo
              </Link>
              <Link to="/list-your-business" className="btn-outline">
                List a business
              </Link>
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="shell section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Owner tools · demo</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-navy-800">Business dashboard</h1>
          <p className="mt-1.5 text-[15px] text-navy-500">
            Signed in as {user.name} ({user.email}) — {mine.length} listing{mine.length === 1 ? '' : 's'} and{' '}
            {mySubmissions.length} submission{mySubmissions.length === 1 ? '' : 's'} in this browser.
          </p>
        </div>
        <Link to="/list-your-business" className="btn-primary">
          <PlusCircle className="h-4 w-4" /> Submit a new business
        </Link>
      </div>

      <Note className="mt-5">
        Edits here write straight to your browser copy of the demo dataset, so your changes are visible on the public
        pages immediately. On a production Karachify the same form would post to a Supabase table and wait for
        moderation.
      </Note>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section>
          <h2 className="section-title">Your listings</h2>
          {mine.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="Nothing published to your account yet"
                body="Approve a submission from the admin queue — the demo lets you do both sides — or submit a business and it will show here with a pending badge."
                action={
                  <Link to="/admin" className="btn-outline mt-1">
                    Open the admin queue
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {mine.map((l) => {
                const category = categories.find((c) => c.id === l.categoryId);
                const area = areas.find((a) => a.id === l.areaId);
                return (
                  <li key={l.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-lg font-bold text-navy-800">{l.name}</p>
                        <p className="mt-0.5 text-sm text-navy-500">
                          {category?.name ?? 'Uncategorised'} · {area?.name ?? 'Karachi'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={l.status} />
                        {l.featured && <span className="badge-featured">{db.settings.featuredBadgeLabel}</span>}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-navy-500">{l.tagline}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-outline btn-sm" onClick={() => openEdit(l)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit details
                      </button>
                      <Link to={`/place/${l.slug}`} className="btn-ghost btn-sm">
                        <ExternalLink className="h-3.5 w-3.5" /> View public page
                      </Link>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          actions.patchListing(l.id, { featured: !l.featured });
                          toast.push(l.featured ? `${l.name} unflagged as featured` : `${l.name} flagged featured`);
                        }}
                      >
                        {l.featured ? 'Remove featured' : 'Flag as featured'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="card p-5">
          <h2 className="font-display text-[17px] font-bold text-navy-800">Submission history</h2>
          {mySubmissions.length === 0 ? (
            <p className="mt-2 text-sm text-navy-500">No submissions from this email yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {mySubmissions.map((s) => (
                <li key={s.id} className="rounded-xl border border-navy-100 bg-mist p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-navy-800">{s.name}</p>
                    <span className={`badge ring-1 ring-inset ${statusTone[s.status]}`}>{s.status}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-navy-500">
                    {s.kind} · {s.createdAt}
                  </p>
                  {s.listingId && listings.some((l) => l.id === s.listingId) ? (
                    <Link to={`/place/${listings.find((l) => l.id === s.listingId)?.slug}`} className="link mt-1 block text-[13px]">
                      Open the published page
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[13px] leading-relaxed text-navy-400">
            Rejected submissions keep their notes so you can see what a moderator would ask you to change.
          </p>
        </aside>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : 'Edit listing'}
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!editing) return;
                if (draft.name.trim().length < 3) {
                  toast.push('The listing needs a name of at least 3 characters', 'error');
                  return;
                }
                actions.patchListing(editing.id, {
                  name: draft.name.trim(),
                  tagline: draft.tagline.trim(),
                  description: draft.description.trim(),
                  phone: draft.phone.trim() || undefined,
                  address: draft.address.trim(),
                  priceRange: (draft.priceRange || undefined) as Listing['priceRange'],
                  facilities: draft.facilities
                    .split(',')
                    .map((f) => f.trim())
                    .filter(Boolean),
                  status: 'needs-review',
                });
                toast.push('Saved to your demo listing — moderators would review this change');
                setEditing(null);
              }}
            >
              Save changes
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Tagline" className="sm:col-span-2" hint="One line shown under the name on cards.">
            <TextInput value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <TextArea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+92 21 xxxx xxxx" />
          </Field>
          <Field label="Price band" hint="Stated by you, the operator. Karachify never assigns a band itself, and visitors see it labelled as owner-stated.">
            <Select value={draft.priceRange} onChange={(e) => setDraft({ ...draft, priceRange: e.target.value })}>
              {['', 'Free', '$', '$$', '$$$'].map((p) => (
                <option key={p || 'unset'} value={p}>
                  {p === '' ? 'Not stated' : p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <TextInput value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </Field>
          <Field label="Facilities" className="sm:col-span-2" hint="Comma separated — parking, wheelchair access, family seating…">
            <TextInput value={draft.facilities} onChange={(e) => setDraft({ ...draft, facilities: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
