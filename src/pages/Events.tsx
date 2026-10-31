import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, LayoutGrid, List, Search, X } from 'lucide-react';
import type { CityEvent } from '../types';
import { selectAreas, selectEvents, useDB } from '../lib/store';
import { EventCard } from '../components/cards';
import { PageHero, Note } from '../components/Page';
import { EmptyState, SectionHeading, Select, Tabs, TextInput } from '../components/ui';
import { eventCategories } from '../data/events';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Events() {
  const db = useDB();
  const events = selectEvents(db);
  const areas = selectAreas(db);
  const today = iso(new Date());

  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [q, setQ] = useState('');
  const [eventCategory, setEventCategory] = useState('all');
  const [areaId, setAreaId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [shown, setShown] = useState(9);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return events
      .filter((e) => (tab === 'upcoming' ? e.date >= today : tab === 'past' ? e.date < today : true))
      .filter((e) => (eventCategory === 'all' ? true : e.eventCategory === eventCategory))
      .filter((e) => (areaId === 'all' ? true : e.areaId === areaId))
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true))
      .filter((e) => (term ? `${e.name} ${e.description} ${e.venue} ${e.organiser} ${e.eventCategory}`.toLowerCase().includes(term) : true))
      .sort((a, b) => (tab === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [events, q, eventCategory, areaId, from, to, tab, today]);

  const counts = useMemo(
    () => ({
      upcoming: events.filter((e) => e.date >= today).length,
      past: events.filter((e) => e.date < today).length,
      all: events.length,
    }),
    [events, today]
  );

  const dirty = q !== '' || eventCategory !== 'all' || areaId !== 'all' || from !== '' || to !== '';
  const visible: CityEvent[] = filtered.slice(0, shown);

  const hero = (
    <PageHero
      mediaKey="banner-events"
      label="Events in Karachi"
      eyebrow="What's on"
      title="Events in Karachi"
      sub="Karachify lists a Karachi event only when a dated source names it — the organiser, the venue's own programme, or news coverage that states the day and the ground. Until that evidence exists for an event, it is not on this page."
      trail={[{ label: 'Home', to: '/' }, { label: 'Events' }]}
    >
      <div className="flex flex-wrap gap-2">
        <Link to="/submit-event" className="btn-primary btn-sm">
          Submit an event
        </Link>
        <Link to="/category/events" className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20">
          Event venues
        </Link>
      </div>
    </PageHero>
  );

  if (events.length === 0) {
    return (
      <div>
        {hero}
        <section className="shell section">
          <EmptyState
            title="No verified events on the board yet"
            body="This section used to hold invented programming. It is empty now because Karachify has not yet found a dated, attributable source for a Karachi event it can publish — an event appears here as soon as one does, with the source and the date it was checked attached."
            action={
              <Link to="/submit-event" className="btn-primary">
                Submit an event for review
              </Link>
            }
            icon={<CalendarDays className="h-6 w-6" />}
          />
          <div className="mt-6">
            <Note tone="info">
              For what is actually running this week, go to the venue rather than a directory: the Karachi Expo Centre,
              Pakistan Steel Auditorium, Mohatta Palace Museum, Frere Hall and TDF MagnifiScience Centre each publish
              their own programme. Every one of those venues has a Karachify page with the contact details we could
              verify.
            </Note>
          </div>
          <div className="mt-8">
            <SectionHeading
              eyebrow="Plan around the calendar you can check"
              title="Verified places, with the hours that are published"
              sub="Events are the hardest thing on this site to state honestly, so they are last. Places are not — 19 Karachi destinations already carry opening hours, admission and addresses taken from named sources."
              action={
                <Link to="/category/tourist-places" className="btn-outline btn-sm">
                  Browse places <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      {hero}

      <section className="shell section">
        <div className="mb-5">
          <Note tone="info">
            Each event here is dated against the source that announced it, and the source is linked on the event page.
            Ticket prices are quoted from that source, not estimated — if a page did not publish a price, the event says
            so.
          </Note>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            tabs={[
              { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
              { id: 'past', label: 'Past', count: counts.past },
              { id: 'all', label: 'All events', count: counts.all },
            ]}
            active={tab}
            onChange={(id) => {
              setTab(id as typeof tab);
              setShown(9);
            }}
          />
          <div className="flex items-center gap-1 rounded-full border border-navy-200 bg-white p-1">
            <button onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view" className={`rounded-full p-2 ${view === 'grid' ? 'bg-navy-800 text-white' : 'text-navy-500 hover:bg-navy-50'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view" className={`rounded-full p-2 ${view === 'list' ? 'bg-navy-800 text-white' : 'text-navy-500 hover:bg-navy-50'}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="card mb-6 flex flex-col gap-3 p-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, venues or organisers…" aria-label="Search events" className="pl-10" />
          </div>
          <Select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)} aria-label="Filter by event category" className="xl:w-52">
            <option value="all">All event types</option>
            {eventCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Filter by area" className="xl:w-48">
            <option value="all">All areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-none">
            <label className="min-w-0 flex-1 text-[13px] font-semibold text-navy-500">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input mt-1 w-full py-2" aria-label="From date" />
            </label>
            <label className="min-w-0 flex-1 text-[13px] font-semibold text-navy-500">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input mt-1 w-full py-2" aria-label="To date" />
            </label>
          </div>
          {dirty && (
            <button
              className="btn-outline btn-sm self-start xl:self-auto"
              onClick={() => {
                setQ('');
                setEventCategory('all');
                setAreaId('all');
                setFrom('');
                setTo('');
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        <p className="mb-4 text-sm text-navy-500">
          {filtered.length} event{filtered.length === 1 ? '' : 's'} {dirty ? 'match your filters' : 'on the board'}
        </p>

        {visible.length === 0 ? (
          <EmptyState
            title="No events match those filters"
            body="Widen the date range, clear the area or event-type filter, or switch to the All events tab."
            action={
              <button
                className="btn-outline"
                onClick={() => {
                  setTab('all');
                  setQ('');
                  setEventCategory('all');
                  setAreaId('all');
                  setFrom('');
                  setTo('');
                }}
              >
                Reset and show all
              </button>
            }
            icon={<CalendarDays className="h-6 w-6" />}
          />
        ) : view === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {visible.map((e) => (
              <EventCard key={e.id} event={e} view="list" />
            ))}
          </div>
        )}

        {shown < filtered.length && (
          <div className="mt-9 flex flex-col items-center gap-3">
            <p className="text-sm text-navy-500">
              Showing {visible.length} of {filtered.length}
            </p>
            <button className="btn-outline" onClick={() => setShown((s) => s + 9)}>
              Load more events
            </button>
          </div>
        )}
      </section>

      <section className="bg-white py-12">
        <div className="shell">
          <div className="flex flex-wrap gap-2">
            {eventCategories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setEventCategory(c);
                  setTab('all');
                  setShown(9);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="chip"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
