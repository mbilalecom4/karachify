/**
 * Karachify data model.
 *
 * Shaped so a Supabase (or any SQL) backend can be dropped in later without
 * changing component code: every entity has an id, a cityId, and flat fields
 * that map 1:1 to the tables in docs/database-schema.sql.
 */

export type VerificationStatus = 'demo' | 'verified' | 'needs-review';

export interface City {
  id: string;
  name: string;
  slug: string;
  country: string;
  tagline: string;
  lat: number;
  lng: number;
}

export interface Area {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  zone: 'Clifton' | 'DHA' | 'Saddar' | 'Gulshan' | 'North' | 'South' | 'East' | 'Central';
  blurb: string;
  lat: number;
  lng: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  /** Tailwind-friendly icon key resolved in src/lib/icons.ts */
  icon: string;
  blurb: string;
  /** Grouping used by the header dropdowns */
  group: 'Discover' | 'Eat & Stay' | 'City Life' | 'Essentials';
  navOrder: number;
  /** Layout variant used by listing detail pages */
  detailLayout: DetailLayout;
}

export type DetailLayout =
  | 'attraction'
  | 'restaurant'
  | 'hotel'
  | 'hospital'
  | 'education'
  | 'shopping'
  | 'park'
  | 'event-venue'
  | 'service'
  | 'transport'
  | 'government'
  | 'emergency'
  | 'religious'
  | 'sports';

export interface MediaRef {
  /** 500px Wikimedia thumb, used for cards */
  thumb?: string;
  /** 1280px Wikimedia thumb, used for heroes and galleries */
  wide?: string;
  /** Wikimedia Commons file page for attribution */
  filePage?: string;
  artist?: string;
  license?: string;
  /**
   * 'subject' — the photo really depicts this record.
   * 'related' — a Karachi photo of the same kind, standing in, so the UI has to
   * say "illustrative" rather than naming the record.
   */
  kind?: 'subject' | 'related';
}

export interface Review {
  id: string;
  listingId: string;
  author: string;
  rating: number;
  date: string;
  text: string;
  demo: boolean;
}

export interface EntryFee {
  label: string;
  /** 0 means the source states free admission, not "price unknown". */
  amount: number;
  currency: string;
  /** Where the number came from: the operator's own tariff page, or press coverage. */
  basis: 'official' | 'press';
}

export interface Listing {
  id: string;
  slug: string;
  cityId: string;
  categoryId: string;
  areaId: string;
  name: string;
  tagline: string;
  description: string;
  /** Candidate Wikipedia/Commons article titles used to source a real Karachi photo */
  wiki?: string[];
  address: string;
  /** Position for the map: verified when coordsVerified is set, otherwise derived from the area centre. */
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  email?: string;
  hours?: { day: string; open: string }[];
  /** Admission prices as published by the operator (or, failing that, by press). */
  entryFees?: EntryFee[];
  /** Visitor rules stated by the operator or a government page. */
  entryConditions?: string;
  /** Self-declared band from the owner dashboard; never invented by Karachify. */
  priceRange?: 'Free' | '$' | '$$' | '$$$';
  cuisine?: string[];
  facilities: string[];
  /** Only ever set from a verified source; absent means "no rating", not "unrated by visitors". */
  rating?: number;
  reviewCount?: number;
  tags: string[];
  featured: boolean;
  promoted: boolean;
  status: VerificationStatus;
  sourceUrl?: string;
  /** OpenStreetMap element the verified coordinates and address were read from. */
  osmId?: string;
  /** Date the verified fields below were last checked against their source. */
  lastVerified?: string;
  /** True only when lat/lng came from a real geocode, not from the area-centre jitter. */
  coordsVerified?: boolean;
  createdAt: string;
}

export type EventCategory =
  | 'Concerts'
  | 'Festivals'
  | 'Exhibitions'
  | 'Sports'
  | 'Conferences'
  | 'Workshops'
  | 'Food Festivals'
  | 'Family'
  | 'Cultural'
  | 'Community'
  | 'Theatre'
  | 'Religious';

export interface CityEvent {
  id: string;
  slug: string;
  cityId: string;
  categoryId: string;
  name: string;
  description: string;
  wiki?: string[];
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  venue: string;
  areaId: string;
  eventCategory: EventCategory;
  ticketPrice: string;
  ticketNote: string;
  organiser: string;
  lat: number;
  lng: number;
  status: VerificationStatus;
  sourceUrl?: string;
}

export interface Guide {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readMinutes: number;
  area: string;
  tag: string;
  wiki?: string[];
  sections: { heading: string; body: string[] }[];
}

export interface Submission {
  id: string;
  kind: 'listing' | 'business' | 'event' | 'claim' | 'contact' | 'newsletter';
  name: string;
  categoryId?: string;
  areaId?: string;
  description: string;
  email?: string;
  phone?: string;
  address?: string;
  images?: string[];
  listingId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  /** Demo mode only — never do this in production */
  passcode: string;
  role: 'user' | 'owner' | 'admin';
  createdAt: string;
  cityId: string;
}

export interface UserPrefs {
  favouriteListings: string[];
  savedEvents: string[];
  recentSearches: string[];
}

export interface Enquiry {
  id: string;
  kind: 'listing' | 'event-registration' | 'hotel-booking' | 'claim' | 'contact' | 'business';
  subject: string;
  refId?: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  createdAt: string;
  userId?: string;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  demoBanner: boolean;
  listingsPerPage: number;
  featuredBadgeLabel: string;
}
