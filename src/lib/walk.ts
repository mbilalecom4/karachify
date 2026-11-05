/**
 * Walking legs between two recorded pins, from an OpenStreetMap router.
 *
 * The planner orders stops on straight-line distance, which is honest but is not
 * how far a person walks. This asks a router that works over OpenStreetMap's own
 * foot network and returns the real path length and an estimate of the time it
 * takes. Three rules:
 *
 *   A leg that the router refuses is said to be refused. The straight-line figure
 *   stays on screen, labelled as straight-line, rather than being quietly
 *   swapped for a number that was never returned.
 *
 *   Requests are paced. The FOSSGIS public instances ask for roughly one request
 *   per second, so legs go out one at a time with a gap between them; a plan of
 *   fifteen stops takes its time and does not get the site blocked.
 *
 *   An answer is kept for six hours. Routes between two fixed pins do not change
 *   minute to minute, and re-asking on every re-render would spend the courtesy
 *   limit on a page the visitor is already reading.
 */

export type LatLng = { lat: number; lng: number };

export type WalkLeg = {
  /** metres, along the foot network */
  metres: number;
  /** seconds, at the router's walking pace */
  seconds: number;
  /** when the router answered */
  at: number;
};

export type WalkResult = { ok: true; leg: WalkLeg } | { ok: false; reason: 'offline' | 'no-route' };

const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const TTL = 6 * 60 * 60 * 1000;
/** One leg per second, per the public instance's usage policy. */
const GAP = 1100;

const cache = new Map<string, { at: number; value: WalkResult }>();

const keyOf = (a: LatLng, b: LatLng) => `${a.lat.toFixed(5)},${a.lng.toFixed(5)};${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

/** The key a leg is filed under, so a page can look up its own answers. */
export const legKey = keyOf;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Legs run one after another, whatever order the page asks for them in. */
let queue: Promise<unknown> = Promise.resolve();

async function askRouter(a: LatLng, b: LatLng): Promise<WalkResult> {
  const url = `${ROUTER}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false&steps=false`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!res.ok) return { ok: false, reason: res.status === 404 || res.status === 400 ? 'no-route' : 'offline' };
  let body: any;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'offline' };
  }
  const route = body?.code === 'Ok' ? body?.routes?.[0] : undefined;
  if (!route || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
    return { ok: false, reason: 'no-route' };
  }
  return { ok: true, leg: { metres: route.distance, seconds: route.duration, at: Date.now() } };
}

/**
 * The walk from one point to another. Resolves when the router answers; the page
 * shows the straight-line figure until then, so a slow router delays a number
 * rather than the whole plan.
 */
export function walkLeg(a: LatLng, b: LatLng): Promise<WalkResult> {
  const key = keyOf(a, b);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.value);

  const run = async (): Promise<WalkResult> => {
    /* Re-check inside the queue: an identical leg may have been asked for while
       this one waited its turn. */
    const again = cache.get(key);
    if (again && Date.now() - again.at < TTL) return again.value;
    const value = await askRouter(a, b);
    cache.set(key, { at: Date.now(), value });
    await wait(GAP);
    return value;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** "18 min", "1 h 04 min" — the way a person reads a walking time off a page. */
export function walkMinutes(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, '0')} min` : `${hours} h`;
}

export function walkKm(metres: number) {
  return (metres / 1000).toFixed(1);
}
