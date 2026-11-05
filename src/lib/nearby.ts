/**
 * The three things a person asks for at the worst moment: a pharmacy, a
 * hospital, a doctor — and, on a Saturday, an ATM.
 *
 * Two sources, and the panel always says which one it is using.
 *
 *   The shipped snapshot is `public/data/nearby.json`: every pharmacy, hospital
 *   and clinic in the OpenStreetMap dump Karachify was built from, read on the
 *   date that file states. It answers instantly, works offline, and never
 *   invents a row. What the dump does not hold — ATMs above all — is declared
 *   missing rather than shown as an empty category.
 *
 *   The live read asks a public Overpass server for whatever is mapped within
 *   the radius right now. Those servers are shared by everyone on the internet
 *   and say "busy" often, so a failure is reported as a failure and the
 *   snapshot stays on screen. Nothing is cached from it: a list of what existed
 *   last Tuesday is not a pharmacy you can walk to.
 */

import { distanceKm } from './format';

export type NearbyKind = 'pharmacy' | 'hospital' | 'clinic' | 'atm';

export type NearbyPlace = {
  name: string;
  kind: NearbyKind;
  lat: number;
  lng: number;
  /** the OpenStreetMap element behind it, e.g. `node/12260921120` */
  osm?: string;
  areaId?: string;
  phone?: string;
};

export type NearbyHit = NearbyPlace & { km: number };

export type Snapshot = {
  licence: string;
  retrievedAt: string;
  kinds: NearbyKind[];
  notCovered: NearbyKind[];
  total: number;
  records: NearbyPlace[];
};

export type LiveResult = { ok: true; places: NearbyHit[]; server: string; at: number } | { ok: false; reason: LiveFailure };

export type LiveFailure = 'busy' | 'offline' | 'no-answer';

export const KIND_LABEL: Record<NearbyKind, string> = {
  pharmacy: 'Pharmacy',
  hospital: 'Hospital',
  clinic: 'Clinic or doctor',
  atm: 'ATM',
};

/*
 * Public Overpass instances, most authoritative first. Every one of them is
 * rate-limited and several are frequently saturated, so the list is walked in
 * order and whatever answered is named on screen.
 */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const PER_ATTEMPT_MS = 20000;

let snapshotRequest: Promise<Snapshot> | null = null;

/** Loaded once per visit; the file is static, so nobody asks for it twice. */
export function loadSnapshot(): Promise<Snapshot> {
  if (!snapshotRequest) {
    snapshotRequest = fetch(`${import.meta.env.BASE_URL}data/nearby.json`, { headers: { accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<Snapshot>;
      })
      .catch((err) => {
        /* A failed load must not sit in the cache as a resolved promise. */
        snapshotRequest = null;
        throw err;
      });
  }
  return snapshotRequest;
}

/** Everything of one kind within `metres` of the point, nearest first. */
export function fromSnapshot(snapshot: Snapshot, lat: number, lng: number, metres: number): NearbyHit[] {
  return snapshot.records
    .map((r) => ({ ...r, km: distanceKm({ lat, lng }, { lat: r.lat, lng: r.lng }) }))
    .filter((r) => r.km * 1000 <= metres)
    .sort((a, b) => a.km - b.km || a.name.localeCompare(b.name));
}

function query(lat: number, lng: number, metres: number) {
  return (
    `[out:json][timeout:20];` +
    `nwr(around:${Math.round(metres)},${lat},${lng})["amenity"~"^(pharmacy|hospital|clinic|doctors|atm)$"];` +
    `out center 80;`
  );
}

const KIND_OF: Record<string, NearbyKind> = { pharmacy: 'pharmacy', hospital: 'hospital', clinic: 'clinic', doctors: 'clinic', atm: 'atm' };

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Ask each public server in turn, and stop at the first that answers.
 *
 * A 429 or 504 means "somebody else is already using this server", which is a
 * different thing from the internet being down, and the panel words them
 * differently because of it.
 */
export async function askOverpass(lat: number, lng: number, metres: number): Promise<LiveResult> {
  const body = `data=${encodeURIComponent(query(lat, lng, metres))}`;
  let busy = false;
  for (const endpoint of OVERPASS) {
    const signal = AbortSignal.timeout(PER_ATTEMPT_MS);
    let res: Response;
    try {
      res = await fetch(endpoint, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal });
    } catch {
      continue;
    }
    if (res.status === 429 || res.status === 504 || res.status >= 500) {
      busy = true;
      continue;
    }
    if (!res.ok) {
      busy = true;
      continue;
    }
    let json: { elements?: OverpassElement[] };
    try {
      json = (await res.json()) as { elements?: OverpassElement[] };
    } catch {
      busy = true;
      continue;
    }
    if (!Array.isArray(json.elements)) return { ok: false, reason: 'no-answer' };
    const at = Date.now();
    const server = new URL(endpoint).hostname;
    const places = json.elements
      .map((el) => elementToPlace(el))
      .filter((p): p is NearbyPlace => p !== null)
      .map((p) => ({ ...p, km: distanceKm({ lat, lng }, { lat: p.lat, lng: p.lng }) }))
      /* A way is matched when any part of it falls inside the radius, so its
         mapped centre can sit outside. The panel measures from that centre, so
         it lists only what it can honestly say is within it. */
      .filter((p) => p.km * 1000 <= metres)
      .sort((a, b) => a.km - b.km || a.name.localeCompare(b.name));
    return { ok: true, places, server, at };
  }
  return { ok: false, reason: busy ? 'busy' : 'offline' };
}

function elementToPlace(el: OverpassElement): NearbyPlace | null {
  const t = el.tags;
  const kind = t ? KIND_OF[t.amenity ?? ''] : undefined;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!kind || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = t?.name || t?.["name:ur"] || t?.operator || '';
  /* An unnamed cluster of tags is not something a visitor can walk to; writing
     "Unnamed pharmacy" would be Karachify inventing a label OSM does not have. */
  if (!name) return null;
  const osm = el.type && el.id ? `${el.type}/${el.id}` : undefined;
  return { name, kind, lat: lat as number, lng: lng as number, osm, phone: t?.phone };
}

export const LIVE_FAILURE_COPY: Record<LiveFailure, string> = {
  busy: 'OpenStreetMap’s public servers are shared by everyone and both of them were busy. Nothing was invented to fill the gap.',
  offline: 'This device could not reach any OpenStreetMap server, so there is no live answer to show.',
  'no-answer': 'A server replied, but not with a list Karachify can read, so nothing is claimed.',
};

/** `node/12260921120` → the element page, so every row can be checked. */
export const osmUrl = (osm?: string) => (osm ? `https://www.openstreetmap.org/${osm}` : undefined);
