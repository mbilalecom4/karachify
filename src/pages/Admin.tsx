import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Map as MapIcon,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import {
  actions,
  allEvents,
  allListings,
  currentUser,
  selectAreas,
  selectCategories,
  selectEvents,
  selectListings,
  useDB,
} from '../lib/store';
import {
  EmptyState,
  Field,
  Modal,
  Select,
  StatusBadge,
  Tabs,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { Note } from '../components/Page';
import { attributionRows, resolvedMediaCount } from '../lib/media';
import { slugify, uniqueSlug } from '../lib/format';
import type { Area, Category, CityEvent, EventCategory, Listing } from '../types';
import { EVENT_CATEGORIES } from './SubmitEvent';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'listings', label: 'Listings', icon: MapIcon },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'submissions', label: 'Submissions', icon: Inbox },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'areas', label: 'Areas', icon: MapIcon },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = (typeof TABS)[number]['id'];

const jitter = (seed: string, span: number) => {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 2147483647;
  return ((h % 1000) / 1000 - 0.5) * span;
};

export default function Admin() {
  useDocumentTitle('Admin · demo');
  const db = useDB();
  const toast = useToast();
  const user = currentUser(db);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview') as TabId;

  if (user?.role !== 'admin') {
    return (
      <div className="shell section">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy-50">
            <ShieldCheck className="h-6 w-6 text-navy-500" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800">Admin area</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-navy-500">
            This dashboard is a working demo of content management — nothing here is access-controlled or secure. Sign in
            with the seeded administrator account to try the full CRUD flows.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              className="btn-primary"
              onClick={() => {
                const res = actions.login('admin@karachify.demo', 'admin123');
                if (res.ok) toast.push('Signed in as the demo administrator');
              }}
            >
              Sign in as demo administrator
            </button>
            <Link to="/login" className="btn-outline">
              Use the login form
            </Link>
          </div>
          <p className="mt-4 font-mono text-[12px] text-navy-400">admin@karachify.demo · admin123</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Internal · demo</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-navy-800">Karachify admin</h1>
          <p className="mt-1.5 text-[15px] text-navy-500">
            All content below lives in your browser. Changes are immediate and reversible with the reset button.
          </p>
        </div>
        <button
          className="btn-outline"
          onClick={() => {
            actions.resetDemoData();
            toast.push('Demo data reset to the shipped dataset', 'info');
          }}
        >
          <RotateCcw className="h-4 w-4" /> Reset demo data
        </button>
      </div>

      <Note tone="warn" className="mt-5">
        A production admin would sit behind Supabase Row Level Security, an audited auth provider and server-side
        validation. This one exists to show the workflows: moderation, publishing, flags and taxonomy control.
      </Note>

      <div className="mt-6">
        <Tabs
          size="sm"
          active={tab}
          onChange={(id) => setParams(id === 'overview' ? {} : { tab: id })}
          tabs={TABS.map((t) => ({
            id: t.id,
            label: t.label,
            count:
              t.id === 'submissions'
                ? db.submissions.filter((s) => s.status === 'pending').length
                : t.id === 'listings'
                  ? selectListings(db).length
                  : t.id === 'events'
                    ? selectEvents(db).length
                    : t.id === 'reviews'
                      ? db.reviews.length
                      : undefined,
          }))}
        />
      </div>

      <div className="mt-7">
        {tab === 'overview' && <Overview />}
        {tab === 'listings' && <Listings />}
        {tab === 'events' && <EventsAdmin />}
        {tab === 'submissions' && <Submissions />}
        {tab === 'categories' && <Taxonomy kind="category" />}
        {tab === 'areas' && <Taxonomy kind="area" />}
        {tab === 'reviews' && <Reviews />}
        {tab === 'media' && <Media />}
        {tab === 'settings' && <SettingsPanel />}
      </div>
    </div>
  );
}

/* -------------------------------- overview ------------------------------- */

function Overview() {
  const db = useDB();
  const listings = selectListings(db);
  const events = selectEvents(db);
  const categories = selectCategories(db);
  const areas = selectAreas(db);
  const pending = db.submissions.filter((s) => s.status === 'pending');

  const byGroup = categories.map((c) => ({
    name: c.name,
    count: listings.filter((l) => l.categoryId === c.id).length,
  }));

  const cards = [
    { label: 'Live listings', value: listings.length, hint: `${listings.filter((l) => l.featured).length} featured` },
    { label: 'Events', value: events.length, hint: `${events.filter((e) => new Date(`${e.date}T00:00:00`) >= new Date()).length} dated today or later` },
    { label: 'Pending submissions', value: pending.length, hint: 'waiting on moderation' },
    { label: 'Areas', value: areas.length, hint: `${categories.length} categories` },
    { label: 'Resident reviews', value: db.reviews.length, hint: 'plus seeded demo reviews' },
    { label: 'Resolved photographs', value: resolvedMediaCount, hint: 'Wikimedia hotlinks with attribution' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="font-display text-3xl font-extrabold text-navy-800">{c.value}</p>
            <p className="mt-1 text-sm font-semibold text-navy-700">{c.label}</p>
            <p className="text-[13px] text-navy-400">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="card p-5">
          <h2 className="font-display text-[17px] font-bold text-navy-800">Listings per category</h2>
          <ul className="mt-3 space-y-2">
            {byGroup
              .sort((a, b) => b.count - a.count)
              .map((row) => {
                const max = Math.max(1, ...byGroup.map((r) => r.count));
                return (
                  <li key={row.name} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate text-navy-600">{row.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-navy-100">
                      <span className="block h-full rounded-full bg-teal-500" style={{ width: `${(row.count / max) * 100}%` }} />
                    </span>
                    <span className="font-semibold text-navy-800">{row.count}</span>
                  </li>
                );
              })}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-display text-[17px] font-bold text-navy-800">Moderation queue</h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-navy-500">Nothing waiting. Submit a business or event to see the flow.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {pending.slice(0, 6).map((s) => (
                <li key={s.id} className="rounded-xl border border-navy-100 bg-mist p-3">
                  <p className="text-sm font-semibold text-navy-800">{s.name}</p>
                  <p className="mt-0.5 text-[13px] text-navy-500">
                    {s.kind} · {s.email ?? 'no email'} · {s.createdAt}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin?tab=submissions" className="btn-ghost btn-sm mt-4">
            Open the queue
          </Link>
        </section>
      </div>
    </div>
  );
}

/* -------------------------------- listings ------------------------------- */

function Listings() {
  const db = useDB();
  const toast = useToast();
  const listings = selectListings(db);
  const categories = selectCategories(db);
  const areas = selectAreas(db);
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Listing | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', categoryId: '', areaId: '', tagline: '', description: '', status: 'verified' });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listings.filter(
      (l) =>
        (!categoryId || l.categoryId === categoryId) &&
        (!needle || `${l.name} ${l.address} ${l.tags.join(' ')}`.toLowerCase().includes(needle))
    );
  }, [listings, q, categoryId]);

  const openEdit = (l: Listing) => {
    setEditing(l);
    setDraft({ name: l.name, categoryId: l.categoryId, areaId: l.areaId, tagline: l.tagline, description: l.description, status: l.status });
  };

  const openCreate = () => {
    setCreating(true);
    setDraft({
      name: '',
      categoryId: categories[0]?.id ?? '',
      areaId: areas[0]?.id ?? '',
      tagline: '',
      description: '',
      status: 'needs-review',
    });
  };

  const createFromDraft = () => {
    const name = draft.name.trim();
    if (name.length < 3) {
      toast.push('Name must be at least 3 characters', 'error');
      return;
    }
    if (draft.description.trim().length < 20) {
      toast.push('Add a description of at least 20 characters', 'error');
      return;
    }
    const area = areas.find((a) => a.id === draft.areaId);
    const nameSlug = slugify(name);
    const slug = uniqueSlug(
      listings.map((l) => l.slug),
      nameSlug.startsWith('admin-') ? nameSlug : `admin-${nameSlug}`
    );
    actions.createListing({
      id: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      slug,
      cityId: 'karachi',
      categoryId: draft.categoryId || categories[0].id,
      areaId: draft.areaId || areas[0].id,
      name,
      tagline: draft.tagline.trim() || name,
      description: draft.description.trim(),
      address: `${area?.name ?? 'Karachi'}, Karachi`,
      lat: (area?.lat ?? 24.86) + jitter(slug, 0.02),
      lng: (area?.lng ?? 67.01) + jitter(`${slug}lng`, 0.02),
      facilities: [],
      tags: ['Added in admin demo'],
      rating: 4,
      reviewCount: 0,
      featured: false,
      promoted: false,
      status: draft.status as Listing['status'],
      createdAt: new Date().toISOString().slice(0, 10),
      hours: [{ day: 'Monday – Saturday', open: '10:00 – 18:00 (demo timing)' }],
    });
    toast.push(`“${name}” created — coordinates are estimated from the area centre`, 'info');
    setCreating(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px_auto] sm:items-end">
        <Field label="Search listings">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, address or tag" />
        </Field>
        <Field label="Category">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end gap-3 pb-1">
          <button className="btn-primary btn-sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> New listing
          </button>
          <p className="text-sm text-navy-500">{rows.length} shown</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-navy-100 bg-mist text-[13px] uppercase tracking-wide text-navy-500">
            <tr>
              <th className="px-4 py-3">Listing</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-navy-50 last:border-0 hover:bg-mist/70">
                <td className="px-4 py-3">
                  <Link to={`/place/${l.slug}`} className="font-semibold text-navy-800 hover:text-teal-700">
                    {l.name}
                  </Link>
                  <p className="text-[13px] text-navy-400">{l.address}</p>
                </td>
                <td className="px-4 py-3 text-navy-600">{categories.find((c) => c.id === l.categoryId)?.name ?? '—'}</td>
                <td className="px-4 py-3 text-navy-600">{areas.find((a) => a.id === l.areaId)?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="flex gap-1.5">
                    <button
                      className={`chip !px-2 !py-0.5 !text-[11px] ${l.featured ? 'chip-active' : ''}`}
                      aria-pressed={l.featured}
                      onClick={() => {
                        actions.patchListing(l.id, { featured: !l.featured });
                        toast.push(`${l.name} ${l.featured ? 'unflagged' : 'flagged'} featured`);
                      }}
                    >
                      Featured
                    </button>
                    <button
                      className={`chip !px-2 !py-0.5 !text-[11px] ${l.promoted ? 'chip-active' : ''}`}
                      aria-pressed={l.promoted}
                      onClick={() => {
                        actions.patchListing(l.id, { promoted: !l.promoted });
                        toast.push(`${l.name} ${l.promoted ? 'unflagged' : 'flagged'} promoted`);
                      }}
                    >
                      Promoted
                    </button>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex justify-end gap-1.5">
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(l)} aria-label={`Edit ${l.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <Link to={`/place/${l.slug}`} className="btn-ghost btn-sm" aria-label={`View ${l.name}`}>
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(l)} aria-label={`Delete ${l.name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-navy-500">
                  No listing matches those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {db.deletedListings.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display text-[17px] font-bold text-navy-800">Deleted ({db.deletedListings.length})</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {db.deletedListings.map((id) => {
              const l = allListings(db).find((x) => x.id === id);
              return (
                <li key={id}>
                  <button className="chip" onClick={() => { actions.restoreListing(id); toast.push('Listing restored', 'info'); }}>
                    <RotateCcw className="h-3.5 w-3.5" /> {l?.name ?? id}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal
        open={Boolean(editing) || creating}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        title={creating ? 'New listing' : editing ? `Edit “${editing.name}”` : 'Edit listing'}
        size="lg"
        footer={
          <>
            <button
              className="btn-ghost"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (creating) {
                  createFromDraft();
                  return;
                }
                if (!editing) return;
                if (draft.name.trim().length < 3) {
                  toast.push('Name must be at least 3 characters', 'error');
                  return;
                }
                actions.patchListing(editing.id, {
                  name: draft.name.trim(),
                  slug: uniqueSlug(
                    listings.filter((l) => l.id !== editing.id).map((l) => l.slug),
                    slugify(draft.name.trim()) || editing.slug
                  ),
                  categoryId: draft.categoryId || editing.categoryId,
                  areaId: draft.areaId || editing.areaId,
                  tagline: draft.tagline.trim(),
                  description: draft.description.trim(),
                  status: draft.status as Listing['status'],
                });
                toast.push('Listing updated');
                setEditing(null);
              }}
            >
              {creating ? 'Create listing' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Area">
            <Select value={draft.areaId} onChange={(e) => setDraft({ ...draft, areaId: e.target.value })}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Verification status" className="sm:col-span-2">
            <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option value="verified">Verified source</option>
              <option value="demo">Sample data</option>
              <option value="needs-review">Needs review</option>
            </Select>
          </Field>
          <Field label="Tagline" className="sm:col-span-2">
            <TextInput value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <TextArea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this listing?"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
              Keep it
            </button>
            <button
              className="btn-primary !bg-rose-600 hover:!bg-rose-700"
              onClick={() => {
                if (!confirmDelete) return;
                const created = db.newListings.some((l) => l.id === confirmDelete.id);
                actions.deleteListing(confirmDelete.id);
                toast.push(
                  created ? `${confirmDelete.name} deleted` : `${confirmDelete.name} hidden — restore it below`,
                  'info'
                );
                setConfirmDelete(null);
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-navy-600">
          {confirmDelete?.name} will disappear from every public page and the map.{' '}
          {db.newListings.some((l) => l.id === confirmDelete?.id)
            ? 'This record was created in the demo, so deleting it removes it from this browser for good.'
            : 'Nothing is destroyed: the demo keeps a deleted list you can restore from in this browser.'}
        </p>
      </Modal>
    </div>
  );
}

/* --------------------------------- events -------------------------------- */

function EventsAdmin() {
  const db = useDB();
  const toast = useToast();
  const events = selectEvents(db);
  const areas = selectAreas(db);
  const [q, setQ] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<CityEvent | null>(null);
  const [editing, setEditing] = useState<CityEvent | null>(null);
  const [draft, setDraft] = useState({ name: '', date: '', endDate: '', startTime: '', endTime: '', venue: '', areaId: '', eventCategory: 'Community', ticketPrice: '' });

  const rows = events.filter((e) => `${e.name} ${e.venue} ${e.eventCategory}`.toLowerCase().includes(q.trim().toLowerCase()));

  const openEdit = (e: CityEvent) => {
    setEditing(e);
    setDraft({
      name: e.name,
      date: e.date,
      endDate: e.endDate ?? '',
      startTime: e.startTime,
      endTime: e.endTime,
      venue: e.venue,
      areaId: e.areaId,
      eventCategory: e.eventCategory,
      ticketPrice: e.ticketPrice,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="Search events">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, venue or type" />
        </Field>
        <p className="pb-3 text-sm text-navy-500">{rows.length} events</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-navy-100 bg-mist text-[13px] uppercase tracking-wide text-navy-500">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Venue</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-navy-50 last:border-0 hover:bg-mist/70">
                <td className="px-4 py-3">
                  <Link to={`/events/${e.slug}`} className="font-semibold text-navy-800 hover:text-teal-700">
                    {e.name}
                  </Link>
                  <p className="text-[13px] text-navy-400">{e.organiser}</p>
                </td>
                <td className="px-4 py-3 text-navy-600">
                  {e.date}
                  <span className="block text-[13px] text-navy-400">
                    {e.startTime}–{e.endTime}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="badge-verified">{e.eventCategory}</span>
                </td>
                <td className="px-4 py-3 text-navy-600">
                  {e.venue}
                  <span className="block text-[13px] text-navy-400">{areas.find((a) => a.id === e.areaId)?.name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex justify-end gap-1.5">
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(e)} aria-label={`Edit ${e.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      aria-label={`Delete ${e.name}`}
                      onClick={() => setConfirmDelete(e)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-navy-500">
                  No event matches that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {db.deletedEvents.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display text-[17px] font-bold text-navy-800">Removed events ({db.deletedEvents.length})</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {db.deletedEvents.map((id) => {
              const e = allEvents(db).find((x) => x.id === id);
              return (
                <li key={id}>
                  <button
                    className="chip"
                    onClick={() => {
                      actions.restoreEvent(id);
                      toast.push('Event restored', 'info');
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> {e?.name ?? id}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit “${editing.name}”` : 'Edit event'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!editing) return;
                if (!draft.date) {
                  toast.push('A start date is required', 'error');
                  return;
                }
                actions.patchEvent(editing.id, {
                  name: draft.name.trim() || editing.name,
                  slug: uniqueSlug(
                    events.filter((e) => e.id !== editing.id).map((e) => e.slug),
                    slugify(draft.name) || editing.slug
                  ),
                  date: draft.date,
                  endDate: draft.endDate || undefined,
                  startTime: draft.startTime,
                  endTime: draft.endTime,
                  venue: draft.venue.trim() || editing.venue,
                  areaId: draft.areaId || editing.areaId,
                  eventCategory: draft.eventCategory as EventCategory,
                  ticketPrice: draft.ticketPrice || editing.ticketPrice,
                  status: 'needs-review',
                });
                toast.push('Event updated — sample programming stays badged as demo');
                setEditing(null);
              }}
            >
              Save
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Start date">
            <TextInput type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="End date">
            <TextInput type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          </Field>
          <Field label="Start time">
            <TextInput type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
          </Field>
          <Field label="End time">
            <TextInput type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select value={draft.eventCategory} onChange={(e) => setDraft({ ...draft, eventCategory: e.target.value })}>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Area">
            <Select value={draft.areaId} onChange={(e) => setDraft({ ...draft, areaId: e.target.value })}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Venue" className="sm:col-span-2">
            <TextInput value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} />
          </Field>
          <Field label="Ticket price" className="sm:col-span-2">
            <TextInput value={draft.ticketPrice} onChange={(e) => setDraft({ ...draft, ticketPrice: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this event?"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
              Keep it
            </button>
            <button
              className="btn-primary !bg-rose-600 hover:!bg-rose-700"
              onClick={() => {
                if (!confirmDelete) return;
                const created = db.newEvents.some((e) => e.id === confirmDelete.id);
                actions.deleteEvent(confirmDelete.id);
                toast.push(
                  created ? `${confirmDelete.name} deleted` : `${confirmDelete.name} removed — restore it below`,
                  'info'
                );
                setConfirmDelete(null);
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-navy-600">
          {confirmDelete?.name} will disappear from the calendar, search and the map.{' '}
          {db.newEvents.some((e) => e.id === confirmDelete?.id)
            ? 'This event was created in the demo, so deleting it removes it from this browser for good.'
            : 'Nothing is destroyed: the demo keeps a removed list you can restore from in this browser.'}
        </p>
      </Modal>
    </div>
  );
}

/* ------------------------------ submissions ------------------------------ */

function Submissions() {
  const db = useDB();
  const toast = useToast();
  const areas = selectAreas(db);
  const [filter, setFilter] = useState('pending');
  const [reviewing, setReviewing] = useState<{ id: string; name: string; areaId: string; venue: string; date: string; eventCategory: EventCategory } | null>(null);

  const rows = db.submissions.filter((s) => filter === 'all' || s.status === filter);

  const reject = (id: string, name: string) => {
    actions.setSubmissionStatus(id, 'rejected');
    toast.push(`${name} rejected — the submitter keeps their copy`, 'info');
  };

  const approveListing = (id: string) => {
    const sub = db.submissions.find((s) => s.id === id);
    if (!sub) return;
    const area = areas.find((a) => a.id === sub.areaId) ?? areas[0];
    const listing = actions.publishSubmission(sub, {
      lat: area.lat + jitter(sub.id, 0.02),
      lng: area.lng + jitter(`${sub.id}lng`, 0.02),
    });
    toast.push(`${listing.name} published as a live demo listing`);
  };

  /** A claim points at a record that already exists, so approval badges it instead of duplicating it. */
  const approveClaim = (id: string) => {
    const sub = db.submissions.find((s) => s.id === id);
    if (!sub) return;
    if (sub.listingId) actions.patchListing(sub.listingId, { status: 'verified' });
    actions.setSubmissionStatus(id, 'approved');
    toast.push('Claim approved — the listing is now badged as a verified source', 'info');
  };

  const markRead = (id: string) => {
    actions.setSubmissionStatus(id, 'approved');
    toast.push('Marked as read — replying still happens outside this demo', 'info');
  };

  return (
    <div className="space-y-5">
      <div className="max-w-md">
        <Tabs
          size="sm"
          active={filter}
          onChange={setFilter}
          tabs={[
            { id: 'pending', label: 'Pending', count: db.submissions.filter((s) => s.status === 'pending').length },
            { id: 'approved', label: 'Approved', count: db.submissions.filter((s) => s.status === 'approved').length },
            { id: 'rejected', label: 'Rejected', count: db.submissions.filter((s) => s.status === 'rejected').length },
            { id: 'all', label: 'All', count: db.submissions.length },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Queue is clear"
          body="Submit a business or an event from the public forms and it lands here for moderation."
        />
      ) : (
        <ul className="space-y-4">
          {rows.map((s) => (
            <li key={s.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-navy-800">{s.name}</p>
                  <p className="mt-0.5 text-[13px] text-navy-500">
                    <span className="uppercase tracking-wide">{s.kind}</span> · {s.createdAt} ·{' '}
                    {areas.find((a) => a.id === s.areaId)?.name ?? 'area not set'}
                  </p>
                </div>
                <span
                  className={`badge ring-1 ring-inset ${
                    s.status === 'approved'
                      ? 'bg-teal-50 text-teal-700 ring-teal-200'
                      : s.status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 ring-rose-200'
                        : 'bg-amber-50 text-amber-700 ring-amber-200'
                  }`}
                >
                  {s.status}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-navy-600">{s.description}</p>

              <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-navy-400">Contact</dt>
                  <dd className="text-navy-700">
                    {s.email ?? '—'}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-navy-400">Address</dt>
                  <dd className="text-navy-700">{s.address ?? '—'}</dd>
                </div>
              </dl>

              {s.status === 'pending' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.kind === 'event' ? (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() =>
                        setReviewing({
                          id: s.id,
                          name: s.name,
                          areaId: s.areaId ?? areas[0].id,
                          venue: s.address ?? '',
                          date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
                          eventCategory: 'Community',
                        })
                      }
                    >
                      <Check className="h-3.5 w-3.5" /> Approve as event
                    </button>
                  ) : s.kind === 'claim' ? (
                    <button className="btn-primary btn-sm" onClick={() => approveClaim(s.id)}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Approve claim
                    </button>
                  ) : s.kind === 'contact' || s.kind === 'newsletter' ? (
                    <button className="btn-primary btn-sm" onClick={() => markRead(s.id)}>
                      <Check className="h-3.5 w-3.5" /> Mark as read
                    </button>
                  ) : (
                    <button className="btn-primary btn-sm" onClick={() => approveListing(s.id)}>
                      <Check className="h-3.5 w-3.5" /> Approve and publish
                    </button>
                  )}
                  <button className="btn-outline btn-sm" onClick={() => reject(s.id, s.name)}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              )}
              {s.listingId && (
                <p className="mt-3 text-[13px] text-navy-500">
                  {s.kind === 'claim' ? 'Claimed record' : 'Published record'}:{' '}
                  <span className="font-mono text-[12px]">{s.listingId}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Publish this event"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setReviewing(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!reviewing) return;
                const area = areas.find((a) => a.id === reviewing.areaId) ?? areas[0];
                const event: CityEvent = {
                  id: `user-event-${Math.random().toString(36).slice(2, 8)}`,
                  slug: uniqueSlug(selectEvents(db).map((e) => e.slug), `user-event-${slugify(reviewing.name)}`),
                  cityId: 'karachi',
                  categoryId: 'events',
                  name: reviewing.name,
                  description: db.submissions.find((s) => s.id === reviewing.id)?.description ?? '',
                  date: reviewing.date,
                  startTime: '17:00',
                  endTime: '21:00',
                  venue: reviewing.venue || area.name,
                  areaId: area.id,
                  eventCategory: reviewing.eventCategory,
                  ticketPrice: 'To confirm',
                  ticketNote: 'Community submission — ticketing not verified in this demo.',
                  organiser: db.submissions.find((s) => s.id === reviewing.id)?.email ?? 'Community organiser',
                  lat: area.lat + jitter(reviewing.id, 0.02),
                  lng: area.lng + jitter(`${reviewing.id}lng`, 0.02),
                  status: 'demo',
                };
                actions.createEvent(event);
                actions.setSubmissionStatus(reviewing.id, 'approved');
                toast.push(`${event.name} added to the calendar as sample programming`);
                setReviewing(null);
              }}
            >
              Publish event
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <TextInput value={reviewing?.name ?? ''} onChange={(e) => setReviewing((r) => (r ? { ...r, name: e.target.value } : r))} />
          </Field>
          <Field label="Start date">
            <TextInput type="date" value={reviewing?.date ?? ''} onChange={(e) => setReviewing((r) => (r ? { ...r, date: e.target.value } : r))} />
          </Field>
          <Field label="Type">
            <Select
              value={reviewing?.eventCategory ?? 'Community'}
              onChange={(e) => setReviewing((r) => (r ? { ...r, eventCategory: e.target.value as EventCategory } : r))}
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Area">
            <Select value={reviewing?.areaId ?? ''} onChange={(e) => setReviewing((r) => (r ? { ...r, areaId: e.target.value } : r))}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Venue">
            <TextInput value={reviewing?.venue ?? ''} onChange={(e) => setReviewing((r) => (r ? { ...r, venue: e.target.value } : r))} />
          </Field>
        </div>
        <p className="mt-4 text-[13px] text-navy-500">
          Times default to 17:00–21:00 and the ticket line reads “To confirm” until an organiser source exists.
        </p>
      </Modal>
    </div>
  );
}

/* -------------------------------- taxonomy ------------------------------- */

function Taxonomy({ kind }: { kind: 'category' | 'area' }) {
  const db = useDB();
  const toast = useToast();
  const categories = selectCategories(db);
  const areas = selectAreas(db);
  const listings = selectListings(db);
  const [form, setForm] = useState({ name: '', blurb: '', icon: 'MapPin', group: 'Discover', zone: 'Central', lat: '24.85', lng: '67.01' });

  const create = () => {
    if (form.name.trim().length < 3) {
      toast.push('Give it a name of at least 3 characters', 'error');
      return;
    }
    const slug = slugify(form.name);
    if (kind === 'category') {
      if (categories.some((c) => c.slug === slug)) {
        toast.push('A category with that name already exists', 'error');
        return;
      }
      actions.createCategory({
        id: slug,
        slug,
        name: form.name.trim(),
        icon: form.icon,
        blurb: form.blurb.trim() || 'Newly added category in the Karachify demo taxonomy.',
        group: form.group as Category['group'],
        navOrder: categories.length + 1,
        detailLayout: 'service',
      });
      toast.push(`Category “${form.name.trim()}” created`);
    } else {
      if (areas.some((a) => a.slug === slug)) {
        toast.push('That area already exists', 'error');
        return;
      }
      actions.createArea({
        id: slug,
        slug,
        cityId: 'karachi',
        name: form.name.trim(),
        zone: form.zone as Area['zone'],
        blurb: form.blurb.trim() || 'Newly added area in the Karachify demo taxonomy.',
        lat: Number(form.lat) || 24.85,
        lng: Number(form.lng) || 67.01,
      });
      toast.push(`Area “${form.name.trim()}” created`);
    }
    setForm({ ...form, name: '', blurb: '' });
  };

  const remove = (id: string, name: string) => {
    if (kind === 'category') actions.deleteCategory(id);
    else actions.deleteArea(id);
    toast.push(`${name} removed from navigation — restore with Reset demo data`, 'info');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-navy-100 bg-mist text-[13px] uppercase tracking-wide text-navy-500">
            <tr>
              <th className="px-4 py-3">{kind === 'category' ? 'Category' : 'Area'}</th>
              <th className="px-4 py-3">{kind === 'category' ? 'Group' : 'Zone'}</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3 text-right">Remove</th>
            </tr>
          </thead>
          <tbody>
            {kind === 'category'
              ? categories.map((c) => (
                  <tr key={c.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy-800">{c.name}</td>
                    <td className="px-4 py-3 text-navy-600">{c.group}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-navy-400">{c.slug}</td>
                    <td className="px-4 py-3 text-navy-600">{listings.filter((l) => l.categoryId === c.id).length}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost btn-sm" onClick={() => remove(c.id, c.name)} aria-label={`Delete ${c.name}`}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </button>
                    </td>
                  </tr>
                ))
              : areas.map((a) => (
                  <tr key={a.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy-800">{a.name}</td>
                    <td className="px-4 py-3 text-navy-600">{a.zone}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-navy-400">{a.slug}</td>
                    <td className="px-4 py-3 text-navy-600">{listings.filter((l) => l.areaId === a.id).length}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost btn-sm" onClick={() => remove(a.id, a.name)} aria-label={`Delete ${a.name}`}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-[17px] font-bold text-navy-800">
          Add {kind === 'area' ? 'an' : 'a'} {kind}
        </h2>
        <div className="mt-4 space-y-4">
          <Field label="Name" required>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={kind === 'category' ? 'e.g. Rooftop Lounges' : 'e.g. Clifton Block 5'} />
          </Field>
          <Field label="One-line blurb">
            <TextArea className="min-h-[84px]" value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} />
          </Field>
          {kind === 'category' ? (
            <>
              <Field label="Icon key">
                <Select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                  {['MapPin', 'Utensils', 'BedDouble', 'Stethoscope', 'GraduationCap', 'ShoppingBag', 'TreePine', 'Sparkles', 'Dumbbell', 'Bus', 'Landmark', 'Tag'].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Header group">
                <Select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
                  {['Discover', 'Eat & Stay', 'City Life', 'Essentials'].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Zone">
                <Select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
                  {['Clifton', 'DHA', 'Saddar', 'Gulshan', 'North', 'South', 'East', 'Central'].map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude" hint="Approximate">
                  <TextInput value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
                </Field>
                <Field label="Longitude" hint="Approximate">
                  <TextInput value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
                </Field>
              </div>
            </>
          )}
          <button className="btn-primary w-full" onClick={create}>
            Create {kind}
          </button>
          <p className="text-[13px] leading-relaxed text-navy-400">
            New areas and categories immediately appear in filters, the header menu and the areas index. Deleting one
            hides it from navigation but keeps its listings so nothing is orphaned.
          </p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- reviews -------------------------------- */

function SectionHead({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="font-display text-[17px] font-bold text-navy-800">{title}</h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-navy-500">{body}</p>
    </div>
  );
}

function Reviews() {
  const db = useDB();
  const toast = useToast();
  const listings = allListings(db);

  return (
    <div className="space-y-4">
      <SectionHead
        title="Resident reviews"
        body={`${db.reviews.length} review${db.reviews.length === 1 ? '' : 's'} written from listing pages in this browser. Removing one here clears it from the public page too.`}
      />
      {db.reviews.length === 0 ? (
        <EmptyState
          icon={<Star className="h-6 w-6" />}
          title="No resident reviews yet"
          body="Seeded reviews are generated deterministically for the demo and are labelled as such. Write one from any listing page and it will appear here for moderation."
        />
      ) : (
        <ul className="space-y-3">
          {db.reviews.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy-800">{r.author}</p>
                  <p className="text-[13px] text-navy-400">
                    on{' '}
                    <Link to={`/place/${listings.find((l) => l.id === r.listingId)?.slug ?? ''}`} className="link">
                      {listings.find((l) => l.id === r.listingId)?.name ?? r.listingId}
                    </Link>{' '}
                    · {r.date} · {r.rating.toFixed(1)}★
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-demo">{r.demo ? 'Demo' : 'Resident'}</span>
                  <button
                    className="btn-ghost btn-sm"
                    aria-label="Remove review"
                    onClick={() => {
                      actions.deleteReview(r.id);
                      toast.push('Review removed', 'info');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------- media --------------------------------- */

function Media() {
  const rows = attributionRows();
  const [q, setQ] = useState('');
  const shown = rows.filter((m) => `${m.key} ${m.subject}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      <SectionHead
        title="Photograph library"
        body="Every image on this site is a Karachi-specific hotlink with its licence recorded here. Unresolved subjects fall back to a designed placeholder rather than a generic stock photo."
      />
      <Note>
        {rows.length} photographs are hotlinked from Wikimedia and validated at request time; anything unresolved
        renders a designed Karachify placeholder naming the subject instead of showing an unrelated city. Coordinate
        pins are approximate and labelled as demo data.
      </Note>

      <div className="max-w-sm">
        <Field label="Find a photograph">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Subject or record key" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((m) => (
          <figure key={m.key} className="card overflow-hidden">
            <img src={m.thumb} alt={m.subject} loading="lazy" className="aspect-[4/3] w-full bg-navy-50 object-cover" />
            <figcaption className="p-4">
              <p className="truncate font-semibold text-navy-800" title={m.subject}>
                {m.subject}
              </p>
              <p className="mt-0.5 truncate font-mono text-[12px] text-navy-400">{m.key}</p>
              <p className="mt-1.5 text-[13px] text-navy-500">{m.license ?? 'licence on the file page'}</p>
              {m.filePage && (
                <a href={m.filePage} target="_blank" rel="noreferrer" className="link mt-1 inline-flex items-center gap-1 text-[13px]">
                  File page <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </figcaption>
          </figure>
        ))}
        {shown.length === 0 && <p className="text-sm text-navy-500">No photograph matches “{q}”.</p>}
      </div>

      <Link to="/image-credits" className="btn-outline">
        Full credit list
      </Link>
    </div>
  );
}

/* -------------------------------- settings -------------------------------- */

function SettingsPanel() {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState(db.settings);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="card p-6">
        <h2 className="font-display text-[17px] font-bold text-navy-800">Site identity</h2>
        <div className="mt-4 space-y-4">
          <Field label="Site name">
            <TextInput value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
          </Field>
          <Field label="Tagline">
            <TextInput value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </Field>
          <Field label="Featured badge label">
            <TextInput value={form.featuredBadgeLabel} onChange={(e) => setForm({ ...form, featuredBadgeLabel: e.target.value })} />
          </Field>
          <Field label="Listings per page" hint="Used by load-more batches across the site.">
            <TextInput
              type="number"
              min={6}
              max={48}
              value={form.listingsPerPage}
              onChange={(e) => setForm({ ...form, listingsPerPage: Math.max(6, Math.min(48, Number(e.target.value) || 12)) })}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-navy-700">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.demoBanner}
              onChange={(e) => setForm({ ...form, demoBanner: e.target.checked })}
            />
            Show the “sample data” transparency band on the homepage
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            className="btn-primary"
            onClick={() => {
              if (!form.siteName.trim()) {
                toast.push('Site name cannot be empty', 'error');
                return;
              }
              actions.saveSettings(form);
              toast.push('Settings saved');
            }}
          >
            Save settings
          </button>
          <button className="btn-ghost" onClick={() => setForm(db.settings)}>
            Discard changes
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-display text-[17px] font-bold text-navy-800">Storage</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-500">
          The demo keeps one JSON document in localStorage under <code>karachify.db.v1</code>. It mirrors the SQL schema
          in docs/database-schema.sql, so switching to Supabase means replacing selectors, not components.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ['User-created listings', db.newListings.length],
            ['Edited listings', Object.keys(db.listingPatches).length],
            ['User-created events', db.newEvents.length],
            ['Accounts', db.users.length],
            ['Submissions', db.submissions.length],
            ['Enquiries', db.enquiries.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-navy-100 bg-mist p-3">
              <dt className="text-[13px] text-navy-500">{label}</dt>
              <dd className="font-display text-xl font-bold text-navy-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
