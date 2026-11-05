/**
 * Where the visitor is, and what can honestly be said about it.
 *
 * Three rules run through this file, and they are the site's rules rather than
 * this module's:
 *
 * Nothing is looked up until the visitor asks. No call here runs on page load, so
 * a coordinate is only ever taken after a button press and the browser's own
 * prompt.
 *
 * A lookup that fails is reported as failing. There is no default coordinate, no
 * "central Karachi" standing in for a place nobody named, and no label invented
 * for a point the geocoder did not recognise.
 *
 * Every answer carries where it came from and when, because the page has to be
 * able to say that out loud.
 */

export type GeoFailure = {
  ok: false;
  /** What the visitor should be told, in the site's own words. */
  reason: 'unsupported' | 'denied' | 'timeout' | 'unavailable' | 'offline' | 'no-match';
  detail?: string;
};

export type GeoSuccess = {
  ok: true;
  lat: number;
  lng: number;
  /** Metres, when the source gave an uncertainty. A coarse area centre has none. */
  accuracy?: number;
  label: string;
  /** Which lookup this came from, shown next to the answer. */
  source: 'device' | 'nominatim' | 'area';
  /** ISO timestamp of the lookup. */
  at: string;
};

export type GeoPoint = GeoSuccess | GeoFailure;

const fail = (reason: GeoFailure['reason'], detail?: string): GeoFailure => ({ ok: false, reason, detail });

/** Karachi's bounding box, used to keep a typed search inside the city. */
const KARACHI_VIEWBOX = '66.70,25.15,67.35,24.55';

export const FAILURE_COPY: Record<GeoFailure['reason'], string> = {
  unsupported: 'This browser does not offer a location to the page, so there is nothing for Karachify to ask.',
  denied: 'The browser was asked for a location and the answer was no. Nothing was sent anywhere.',
  timeout: 'The device did not answer in time. A signal indoors often takes longer than a minute.',
  unavailable: 'The device could not get a fix just now. Try again once it has a signal.',
  offline: 'This lookup needs a connection, and the service could not be reached.',
  'no-match': 'That place was not found in Karachi. Karachify does not guess which one you meant.',
};

/**
 * Ask the browser for the device position. The browser shows its own prompt;
 * this never runs by itself.
 */
export function whereAmI(): Promise<GeoPoint> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(fail('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy && pos.coords.accuracy > 0 ? Math.round(pos.coords.accuracy) : undefined,
          // The device knows a point but not its name, so the label says exactly
          // what it is: coordinates, and nothing more specific than that.
          label: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
          source: 'device',
          at: new Date().toISOString(),
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) return resolve(fail('denied'));
        if (error.code === error.TIMEOUT) return resolve(fail('timeout'));
        return resolve(fail('unavailable', error.message));
      },
      // A fix can take a while on a phone; holding the button spinning for ten
      // minutes would look like the site had frozen.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

type NominatimRow = {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  addresstype?: string;
  type?: string;
  address?: Record<string, string>;
};

/** One GET to OpenStreetMap's geocoder, with an honest failure either way. */
async function nominatim(url: string): Promise<{ ok: true; row: NominatimRow } | GeoFailure> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return fail('offline', `OpenStreetMap answered ${res.status}.`);
    const body = (await res.json()) as NominatimRow | NominatimRow[];
    const row = Array.isArray(body) ? body[0] : body;
    if (!row || !row.lat || !row.lon) return fail('no-match');
    return { ok: true, row };
  } catch {
    return fail('offline');
  }
}

/**
 * The shortest name that still identifies the place. A raw `display_name` runs to
 * six or seven commas including the country, so the named parts are preferred and
 * the display string is the fallback rather than the default.
 */
function placeParts(row: NominatimRow): string[] {
  const a = row.address ?? {};
  const parts = [a.amenity, a.building, a.shop, a.leisure, a.road, a.footway, a.neighbourhood, a.suburb, a.city_district, a.city, a.town, a.village].filter(
    (v): v is string => Boolean(v),
  );
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  if (unique.length) return unique.slice(0, 3);
  if (row.name) return [row.name];
  if (row.display_name) return [row.display_name.split(',').slice(0, 3).join(', ').trim()];
  return [];
}

/** Turn a point into the place name OpenStreetMap has for it, if it has one. */
export async function labelPoint(lat: number, lng: number): Promise<GeoPoint> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&zoom=14&format=jsonv2`;
  const answer = await nominatim(url);
  if (!answer.ok) return answer;
  const parts = placeParts(answer.row);
  if (!parts.length) return fail('no-match');
  return {
    ok: true,
    lat,
    lng,
    label: parts.join(', '),
    source: 'nominatim',
    at: new Date().toISOString(),
  };
}

/** Look up a name the visitor typed, inside Karachi only. */
export async function searchKarachi(query: string): Promise<GeoPoint> {
  const q = query.trim();
  if (q.length < 2) return fail('no-match');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=${KARACHI_VIEWBOX}&q=${encodeURIComponent(q)}`;
  const answer = await nominatim(url);
  if (!answer.ok) return answer;
  const parts = placeParts(answer.row);
  if (!parts.length) return fail('no-match');
  return {
    ok: true,
    lat: Number(answer.row.lat),
    lng: Number(answer.row.lon),
    label: parts.join(', '),
    source: 'nominatim',
    at: new Date().toISOString(),
  };
}

/** The middle of a recorded area — a locality centre, not anybody's street. */
export function fromArea(area: { name: string; lat: number; lng: number }): GeoSuccess {
  return { ok: true, lat: area.lat, lng: area.lng, label: `${area.name} (area centre)`, source: 'area', at: new Date().toISOString() };
}
