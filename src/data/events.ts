import type { CityEvent } from '../types';

/**
 * Karachi's event board is deliberately empty.
 *
 * An event is added here only when a dated, attributable source names it — the
 * organiser's own page, a venue's published programme, or news coverage that
 * states the date and the venue — and that evidence is merged in from
 * docs/verification/batch-e-events.json by .tools/apply-verification.mjs.
 * Inventing programming, dates, venues or ticket prices to fill this section
 * was the old demo behaviour and is gone: an honest "nothing verified yet"
 * state is more useful to a visitor than a plausible-looking fixture.
 *
 * Events submitted by organisers through /submit-event and approved in the
 * admin panel still appear here; they are stored per browser in localStorage
 * and badged with the status the reviewer set.
 */
export const events: CityEvent[] = [];

const today = new Date().toISOString().slice(0, 10);

export const upcomingEvents = events
  .filter((e) => (e.endDate ?? e.date) >= today)
  .sort((a, b) => a.date.localeCompare(b.date));

export const pastEvents = events
  .filter((e) => e.date < today)
  .sort((a, b) => b.date.localeCompare(a.date));

export function getEvent(slug: string) {
  return events.find((e) => e.slug === slug || e.id === slug);
}

/** Event types offered as filters; derived, so it can never drift from the data. */
export const eventCategories = Array.from(new Set(events.map((e) => e.eventCategory))).sort();
