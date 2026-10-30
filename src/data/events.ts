import type { CityEvent } from '../types';

/**
 * Every event here is a SAMPLE record. None of these are presented as confirmed
 * real events — the UI labels the whole section as demo programming.
 *
 * Authored dates are shifted as a block so the demo keeps a realistic mix of
 * upcoming and past programming whenever the site is opened, while preserving
 * the spacing between records.
 */
const E = 'events';

const AUTHORED_ANCHOR = Date.UTC(2026, 10, 3); // 2026-11-03, the first upcoming record
const DEMO_SHIFT_DAYS = Math.round((Date.now() - AUTHORED_ANCHOR) / 86400000);

function rebase(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + DEMO_SHIFT_DAYS);
  return d.toISOString().slice(0, 10);
}

const ev = (e: Omit<CityEvent, 'cityId' | 'status' | 'date' | 'endDate'> & {
  date: string;
  endDate?: string;
  status?: CityEvent['status'];
}): CityEvent => ({
  cityId: 'karachi',
  status: 'demo',
  ...e,
  date: rebase(e.date)!,
  endDate: rebase(e.endDate),
});

export const events: CityEvent[] = [
  ev({
    id: 'karachi-food-festival-2026',
    slug: 'karachi-food-festival-2026',
    categoryId: E,
    name: 'Karachi Food Festival',
    description:
      'Three days of grills, biryani counters and dessert stalls on the expo lawn, with regional chefs and the street-food blocks the city argues about.',
    wiki: ['Street food', 'Biryani', 'Karachi'],
    date: '2026-11-20',
    endDate: '2026-11-22',
    startTime: '16:00',
    endTime: '23:00',
    venue: 'Karachi Expo Centre',
    areaId: 'gulshan-e-iqbal',
    eventCategory: 'Food Festivals',
    ticketPrice: 'PKR 500 (demo)',
    ticketNote: 'Sample pricing — not a real ticket sale.',
    organiser: 'Karachify Demo Programming',
    lat: 24.813,
    lng: 67.099,
  }),
  ev({
    id: 'sufi-night-data-darbar',
    slug: 'sufi-qawwali-night',
    categoryId: E,
    name: 'Qawwali Night at the Shrine Quarter',
    description:
      'An evening of qawwali and kalam in the courtyard tradition of the old city, with the amplification and crowd arrangements a shrine-adjacent event needs.',
    wiki: ['Qawwali', 'Data Darbar Shrine'],
    date: '2026-11-07',
    startTime: '19:30',
    endTime: '23:00',
    venue: 'Data Darbar courtyard (sample venue)',
    areaId: 'saddar',
    eventCategory: 'Cultural',
    ticketPrice: 'Free (demo)',
    ticketNote: 'Sample listing for the cultural-events layout.',
    organiser: 'Karachify Demo Programming',
    lat: 24.862,
    lng: 67.009,
  }),
  ev({
    id: 'psc-super-series-final',
    slug: 'psc-super-series-final',
    categoryId: E,
    name: 'Domestic Cricket Final — National Stadium',
    description:
      'Day-three knockout fixture under the floodlights, with the pavilion end reserved for families and the general enclosure on general tickets.',
    wiki: ['National Stadium, Karachi', 'Cricket'],
    date: '2026-11-14',
    startTime: '10:00',
    endTime: '18:00',
    venue: 'National Stadium',
    areaId: 'saddar',
    eventCategory: 'Sports',
    ticketPrice: 'PKR 200 – 1,500 (demo)',
    ticketNote: 'Sample fixture and pricing.',
    organiser: 'Karachify Demo Programming',
    lat: 24.863,
    lng: 67.002,
  }),
  ev({
    id: 'book-fair-karachi',
    slug: 'karachi-book-fair',
    categoryId: E,
    name: 'Karachi Book Fair',
    description:
      'Publishers, Urdu and English stalls, the children\'s corner and the afternoon talks that turn the hall into a three-day reading queue.',
    wiki: ['Book fair', 'Frere Hall'],
    date: '2026-12-04',
    endDate: '2026-12-08',
    startTime: '11:00',
    endTime: '21:00',
    venue: 'Frere Hall lawns & hall',
    areaId: 'saddar',
    eventCategory: 'Exhibitions',
    ticketPrice: 'Free entry (demo)',
    ticketNote: 'Sample event used to demonstrate the exhibitions layout.',
    organiser: 'Karachify Demo Programming',
    lat: 24.858,
    lng: 67.011,
  }),
  ev({
    id: 'tech-summit-shahrah',
    slug: 'karachi-tech-summit',
    categoryId: E,
    name: 'Karachi Tech & Startup Summit',
    description:
      'Two-track conference on payments, logistics and export work, with the founder pitch stage and the hiring hall that follows.',
    wiki: ['Startup company', 'Conference'],
    date: '2026-11-27',
    endDate: '2026-11-28',
    startTime: '09:00',
    endTime: '18:00',
    venue: 'Aga Khan University Conference Centre',
    areaId: 'gulshan-e-iqbal',
    eventCategory: 'Conferences',
    ticketPrice: 'PKR 4,000 (demo)',
    ticketNote: 'Sample delegate fee.',
    organiser: 'Karachify Demo Programming',
    lat: 24.828,
    lng: 67.092,
  }),
  ev({
    id: 'ajrak-craft-workshop',
    slug: 'ajrak-block-print-workshop',
    categoryId: E,
    name: 'Block-Print & Ajrak Workshop',
    description:
      'Hands-on afternoon at a craft studio: resist-printing a scarf, the natural-dye explanation and the drying line, with materials provided.',
    wiki: ['Ajrak', 'Block printing', 'Sindhi cap'],
    date: '2026-11-08',
    startTime: '15:00',
    endTime: '19:00',
    venue: 'Craft studio, DHA Phase 8',
    areaId: 'dha',
    eventCategory: 'Workshops',
    ticketPrice: 'PKR 2,500 incl. materials (demo)',
    ticketNote: 'Sample workshop fee.',
    organiser: 'Karachify Demo Programming',
    lat: 24.8,
    lng: 67.06,
  }),
  ev({
    id: 'kids-carnival-ocean-park',
    slug: 'childrens-carnival',
    categoryId: E,
    name: 'Children\'s Carnival & Water Day',
    description:
      'Family ticket day with the wave pool open to children, face-painting, the bounce rows and the safety-pair wristband system.',
    wiki: ['Amusement park', 'Water park'],
    date: '2026-11-29',
    startTime: '11:00',
    endTime: '19:00',
    venue: 'Ocean Park Karachi',
    areaId: 'dha',
    eventCategory: 'Family',
    ticketPrice: 'PKR 1,200 child / 1,800 adult (demo)',
    ticketNote: 'Sample admission band.',
    organiser: 'Karachify Demo Programming',
    lat: 24.802,
    lng: 67.065,
  }),
  ev({
    id: 'muharram-procession-notes',
    slug: 'muharram-community-programme',
    categoryId: E,
    name: 'Muharram Community Programme — Civic Notes',
    description:
      'Sample civic-information listing showing how the site handles religious-calendar entries: route advisories, crowd management and langar timings, with no claim to be the organiser.',
    wiki: ['Muharram', 'Ashura'],
    date: '2026-12-18',
    startTime: '07:00',
    endTime: '22:00',
    venue: 'City-wide (sample advisory)',
    areaId: 'saddar',
    eventCategory: 'Religious',
    ticketPrice: 'Free',
    ticketNote: 'Civic advisory record, not a ticketed event.',
    organiser: 'Karachify Demo Programming',
    lat: 24.862,
    lng: 67.009,
  }),
  ev({
    id: 'theatre-night-lumbini',
    slug: 'urdu-theatre-night',
    categoryId: E,
    name: 'Urdu One-Act Theatre Night',
    description:
      'Four short plays from the college and community circuit, with interval chai and the stage lighting the hall was wired for.',
    wiki: ['Urdu theatre', 'One-act play'],
    date: '2026-12-12',
    startTime: '18:30',
    endTime: '22:00',
    venue: 'Community hall, Lumbini adjacent',
    areaId: 'saddar',
    eventCategory: 'Theatre',
    ticketPrice: 'PKR 800 (demo)',
    ticketNote: 'Sample ticket band.',
    organiser: 'Karachify Demo Programming',
    lat: 24.866,
    lng: 67.013,
  }),
  ev({
    id: 'marathon-seaview',
    slug: 'karachi-coastal-run',
    categoryId: E,
    name: 'Coastal Run — 5K, 10K & Half',
    description:
      'Road-closed morning run along Marine Drive with the start wave at Sea View, hydration at every two kilometres and the prize desk at the park.',
    wiki: ['Marathon', 'Road running'],
    date: '2027-01-17',
    startTime: '06:00',
    endTime: '11:00',
    venue: 'Marine Drive, Sea View',
    areaId: 'saddar',
    eventCategory: 'Sports',
    ticketPrice: 'PKR 1,500 (demo)',
    ticketNote: 'Sample registration fee.',
    organiser: 'Karachify Demo Programming',
    lat: 24.822,
    lng: 66.993,
  }),
  ev({
    id: 'art-exhibit-mohatta',
    slug: 'monsoon-art-exhibit',
    categoryId: E,
    name: 'Seasonal Art Exhibit at the Palace Museum',
    description:
      'Juried show of painting, photography and ceramic work in the palace galleries, with the opening night and the two-week public run.',
    wiki: ['Mohatta Palace', 'Art exhibition'],
    date: '2026-11-03',
    endDate: '2026-11-17',
    startTime: '11:00',
    endTime: '20:00',
    venue: 'Mohatta Palace Museum',
    areaId: 'clifton',
    eventCategory: 'Exhibitions',
    ticketPrice: 'PKR 300 (demo)',
    ticketNote: 'Sample entry fee.',
    organiser: 'Karachify Demo Programming',
    lat: 24.812,
    lng: 67.027,
  }),
  ev({
    id: 'community-cleanup-hawkesbay',
    slug: 'beach-cleanup-drive',
    categoryId: E,
    name: 'Beach Cleanup Drive — Community',
    description:
      'Volunteer morning with gloves and sacks provided at the beach entrance, the sorted-waste handover to the transport contractor and the tea at the end.',
    wiki: ['Beach cleanup', 'Karachi beach'],
    date: '2026-11-22',
    startTime: '07:00',
    endTime: '11:00',
    venue: 'Hawke\'s Bay beach entrance',
    areaId: 'kemari',
    eventCategory: 'Community',
    ticketPrice: 'Free',
    ticketNote: 'Volunteer participation, no charge.',
    organiser: 'Karachify Demo Programming',
    lat: 24.789,
    lng: 66.94,
  }),
  ev({
    id: 'eid-mela-clifton',
    slug: 'eid-mela-clifton',
    categoryId: E,
    name: 'Eid Mela & Fun Fair',
    description:
      'Three-day mela on the park strip with rides, the food row, kids\' competitions and the closing-night performance.',
    wiki: ['Eid', 'Funfair'],
    date: '2026-12-26',
    endDate: '2026-12-28',
    startTime: '16:00',
    endTime: '23:00',
    venue: 'Clifton park strip (sample)',
    areaId: 'clifton',
    eventCategory: 'Festivals',
    ticketPrice: 'PKR 100 entry, rides separately (demo)',
    ticketNote: 'Sample pricing.',
    organiser: 'Karachify Demo Programming',
    lat: 24.811,
    lng: 67.031,
  }),
  ev({
    id: 'wedding-expo',
    slug: 'wedding-and-lifestyle-expo',
    categoryId: E,
    name: 'Wedding & Lifestyle Expo',
    description:
      'Halls, caterers, photographers, jewellery and the decor contractors in one hall, with the runway slots and the booking desks.',
    wiki: ['Wedding', 'Exhibition center'],
    date: '2026-12-05',
    endDate: '2026-12-06',
    startTime: '13:00',
    endTime: '22:00',
    venue: 'Lucky One Mall event floor',
    areaId: 'gulshan-e-iqbal',
    eventCategory: 'Exhibitions',
    ticketPrice: 'Free entry (demo)',
    ticketNote: 'Sample show listing.',
    organiser: 'Karachify Demo Programming',
    lat: 24.809,
    lng: 67.108,
  }),
  ev({
    id: 'poetry-mushaira',
    slug: 'urdu-poetry-mushaira',
    categoryId: E,
    name: 'Mushaira — Urdu Poetry Evening',
    description:
      'Open mushaira with the ghazal and nazm slots, the chair\'s talqeen and the audience-refrain format, in a university auditorium.',
    wiki: ['Mushaira', 'Ghazal', 'Urdu poetry'],
    date: '2026-11-15',
    startTime: '17:00',
    endTime: '21:00',
    venue: 'University auditorium, Gulshan-e-Iqbal',
    areaId: 'gulshan-e-iqbal',
    eventCategory: 'Cultural',
    ticketPrice: 'Free / invitation (demo)',
    ticketNote: 'Sample listing.',
    organiser: 'Karachify Demo Programming',
    lat: 24.825,
    lng: 67.095,
  }),
  ev({
    id: 'winter-food-trail-2026',
    slug: 'winter-food-trail-2026',
    categoryId: E,
    name: 'Winter Food Trail (past event)',
    description:
      'Closed sample event kept to show the past-events archive, the photo recap layout and how results are rendered for finished programming.',
    wiki: ['Street food', 'Karachi'],
    date: '2026-09-12',
    endDate: '2026-09-13',
    startTime: '17:00',
    endTime: '23:00',
    venue: 'Port Grand (sample)',
    areaId: 'saddar',
    eventCategory: 'Food Festivals',
    ticketPrice: 'PKR 700 (demo)',
    ticketNote: 'Past sample event.',
    organiser: 'Karachify Demo Programming',
    lat: 24.849,
    lng: 66.999,
  }),
  ev({
    id: 'karting-championship-2026',
    slug: 'karting-championship-round-past',
    categoryId: E,
    name: 'Karting Championship Round (past event)',
    description:
      'Archive record for the motorsport round held earlier in the season, used to check the past-event timeline and results block.',
    wiki: ['Karting', 'Race track'],
    date: '2026-08-09',
    startTime: '09:00',
    endTime: '17:00',
    venue: 'Track venue (sample)',
    areaId: 'dha',
    eventCategory: 'Sports',
    ticketPrice: 'PKR 500 (demo)',
    ticketNote: 'Past sample event.',
    organiser: 'Karachify Demo Programming',
    lat: 24.818,
    lng: 67.055,
  }),
];

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

export const eventCategories = Array.from(new Set(events.map((e) => e.eventCategory))).sort();
