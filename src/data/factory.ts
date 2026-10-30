import type { Listing } from '../types';
import { areaById } from './taxonomy';

type Seed = Partial<Listing> & Pick<Listing, 'slug' | 'categoryId' | 'areaId' | 'name' | 'description'>;

/** Deterministic jitter so demo map pins never move between reloads. */
function offset(slug: string, spread: number) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 100000;
  const a = ((h % 1000) / 1000 - 0.5) * spread;
  const b = (((h >> 10) % 1000) / 1000 - 0.5) * spread;
  return [a, b] as const;
}

const STANDARD_HOURS = [
  { day: 'Monday – Thursday', open: '10:00 – 22:00' },
  { day: 'Friday', open: '10:00 – 22:00' },
  { day: 'Saturday', open: '10:00 – 23:00' },
  { day: 'Sunday', open: '11:00 – 22:00' },
];

const CLINIC_HOURS = [
  { day: 'Monday – Saturday', open: '09:00 – 20:00' },
  { day: 'Sunday', open: 'By appointment' },
];

export function makeListing(seed: Seed): Listing {
  const area = areaById.get(seed.areaId);
  const [dLat, dLng] = offset(seed.slug, 0.016);
  const base: Listing = {
    id: seed.slug,
    cityId: 'karachi',
    lat: (area?.lat ?? 24.86) + dLat,
    lng: (area?.lng ?? 67.0) + dLng,
    address: `${area?.name ?? 'Karachi'}, Karachi`,
    rating: 4.3,
    reviewCount: 40,
    tags: [],
    facilities: [],
    featured: false,
    promoted: false,
    status: 'demo',
    createdAt: '2026-01-12',
    tagline: seed.description.split('.')[0].slice(0, 110),
    hours: STANDARD_HOURS,
    ...seed,
  } as Listing;

  if (seed.categoryId === 'doctors-clinics' && !seed.hours) base.hours = CLINIC_HOURS;
  if (seed.categoryId === 'emergency') base.hours = [{ day: 'Every day', open: '24 hours' }];
  if (!base.wiki) delete base.wiki;
  return base;
}
