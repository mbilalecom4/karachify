import { useCallback, useSyncExternalStore } from 'react';
import type {
  AppUser,
  Area,
  Category,
  CityEvent,
  Enquiry,
  Listing,
  Review,
  SiteSettings,
  Submission,
  UserPrefs,
} from '../types';
import { areas as baseAreas, categories as baseCategories } from '../data/taxonomy';
import { listings as baseListings } from '../data/listings';
import { events as baseEvents } from '../data/events';
import { slugify, uniqueSlug } from './format';

/**
 * Local demo persistence.
 *
 * Everything a production Karachify would keep in Supabase is kept in
 * localStorage here so the showcase works with no account, no API key and no
 * cost. The shape mirrors the SQL schema in docs/database-schema.sql so the
 * same selectors can be repointed at a real backend later.
 *
 * This is NOT authentication: the passcodes below are stored in plain text in
 * the browser and only exist to demonstrate the flows.
 */

const STORAGE_KEY = 'karachify.db.v1';

export interface DB {
  users: AppUser[];
  sessionId: string | null;
  prefs: Record<string, UserPrefs>;
  submissions: Submission[];
  enquiries: Enquiry[];
  reviews: Review[];
  newListings: Listing[];
  listingPatches: Record<string, Partial<Listing>>;
  deletedListings: string[];
  newEvents: CityEvent[];
  eventPatches: Record<string, Partial<CityEvent>>;
  deletedEvents: string[];
  newCategories: Category[];
  deletedCategories: string[];
  newAreas: Area[];
  deletedAreas: string[];
  settings: SiteSettings;
}

const emptyPrefs = (): UserPrefs => ({ favouriteListings: [], savedEvents: [], recentSearches: [] });

const seed: DB = {
  users: [
    {
      id: 'admin',
      name: 'Site Administrator',
      email: 'admin@karachify.demo',
      passcode: 'admin123',
      role: 'admin',
      createdAt: '2026-01-01',
      cityId: 'karachi',
    },
    {
      id: 'owner-demo',
      name: 'Business Owner (demo)',
      email: 'owner@karachify.demo',
      passcode: 'owner123',
      role: 'owner',
      createdAt: '2026-01-01',
      cityId: 'karachi',
    },
  ],
  sessionId: null,
  prefs: { guest: emptyPrefs() },
  submissions: [],
  enquiries: [],
  reviews: [],
  newListings: [],
  listingPatches: {},
  deletedListings: [],
  newEvents: [],
  eventPatches: {},
  deletedEvents: [],
  newCategories: [],
  deletedCategories: [],
  newAreas: [],
  deletedAreas: [],
  settings: {
    siteName: 'Karachify',
    tagline: 'Discover Everything Karachi.',
    demoBanner: true,
    listingsPerPage: 12,
    featuredBadgeLabel: 'Featured',
  },
};

function read(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<DB>;
    return {
      ...seed,
      ...parsed,
      settings: { ...seed.settings, ...(parsed.settings ?? {}) },
      prefs: { ...seed.prefs, ...(parsed.prefs ?? {}) },
      users: parsed.users?.length ? parsed.users : seed.users,
    };
  } catch {
    return seed;
  }
}

let state: DB = typeof window === 'undefined' ? seed : read();
const listeners = new Set<() => void>();

function commit(next: DB) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — the session still works in memory */
  }
  listeners.forEach((l) => l());
}

function update(fn: (draft: DB) => DB) {
  commit(fn({ ...state }));
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => state, () => seed);
}

/* ------------------------------- selectors ------------------------------- */

export function selectListings(db: DB): Listing[] {
  const all = [...baseListings, ...db.newListings];
  return all
    .filter((l) => !db.deletedListings.includes(l.id))
    .map((l) => (db.listingPatches[l.id] ? { ...l, ...db.listingPatches[l.id] } : l));
}

/**
 * How much of the directory a source actually backs, counted so that every record
 * falls in exactly one bucket. A hotline whose phone number was checked but whose
 * pin was not is neither a pinned record nor an unchecked one, and copy that says
 * "everything else is unconfirmed" would understate what was done.
 */
export function coverage(listings: Listing[]) {
  const pinned = listings.filter((l) => l.coordsVerified).length;
  const verified = listings.filter((l) => l.coordsVerified && l.status === 'verified').length;
  const fieldOnly = listings.filter((l) => !l.coordsVerified && Boolean(l.lastVerified)).length;
  return {
    verified,
    pinned,
    fieldOnly,
    unchecked: listings.length - pinned - fieldOnly,
    audited: pinned + fieldOnly,
    total: listings.length,
  };
}

export function selectEvents(db: DB): CityEvent[] {
  const all = [...baseEvents, ...db.newEvents];
  return all
    .filter((e) => !db.deletedEvents.includes(e.id))
    .map((e) => (db.eventPatches[e.id] ? { ...e, ...db.eventPatches[e.id] } : e));
}

export function selectCategories(db: DB): Category[] {
  return [...baseCategories, ...db.newCategories].filter((c) => !db.deletedCategories.includes(c.id));
}

export function selectAreas(db: DB): Area[] {
  return [...baseAreas, ...db.newAreas].filter((a) => !db.deletedAreas.includes(a.id));
}

/** Includes soft-deleted records, so admin restore lists can still name them. */
export function allListings(db: DB): Listing[] {
  return [...baseListings, ...db.newListings];
}

export function allEvents(db: DB): CityEvent[] {
  return [...baseEvents, ...db.newEvents];
}

export function currentUser(db: DB): AppUser | null {
  return db.users.find((u) => u.id === db.sessionId) ?? null;
}

export function prefsFor(db: DB): UserPrefs {
  return db.prefs[db.sessionId ?? 'guest'] ?? emptyPrefs();
}

export function reviewsFor(db: DB, listingId: string): Review[] {
  return db.reviews.filter((r) => r.listingId === listingId);
}

/* -------------------------------- actions -------------------------------- */

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export const actions = {
  signup(input: { name: string; email: string; passcode: string; role?: AppUser['role'] }) {
    const email = input.email.trim().toLowerCase();
    if (state.users.some((u) => u.email === email)) {
      return { ok: false as const, error: 'An account already exists with this email. Try logging in.' };
    }
    const user: AppUser = {
      id: uid('u'),
      name: input.name.trim(),
      email,
      passcode: input.passcode,
      role: input.role ?? 'user',
      createdAt: nowIso().slice(0, 10),
      cityId: 'karachi',
    };
    update((d) => ({
      ...d,
      users: [...d.users, user],
      sessionId: user.id,
      prefs: { ...d.prefs, [user.id]: emptyPrefs() },
    }));
    return { ok: true as const, user };
  },

  login(email: string, passcode: string) {
    const user = state.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.passcode !== passcode) {
      return { ok: false as const, error: 'Email or passcode does not match a demo account.' };
    }
    update((d) => ({ ...d, sessionId: user.id }));
    return { ok: true as const, user };
  },

  logout() {
    update((d) => ({ ...d, sessionId: null }));
  },

  toggleFavourite(listingId: string) {
    const key = state.sessionId ?? 'guest';
    const current = state.prefs[key] ?? emptyPrefs();
    const on = current.favouriteListings.includes(listingId);
    update((d) => ({
      ...d,
      prefs: {
        ...d.prefs,
        [key]: {
          ...current,
          favouriteListings: on
            ? current.favouriteListings.filter((x) => x !== listingId)
            : [listingId, ...current.favouriteListings],
        },
      },
    }));
    return !on;
  },

  toggleSavedEvent(eventId: string) {
    const key = state.sessionId ?? 'guest';
    const current = state.prefs[key] ?? emptyPrefs();
    const on = current.savedEvents.includes(eventId);
    update((d) => ({
      ...d,
      prefs: {
        ...d.prefs,
        [key]: {
          ...current,
          savedEvents: on ? current.savedEvents.filter((x) => x !== eventId) : [eventId, ...current.savedEvents],
        },
      },
    }));
    return !on;
  },

  pushRecentSearch(term: string) {
    const key = state.sessionId ?? 'guest';
    const current = state.prefs[key] ?? emptyPrefs();
    const next = [term, ...current.recentSearches.filter((t) => t !== term)].slice(0, 8);
    update((d) => ({ ...d, prefs: { ...d.prefs, [key]: { ...current, recentSearches: next } } }));
  },

  clearRecents() {
    const key = state.sessionId ?? 'guest';
    const current = state.prefs[key] ?? emptyPrefs();
    update((d) => ({ ...d, prefs: { ...d.prefs, [key]: { ...current, recentSearches: [] } } }));
  },

  addSubmission(input: Omit<Submission, 'id' | 'createdAt' | 'status'> & { status?: Submission['status'] }) {
    const sub: Submission = { ...input, id: uid('sub'), createdAt: nowIso().slice(0, 10), status: input.status ?? 'pending' };
    update((d) => ({ ...d, submissions: [sub, ...d.submissions] }));
    return sub;
  },

  setSubmissionStatus(id: string, status: Submission['status']) {
    update((d) => ({ ...d, submissions: d.submissions.map((s) => (s.id === id ? { ...s, status } : s)) }));
  },

  /** Approving a business submission publishes exactly what the owner stated. */
  publishSubmission(sub: Submission, coords: { lat: number; lng: number }) {
    const slug = uniqueSlug(selectListings(state).map((l) => l.slug), `user-${slugify(sub.name)}`);
    const listing: Listing = {
      id: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      slug,
      cityId: 'karachi',
      categoryId: sub.categoryId ?? 'professional-services',
      areaId: sub.areaId ?? 'dha',
      name: sub.name,
      tagline: sub.description.split('.')[0].slice(0, 110),
      description: sub.description,
      address: sub.address ?? `${sub.areaId ?? 'Karachi'}, Karachi`,
      lat: coords.lat,
      lng: coords.lng,
      phone: sub.phone,
      website: sub.website,
      email: sub.email,
      ownerEmail: sub.email?.toLowerCase(),
      facilities: [],
      tags: ['Community submitted'],
      featured: false,
      promoted: false,
      status: 'needs-review',
      createdAt: nowIso().slice(0, 10),
    };
    update((d) => ({
      ...d,
      newListings: [listing, ...d.newListings],
      submissions: d.submissions.map((s) => (s.id === sub.id ? { ...s, status: 'approved', listingId: listing.id } : s)),
    }));
    return listing;
  },

  addEnquiry(input: Omit<Enquiry, 'id' | 'createdAt'>) {
    const e: Enquiry = { ...input, id: uid('enq'), createdAt: nowIso() };
    update((d) => ({ ...d, enquiries: [e, ...d.enquiries] }));
    return e;
  },

  addReview(input: Omit<Review, 'id'>) {
    const r: Review = { ...input, id: uid('rev') };
    update((d) => ({ ...d, reviews: [r, ...d.reviews] }));
    return r;
  },

  createListing(listing: Listing) {
    update((d) => ({ ...d, newListings: [listing, ...d.newListings] }));
    return listing;
  },

  patchListing(id: string, patch: Partial<Listing>) {
    update((d) => {
      if (d.newListings.some((l) => l.id === id)) {
        return { ...d, newListings: d.newListings.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
      }
      return { ...d, listingPatches: { ...d.listingPatches, [id]: { ...d.listingPatches[id], ...patch } } };
    });
  },

  deleteListing(id: string) {
    update((d) => {
      if (d.newListings.some((l) => l.id === id)) {
        return { ...d, newListings: d.newListings.filter((l) => l.id !== id) };
      }
      return { ...d, deletedListings: [...new Set([...d.deletedListings, id])], listingPatches: omit(d.listingPatches, id) };
    });
  },

  restoreListing(id: string) {
    update((d) => ({ ...d, deletedListings: d.deletedListings.filter((x) => x !== id) }));
  },

  createEvent(event: CityEvent) {
    update((d) => ({ ...d, newEvents: [event, ...d.newEvents] }));
    return event;
  },

  patchEvent(id: string, patch: Partial<CityEvent>) {
    update((d) => {
      if (d.newEvents.some((e) => e.id === id)) {
        return { ...d, newEvents: d.newEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
      }
      return { ...d, eventPatches: { ...d.eventPatches, [id]: { ...d.eventPatches[id], ...patch } } };
    });
  },

  deleteEvent(id: string) {
    update((d) => {
      if (d.newEvents.some((e) => e.id === id)) return { ...d, newEvents: d.newEvents.filter((e) => e.id !== id) };
      return { ...d, deletedEvents: [...new Set([...d.deletedEvents, id])] };
    });
  },

  restoreEvent(id: string) {
    update((d) => ({ ...d, deletedEvents: d.deletedEvents.filter((x) => x !== id) }));
  },

  deleteReview(id: string) {
    update((d) => ({ ...d, reviews: d.reviews.filter((r) => r.id !== id) }));
  },

  createCategory(category: Category) {
    update((d) => ({ ...d, newCategories: [...d.newCategories, category] }));
  },

  deleteCategory(id: string) {
    update((d) => ({ ...d, deletedCategories: [...new Set([...d.deletedCategories, id])] }));
  },

  createArea(area: Area) {
    update((d) => ({ ...d, newAreas: [...d.newAreas, area] }));
  },

  deleteArea(id: string) {
    update((d) => ({ ...d, deletedAreas: [...new Set([...d.deletedAreas, id])] }));
  },

  saveSettings(settings: SiteSettings) {
    update((d) => ({ ...d, settings }));
  },

  resetDemoData() {
    commit({ ...structuredClone(seed) });
  },
};

function omit<T>(obj: Record<string, T>, key: string) {
  const next = { ...obj };
  delete next[key];
  return next;
}

/** Convenience hook for a single mutating action with a toast-friendly result. */
export function useToggleFavourite() {
  const db = useDB();
  const ids = prefsFor(db).favouriteListings;
  return useCallback((id: string) => actions.toggleFavourite(id), []) as (id: string) => boolean;
}
