import type { Listing, Review } from '../types';

const AUTHORS = [
  'Ayesha K.', 'Bilal Ahmed', 'Hina S.', 'Usman R.', 'Zara M.', 'Kamran A.', 'Saba N.', 'Faisal Q.',
  'Nida H.', 'Omar Farooq', 'Rabia T.', 'Saad I.', 'Mahnoor B.', 'Tariq J.', 'Alina S.', ' Danish',
];

const TEXTS = [
  'Weekend crowd is heavy but the service keeps moving. Worth the trip.',
  'Clean, well organised and the staff know the place inside out. Coming back with family next time.',
  'Parking is the only real problem — go early or use the side entrance.',
  'Better value than the city-side equivalents and the quality has stayed consistent.',
  'Took out-of-town guests here and they were impressed. Lighting in the evening is the highlight.',
  'Average experience on a Friday, much better on a weekday morning.',
  'Facilities are ageing but the upkeep is honest and the staff are helpful.',
  'One of the few spots in the area that feels genuinely well maintained.',
  'Ask for the corner tables, they are quieter and the view is better.',
  'Prices have gone up but it still earns the rating for what you get.',
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Sample reviews. They exist so the rating UI is populated and are labelled as
 * demo everywhere they appear — no reviewer here is a real person.
 */
export function demoReviews(listing: Pick<Listing, 'id' | 'rating'>): Review[] {
  const h = hash(listing.id);
  const count = 3 + (h % 3);
  const base = Math.round(listing.rating);
  return Array.from({ length: count }, (_, i) => {
    const k = hash(`${listing.id}-${i}`);
    const rating = Math.min(5, Math.max(2, base - (k % 3 === 0 ? 1 : 0) + (k % 7 === 0 ? 1 : 0)));
    const day = 1 + (k % 27);
    const month = 1 + ((k >> 3) % 9);
    return {
      id: `demo-${listing.id}-${i}`,
      listingId: listing.id,
      author: AUTHORS[k % AUTHORS.length].trim(),
      rating,
      date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      text: TEXTS[(k >> 5) % TEXTS.length],
      demo: true,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export const REVIEW_DISCLAIMER =
  'Ratings and reviews on this launch build are sample content, not verified visitor feedback.';
