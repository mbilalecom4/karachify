import { attractions } from './attractions';
import { culture } from './culture';
import { civic } from './civic';
import { dining } from './dining';
import { education } from './education';
import { health } from './health';
import { parksAndBeaches } from './parks';
import { shopping } from './shopping';
import { stays } from './stays';
import type { Listing } from '../../types';
import { applyVerified, verifiedNewListings } from '../verified';

const seeded: Listing[] = [
  ...attractions,
  ...dining,
  ...stays,
  ...shopping,
  ...parksAndBeaches,
  ...health,
  ...education,
  ...culture,
  ...civic,
];

/**
 * Verified research beats the seed file, every time: coordinates, address,
 * opening hours, admission prices and status all come from
 * src/data/verified-overrides.json when a record has been checked.
 */
export const listings: Listing[] = (() => {
  const merged = seeded.map(applyVerified);
  return [...merged, ...verifiedNewListings(merged)];
})();

const bySlug = new Map(listings.map((l) => [l.slug, l]));
const byId = new Map(listings.map((l) => [l.id, l]));

export function getListing(slug: string) {
  return bySlug.get(slug) ?? byId.get(slug);
}

export function listingsByCategory(categoryId: string) {
  return listings.filter((l) => l.categoryId === categoryId);
}

export function listingsByArea(areaId: string) {
  return listings.filter((l) => l.areaId === areaId);
}

export const totalListings = listings.length;
