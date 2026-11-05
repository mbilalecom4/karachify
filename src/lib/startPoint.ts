/**
 * The point this device has already been asked to remember.
 *
 * Two pages want it: the day planner uses it to order stops, a place page uses it
 * to answer "how far is that on foot". Both read the same two kinds of answer —
 * the point the planner was given, and a point given on a place page — and the
 * panel that shows a figure always says which of the two it used, because a
 * coordinate from yesterday is not the visitor's position now.
 *
 * Nothing here looks anything up. A point exists only because a button was
 * pressed somewhere on this device, and a failed lookup never leaves a point
 * behind.
 */
import type { GeoSuccess } from './geo';

/** Where the day starts. Kept on this device only, and only after a button press. */
export type Start = GeoSuccess & {
  /** Set when a device coordinate was given a name by OpenStreetMap afterwards. */
  named?: 'nominatim';
};

/** How each kind of start was obtained, in the words shown beside it. */
const SOURCE_LINE: Record<Start['source'], string> = {
  device: 'a position this device offered when you asked it to',
  nominatim: 'a place you typed, found on OpenStreetMap',
  area: 'the centre of an area you picked',
};

/** A device coordinate arrives nameless; say who supplied the name it now has. */
export function sourceLine(start: Start) {
  return SOURCE_LINE[start.source] + (start.named ? ' · the name is OpenStreetMap’s' : '');
}

const PLAN_KEY = 'karachify.plan.v2';
const HERE_KEY = 'karachify.walkfrom.v1';

function read(key: string): Start | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    const start = key === PLAN_KEY ? value?.start : value;
    if (!start || typeof start.lat !== 'number' || typeof start.lng !== 'number' || !start.source) return null;
    return start as Start;
  } catch {
    /* a corrupt entry is no better than no entry */
    return null;
  }
}

/** The point a place page was given, or the planner's, whichever was set here. */
export function knownStart(): { start: Start; from: 'here' | 'plan' } | null {
  const here = read(HERE_KEY);
  if (here) return { start: here, from: 'here' };
  const plan = read(PLAN_KEY);
  if (plan) return { start: plan, from: 'plan' };
  return null;
}

/** Forget the place page's own point; the planner's is not this page's to clear. */
export function saveHereStart(start: Start | null) {
  try {
    if (start) localStorage.setItem(HERE_KEY, JSON.stringify(start));
    else localStorage.removeItem(HERE_KEY);
  } catch {
    /* storage full or blocked — the figure still shows for this visit */
  }
}

/** Whose point this is, in the words shown under the figure. */
export function originLine(origin: { start: Start; from: 'here' | 'plan' }) {
  return origin.from === 'plan'
    ? `the start point you gave the day planner · ${sourceLine(origin.start)}`
    : sourceLine(origin.start);
}
