import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Heart, MapPin } from 'lucide-react';
import { prefsFor, selectEvents, selectListings, useDB } from '../lib/store';
import { EmptyState, Tabs } from '../components/ui';
import { Note } from '../components/Page';
import { EventCard, ListingCard } from '../components/cards';
import { plural } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export default function Saved() {
  useDocumentTitle('Saved places and events');
  const db = useDB();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'events' ? 'events' : 'places';
  const prefs = prefsFor(db);

  const listings = selectListings(db);
  const events = selectEvents(db);
  const favourites = prefs.favouriteListings
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  const savedEvents = prefs.savedEvents
    .map((id) => events.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  return (
    <div className="shell section">
      <p className="eyebrow">Your collection</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-navy-800">Saved in Karachify</h1>
      <p className="section-sub">
        Favourite places and bookmarked events for the current session — {plural(favourites.length, 'place')} and{' '}
        {plural(savedEvents.length, 'event')}.
      </p>
      <Note className="mt-5">
        Guest saves live in this browser under the guest profile.{' '}
        <Link to="/signup" className="link">
          Create a demo account
        </Link>{' '}
        to keep favourites and enquiries separated per person using the same machine.
      </Note>

      <div className="mt-7 max-w-md">
        <Tabs
          active={tab}
          onChange={(id) => setParams(id === 'events' ? { tab: 'events' } : {})}
          tabs={[
            { id: 'places', label: 'Places', count: favourites.length },
            { id: 'events', label: 'Events', count: savedEvents.length },
          ]}
        />
      </div>

      {tab === 'places' ? (
        favourites.length === 0 ? (
          <div className="mt-7">
            <EmptyState
              icon={<Heart className="h-6 w-6" />}
              title="No saved places yet"
              body="Tap the heart on any listing card or detail page and it will appear here — including after you reload the page."
              action={
                <Link to="/explore" className="btn-primary mt-1">
                  <MapPin className="h-4 w-4" /> Explore Karachi
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favourites.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )
      ) : savedEvents.length === 0 ? (
        <div className="mt-7">
          <EmptyState
            icon={<CalendarCheck className="h-6 w-6" />}
            title="No saved events yet"
            body="Open an event and use “Save event” to keep it here. The board is empty until Karachify can date-source an event, so there may be nothing to save yet."
            action={
              <Link to="/events" className="btn-primary mt-1">
                Browse the event board
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {savedEvents.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
