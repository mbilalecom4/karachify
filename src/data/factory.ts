import type { Listing } from '../types';
import { areaById } from './taxonomy';

type Seed = Partial<Listing> & Pick<Listing, 'slug' | 'categoryId' | 'areaId' | 'name' | 'description'>;

/** Deterministic jitter so unverified map pins stay put between reloads. */
function offset(slug: string, spread: number) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 100000;
  const a = ((h % 1000) / 1000 - 0.5) * spread;
  const b = (((h >> 10) % 1000) / 1000 - 0.5) * spread;
  return [a, b] as const;
}

export function makeListing(seed: Seed): Listing {
  const area = areaById.get(seed.areaId);
  const [dLat, dLng] = offset(seed.slug, 0.016);
  const base: Listing = {
    id: seed.slug,
    cityId: 'karachi',
    lat: (area?.lat ?? 24.86) + dLat,
    lng: (area?.lng ?? 67.0) + dLng,
    coordsVerified: false,
    address: `${area?.name ?? 'Karachi'}, Karachi`,
    tags: [],
    facilities: [],
    featured: false,
    promoted: false,
    status: 'needs-review',
    createdAt: '2026-01-12',
    tagline: seed.description.split('.')[0].slice(0, 110),
    ...seed,
  } as Listing;

  if (!base.wiki) delete base.wiki;
  return base;
}
