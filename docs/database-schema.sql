-- Karachify — reference SQL schema (Supabase / PostgreSQL)
--
-- The demo runs on localStorage (src/lib/store.ts) but every entity in that
-- store maps 1:1 to the tables below, so swapping the data layer means
-- replacing selectors, not components.
--
-- Conventions used here:
--   * text ids (slugs) for human-readable routes, uuid primary keys for joins
--   * `verification_status` on every user-visible record so the UI can badge it
--   * `source_url` where a claim came from somewhere real
--   * RLS notes at the bottom — the admin dashboard in the demo has none of this

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ------------------------------------------------------------------ tenancy --

create table cities (
  id          text primary key,            -- 'karachi'
  name        text not null,
  slug        text not null unique,
  country     text not null default 'Pakistan',
  tagline     text not null default '',
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now()
);

create table areas (
  id          text primary key,            -- 'clifton'
  city_id     text not null references cities(id) on delete cascade,
  name        text not null,
  slug        text not null,
  zone        text not null,               -- Clifton | DHA | Saddar | Gulshan | North | South | East | Central
  blurb       text not null default '',
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now(),
  unique (city_id, slug)
);

create index areas_city_idx on areas (city_id);

create table categories (
  id             text primary key,         -- 'restaurants'
  name           text not null,
  slug           text not null unique,
  icon           text not null,            -- key into src/lib/icons.tsx
  blurb          text not null default '',
  "group"        text not null,            -- Discover | Eat & Stay | City Life | Essentials
  nav_order      integer not null default 100,
  detail_layout  text not null default 'service',
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------------- content --

create type verification_status as enum ('demo', 'verified', 'needs-review');

create table listings (
  id                  uuid primary key default gen_random_uuid(),
  city_id             text not null references cities(id) on delete restrict,
  area_id             text references areas(id) on delete set null,
  category_id         text references categories(id) on delete set null,
  slug                text not null,
  name                text not null,
  tagline             text not null default '',
  description         text not null default '',
  address             text not null default '',
  lat                 double precision not null,
  lng                 double precision not null,
  phone               text,
  website             text,
  email               text,
  hours               jsonb not null default '[]'::jsonb,   -- [{day, open}]
  price_range         text,                                 -- Free | $ | $$ | $$$ | Demo
  cuisine             text[] not null default '{}',
  facilities          text[] not null default '{}',
  tags                text[] not null default '{}',
  rating              numeric(2,1) not null default 0,
  review_count        integer not null default 0,
  featured            boolean not null default false,
  promoted            boolean not null default false,
  verification_status verification_status not null default 'demo',
  source_url          text,
  created_by          uuid,                                 -- auth.users(id) for owner edits
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (city_id, slug)
);

create index listings_category_idx on listings (category_id);
create index listings_area_idx on listings (area_id);
create index listings_search_idx on listings using gin ((to_tsvector('simple', name || ' ' || tagline || ' ' || description)));
create index listings_trgm_idx on listings using gin (name gin_trgm_ops);

-- Category-intelligent detail layouts store their extra blocks here instead of
-- widening the listings table: menu, rooms, departments, terminals, wards…
create table listing_extras (
  listing_id  uuid not null references listings(id) on delete cascade,
  kind        text not null,               -- 'menu' | 'rooms' | 'departments' | 'facilities' | …
  payload     jsonb not null,
  primary key (listing_id, kind)
);

create table media (
  id          uuid primary key default gen_random_uuid(),
  owner_type  text not null,               -- 'listing' | 'event' | 'guide' | 'area'
  owner_id    text not null,
  key         text not null,               -- registry key used by src/lib/media.ts
  subject     text not null,               -- what the photograph actually depicts
  thumb       text,
  wide        text,
  file_page   text,
  artist      text,
  license     text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (owner_type, owner_id, key)
);

-- -------------------------------------------------------------------- events --

create table events (
  id               uuid primary key default gen_random_uuid(),
  city_id          text not null references cities(id) on delete restrict,
  area_id          text references areas(id) on delete set null,
  category_id      text references categories(id) on delete set null,
  slug             text not null,
  name             text not null,
  description      text not null default '',
  event_category   text not null,          -- Concerts | Festivals | … (12 values)
  date             date not null,
  end_date         date,
  start_time       time not null,
  end_time         time not null,
  venue            text not null default '',
  ticket_price     text not null default 'To confirm',
  ticket_note      text not null default '',
  organiser        text not null default '',
  lat              double precision not null,
  lng              double precision not null,
  verification_status verification_status not null default 'demo',
  source_url       text,
  created_at       timestamptz not null default now(),
  unique (city_id, slug),
  check (end_date is null or end_date >= date)
);

create index events_date_idx on events (date);
create index events_category_idx on events (event_category);

-- -------------------------------------------------------------------- guides --

create table guides (
  id           uuid primary key default gen_random_uuid(),
  city_id      text not null references cities(id) on delete restrict,
  slug         text not null unique,
  title        text not null,
  excerpt      text not null default '',
  read_minutes integer not null default 5,
  area         text not null default '',
  tag          text not null default '',
  sections     jsonb not null default '[]'::jsonb,  -- [{heading, body[]}]
  published_at date,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------------------- users --

-- Mirrors auth.users; kept as a profile table rather than an app-managed
-- password store. The demo's plain-text `passcode` field must NOT be ported.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  role        text not null default 'user',   -- user | owner | admin
  city_id     text references cities(id),
  created_at  timestamptz not null default now()
);

create table user_prefs (
  user_id             uuid primary key references profiles(id) on delete cascade,
  favourite_listings  uuid[] not null default '{}',
  saved_events        uuid[] not null default '{}',
  recent_searches     text[] not null default '{}',
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------ moderation  --

create type submission_kind as enum ('listing', 'business', 'event', 'claim', 'contact', 'newsletter');
create type submission_status as enum ('pending', 'approved', 'rejected');

create table submissions (
  id           uuid primary key default gen_random_uuid(),
  kind         submission_kind not null,
  status       submission_status not null default 'pending',
  name         text not null,
  category_id  text references categories(id) on delete set null,
  area_id      text references areas(id) on delete set null,
  description  text not null default '',
  email        text,
  phone        text,
  address      text,
  images       text[] not null default '{}',
  listing_id   uuid references listings(id) on delete set null,
  user_id      uuid references profiles(id) on delete set null,
  reviewer_id  uuid references profiles(id) on delete set null,
  review_note  text,
  created_at   timestamptz not null default now()
);

create index submissions_status_idx on submissions (status, created_at desc);

create table enquiries (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,      -- listing | event-registration | hotel-booking | claim | contact | business
  subject     text not null,
  ref_id      text,
  name        text not null,
  email       text not null,
  phone       text,
  message     text not null,
  user_id     uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table reviews (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  user_id     uuid references profiles(id) on delete set null,
  author      text not null,
  rating      integer not null check (rating between 1 and 5),
  text        text not null default '',
  is_demo     boolean not null default false,   -- generated sample review
  status      submission_status not null default 'pending',
  created_at  timestamptz not null default now()
);

create index reviews_listing_idx on reviews (listing_id, created_at desc);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,        -- listing | event | review | media
  entity_id    text not null,
  reason       text not null,
  details      text not null default '',
  reporter_id  uuid references profiles(id) on delete set null,
  status       submission_status not null default 'pending',
  created_at   timestamptz not null default now()
);

create table settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------- views  --

-- What the public site reads: published records only, with the badge fields the
-- cards need.
create view public_listings as
select l.id, l.slug, l.name, l.tagline, l.category_id, l.area_id, l.price_range,
       l.rating, l.review_count, l.featured, l.promoted, l.verification_status,
       a.name as area_name, c.name as category_name
from listings l
left join areas a on a.id = l.area_id
left join categories c on c.id = l.category_id
where l.verification_status <> 'needs-review';

-- -------------------------------------------------- row level security notes --
--
-- alter table listings enable row level security;
-- alter table submissions enable row level security;
--
-- Public read:
--   create policy "public read listings" on listings for select using (true);
--
-- Owner write (only their own claimed records):
--   create policy "owner edits own listing" on listings for update
--     using (exists (select 1 from listings_owners lo
--                    where lo.listing_id = listings.id and lo.user_id = auth.uid()
--                      and lo.status = 'approved'));
--
-- Admin-only moderation:
--   create policy "admin manages submissions" on submissions for all
--     using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
--
-- Reviews: insert for authenticated users, update/delete for admins only.
-- Ratings and review_count on listings should be maintained by a trigger so a
-- client can never post its own score.
