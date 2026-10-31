import { Link } from 'react-router-dom';
import { CalendarCheck, Heart, LogOut, Mail, Search, ShieldCheck, Store } from 'lucide-react';
import { actions, currentUser, prefsFor, selectEvents, selectListings, useDB } from '../lib/store';
import { EmptyState, useToast } from '../components/ui';
import { Note } from '../components/Page';
import { formatDate, plural } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const dateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
};

const statusTone: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-teal-50 text-teal-700 ring-teal-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function Profile() {
  useDocumentTitle('Your profile');
  const db = useDB();
  const toast = useToast();
  const user = currentUser(db);

  if (!user) {
    return (
      <div className="shell section">
        <h1 className="mb-6 font-display text-2xl font-bold text-navy-800 sm:text-3xl">Your profile</h1>
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Sign in to see your profile"
          body="Profiles in this showcase are demo accounts stored in your browser. Favourites and enquiries made as a guest stay available under the guest profile."
          action={
            <span className="flex gap-3">
              <Link to="/login" className="btn-primary">
                Log in
              </Link>
              <Link to="/signup" className="btn-outline">
                Create a demo account
              </Link>
            </span>
          }
        />
      </div>
    );
  }

  const prefs = prefsFor(db);
  const listings = selectListings(db);
  const events = selectEvents(db);
  const favourites = prefs.favouriteListings
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  const savedEvents = prefs.savedEvents
    .map((id) => events.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const myEnquiries = db.enquiries.filter((e) => e.userId === user.id || e.email === user.email);
  const mySubmissions = db.submissions.filter((s) => s.email && s.email.toLowerCase() === user.email);

  const stats = [
    { icon: Heart, label: 'Saved places', value: String(favourites.length), to: '/saved' },
    { icon: CalendarCheck, label: 'Saved events', value: String(savedEvents.length), to: '/saved?tab=events' },
    { icon: Mail, label: 'Enquiries sent', value: String(myEnquiries.length) },
    { icon: Store, label: 'Submissions', value: String(mySubmissions.length) },
  ];

  return (
    <div className="shell section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-navy-800">{user.name}</h1>
          <p className="mt-1.5 text-[15px] text-navy-500">
            {user.email} · member since {formatDate(user.createdAt)} ·{' '}
            <span className="font-semibold capitalize text-navy-700">{user.role}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {user.role === 'admin' && (
            <Link to="/admin" className="btn-dark">
              <ShieldCheck className="h-4 w-4" /> Admin dashboard
            </Link>
          )}
          {user.role !== 'user' && (
            <Link to="/dashboard" className="btn-outline">
              <Store className="h-4 w-4" /> Business dashboard
            </Link>
          )}
          <button
            className="btn-ghost"
            onClick={() => {
              actions.logout();
              toast.push('Signed out of the demo session', 'info');
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>

      <Note className="mt-6">
        Everything below is stored in this browser only (localStorage). Clearing site data resets the profile, and no
        personal information is transmitted anywhere.
      </Note>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) =>
          s.to ? (
            <Link key={s.label} to={s.to} className="card card-hover p-5">
              <s.icon className="h-5 w-5 text-teal-600" />
              <p className="mt-3 font-display text-2xl font-bold text-navy-800">{s.value}</p>
              <p className="text-sm text-navy-500">{s.label}</p>
            </Link>
          ) : (
            <div key={s.label} className="card p-5">
              <s.icon className="h-5 w-5 text-teal-600" />
              <p className="mt-3 font-display text-2xl font-bold text-navy-800">{s.value}</p>
              <p className="text-sm text-navy-500">{s.label}</p>
            </div>
          )
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section>
          <h2 className="section-title">Your enquiries and submissions</h2>
          <p className="section-sub">Every form you fill in this demo is logged here so you can see the state it would be in on a real platform.</p>

          {myEnquiries.length === 0 && mySubmissions.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={<Mail className="h-6 w-6" />}
                title="Nothing sent yet"
                body="Use “Get directions”, “Enquire”, “Register interest” or “List your business” and the record will show up here."
                action={
                  <Link to="/list-your-business" className="btn-outline mt-1">
                    Submit a business
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {mySubmissions.map((s) => (
                <li key={s.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-navy-800">{s.name}</p>
                    <span className={`badge ring-1 ring-inset ${statusTone[s.status]}`}>{s.status}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-navy-500">{s.description}</p>
                  <p className="mt-2 text-[13px] text-navy-400">
                    {s.kind} submission · {formatDate(s.createdAt)}
                  </p>
                </li>
              ))}
              {myEnquiries.map((e) => (
                <li key={e.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-navy-800">{e.subject}</p>
                    <span className="badge bg-navy-50 text-navy-600">Saved on this device</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-navy-500">{e.message}</p>
                  <p className="mt-2 text-[13px] text-navy-400">{e.kind} enquiry · {dateTime(e.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <div className="card p-5">
            <h3 className="font-display text-[17px] font-bold text-navy-800">Saved places</h3>
            {favourites.length === 0 ? (
              <p className="mt-2 text-sm text-navy-500">Tap the heart on any listing to keep it here.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {favourites.slice(0, 6).map((l) => (
                  <li key={l.id}>
                    <Link to={`/place/${l.slug}`} className="link">
                      {l.name}
                    </Link>
                  </li>
                ))}
                {favourites.length > 6 && <li className="text-navy-400">+{plural(favourites.length - 6, 'more place', 'more places')}</li>}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-display text-[17px] font-bold text-navy-800">
              <Search className="h-4 w-4 text-teal-600" /> Recent searches
            </h3>
            {prefs.recentSearches.length === 0 ? (
              <p className="mt-2 text-sm text-navy-500">No searches recorded for this account yet.</p>
            ) : (
              <>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {prefs.recentSearches.map((t) => (
                    <li key={t}>
                      <Link to={`/search?q=${encodeURIComponent(t)}`} className="chip">
                        {t}
                      </Link>
                    </li>
                  ))}
                </ul>
                <button className="btn-ghost btn-sm mt-4" onClick={() => { actions.clearRecents(); toast.push('Search history cleared', 'info'); }}>
                  Clear history
                </button>
              </>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-display text-[17px] font-bold text-navy-800">Reset the demo</h3>
            <p className="mt-2 text-sm text-navy-500">
              Puts every listing, event, submission and setting back to the shipped dataset. Your own browser data is
              then discarded.
            </p>
            <button
              className="btn-outline mt-4 w-full"
              onClick={() => {
                actions.resetDemoData();
                toast.push('Demo data restored to the shipped dataset', 'info');
              }}
            >
              Reset demo data
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
