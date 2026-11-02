// Fetch real Karachi places from OpenStreetMap via the Overpass API.
// Data (c) OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('_raw/osm');
const BBOX = '24.75,66.85,25.05,67.35'; // south,west,north,east (greater Karachi)

export const GROUPS = {
  restaurants: ['nwr["amenity"="restaurant"]'],
  cafes: ['nwr["amenity"="cafe"]'],
  fast_food: ['nwr["amenity"="fast_food"]'],
  hotels: ['nwr["tourism"~"^(hotel|guest_house|hostel|apartment|motel)$"]'],
  hospitals: ['nwr["amenity"~"^(hospital|clinic)$"]'],
  universities: ['nwr["amenity"~"^(university|college)$"]'],
  schools: ['nwr["amenity"="school"]'],
  parks: ['nwr["leisure"~"^(park|garden|playground|nature_reserve)$"]'],
  attractions: ['nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park)$"]'],
  beaches: ['nwr["natural"="beach"]'],
  religious: ['nwr["amenity"="place_of_worship"]'],
  shopping: ['nwr["shop"~"^(mall|department_store|supermarket|marketplace|clothes|electronics|jewelry)$"]'],
  pharmacies: ['nwr["amenity"="pharmacy"]'],
  transport: ['nwr["aeroway"="aerodrome"]', 'nwr["amenity"="bus_station"]', 'nwr["railway"="station"]'],
  events_venues: ['nwr["amenity"~"^(events_venue|conference_centre|community_centre)$"]'],
  sports: ['nwr["leisure"~"^(stadium|sports_centre|fitness_centre|swimming_pool|bowling_alley)$"]'],
  government: ['nwr["office"="government"]'],
  banks: ['nwr["amenity"="bank"]'],
  fuel: ['nwr["amenity"="fuel"]'],
  art_culture: ['nwr["amenity"~"^(arts_centre|theatre|cinema)$"]'],
  emergency: ['nwr["amenity"~"^(police|fire_station)$"]'],
};

function query(selectors) {
  return `[out:json][timeout:120];(${selectors.map((s) => `${s}(${BBOX});`).join('')});out center tags;`;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
];

async function overpass(selectors, attempt = 1) {
  const body = 'data=' + encodeURIComponent(query(selectors));
  const endpoint = ENDPOINTS[(attempt - 1) % ENDPOINTS.length];
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'KarachifyResearch/1.0 (open data research; contact: mbilalecom4)',
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText} @ ${endpoint}`);
    return await res.json();
  } catch (err) {
    if (attempt <= 6) {
      await new Promise((r) => setTimeout(r, 4000 * attempt));
      return overpass(selectors, attempt + 1);
    }
    throw err;
  }
}

const wanted = process.argv.slice(2);
const groups = wanted.length ? wanted : Object.keys(GROUPS);
await mkdir(OUT, { recursive: true });

for (const g of groups) {
  if (!GROUPS[g]) throw new Error(`Unknown group ${g}`);
  process.stdout.write(`${g} ... `);
  try {
    const data = await overpass(GROUPS[g]);
    const elements = (data.elements ?? []).filter((e) => e.tags && (e.tags.name || e.tags['name:en']));
    await writeFile(path.join(OUT, `${g}.json`), JSON.stringify({ group: g, fetchedAt: new Date().toISOString(), elements }, null, 1));
    console.log(`${elements.length} named places`);
  } catch (e) {
    console.log(`FAILED (${e.message})`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
