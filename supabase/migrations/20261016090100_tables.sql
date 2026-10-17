-- Orange Salon — tables, constraints, indexes and row triggers.

------------------------------------------------------------------------------
-- Business settings (single row). Everything the public site shows about the
-- salon comes from here, so nothing is hardcoded across the application.
------------------------------------------------------------------------------
create table public.business_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Orange Salon' check (char_length(name) between 1 and 120),
  tagline text check (char_length(tagline) <= 200),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address_line text check (char_length(address_line) <= 200),
  city text not null default 'Addis Ababa',
  country_code text not null default 'ET' check (country_code ~ '^[A-Z]{2}$'),
  map_url text check (map_url ~ '^https://'),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  socials jsonb not null default '{}'::jsonb check (jsonb_typeof(socials) = 'object'),
  about_story text check (char_length(about_story) <= 6000),
  policy_text text check (char_length(policy_text) <= 6000),
  online_booking_enabled boolean not null default true,
  min_lead_minutes integer not null default 120 check (min_lead_minutes between 0 and 10080),
  max_advance_days integer not null default 60 check (max_advance_days between 1 and 365),
  slot_interval_min integer not null default 15 check (slot_interval_min in (5, 10, 15, 20, 30, 60)),
  default_buffer_min integer not null default 10 check (default_buffer_min between 0 and 120),
  cancel_cutoff_hours integer not null default 12 check (cancel_cutoff_hours between 0 and 336),
  allow_customer_cancel boolean not null default true,
  allow_customer_reschedule boolean not null default true,
  auto_confirm boolean not null default false,
  require_email boolean not null default false,
  timezone text not null default 'Africa/Addis_Ababa' check (timezone = 'Africa/Addis_Ababa'),
  currency text not null default 'ETB' check (currency = 'ETB'),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

-- Staff-only notification preferences (kept apart from the public settings row).
create table public.notification_settings (
  id smallint primary key default 1 check (id = 1),
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  salon_alert_email text check (salon_alert_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  reminders_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Weekday follows extract(dow): 0 = Sunday … 6 = Saturday.
create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_closed boolean not null default false,
  opens_at time,
  closes_at time,
  check (is_closed or (opens_at is not null and closes_at is not null and opens_at < closes_at))
);

------------------------------------------------------------------------------
-- Catalogue
------------------------------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  summary text check (char_length(summary) <= 200),
  description text check (char_length(description) <= 4000),
  image_path text,
  price_etb integer not null check (price_etb between 0 and 1000000),
  price_type text not null default 'fixed' check (price_type in ('fixed', 'from')),
  duration_min integer not null check (duration_min between 5 and 600),
  buffer_min integer check (buffer_min between 0 and 120),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_category_idx on public.services (category_id);

------------------------------------------------------------------------------
-- Stylists and schedules
------------------------------------------------------------------------------
create table public.stylists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  title text check (char_length(title) <= 80),
  bio text check (char_length(bio) <= 2000),
  photo_path text,
  is_active boolean not null default true,
  accepts_online_booking boolean not null default true,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private contact details live in their own table so public reads of `stylists`
-- can never expose them.
create table public.stylist_contacts (
  stylist_id uuid primary key references public.stylists (id) on delete cascade,
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now()
);

create table public.stylist_services (
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (stylist_id, service_id)
);
create index stylist_services_service_idx on public.stylist_services (service_id);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at),
  constraint working_hours_no_overlap exclude using gist (
    stylist_id extensions.gist_uuid_ops with =,
    weekday extensions.gist_int2_ops with =,
    public.timerange(starts_at, ends_at, '[)') with &&
  )
);

create table public.stylist_breaks (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  label text check (char_length(label) <= 60),
  check (starts_at < ends_at),
  constraint stylist_breaks_no_overlap exclude using gist (
    stylist_id extensions.gist_uuid_ops with =,
    weekday extensions.gist_int2_ops with =,
    public.timerange(starts_at, ends_at, '[)') with &&
  )
);

-- stylist_id null = the whole salon is closed (public holidays, events).
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid references public.stylists (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);
create index time_off_stylist_idx on public.time_off (stylist_id, starts_at);

------------------------------------------------------------------------------
-- Customers and appointments
------------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  staff_notes text check (char_length(staff_notes) <= 2000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_name_idx on public.customers (lower(full_name));

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^OS-[2-9A-HJKMNP-Z]{6}$'),
  service_id uuid not null references public.services (id) on delete restrict,
  stylist_id uuid not null references public.stylists (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  status public.appointment_status not null default 'pending',
  source public.booking_source not null default 'online',
  starts_at timestamptz not null,
  -- ends_at / blocked_until are derived by trigger from duration and buffer.
  ends_at timestamptz not null,
  blocked_until timestamptz not null,
  -- Snapshots, so later catalogue edits never rewrite booking history.
  service_name text not null,
  price_etb integer not null check (price_etb >= 0),
  price_type text not null check (price_type in ('fixed', 'from')),
  duration_min integer not null check (duration_min between 5 and 600),
  buffer_min integer not null check (buffer_min between 0 and 120),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_notes text check (char_length(customer_notes) <= 1000),
  internal_notes text check (char_length(internal_notes) <= 2000),
  policy_accepted_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 500),
  cancelled_by text check (cancelled_by in ('customer', 'staff')),
  amount_paid_etb integer check (amount_paid_etb >= 0),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at and ends_at <= blocked_until),
  -- The core double-booking guarantee: two live appointments for one stylist can
  -- never overlap (service time plus clean-up buffer), even under concurrency.
  constraint appointments_no_overlap exclude using gist (
    stylist_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);
create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_stylist_starts_idx on public.appointments (stylist_id, starts_at);
create index appointments_customer_idx on public.appointments (customer_id);
create index appointments_status_starts_idx on public.appointments (status, starts_at);

create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  event text not null check (
    event in ('created', 'confirmed', 'rejected', 'cancelled', 'rescheduled', 'completed', 'no_show')
  ),
  actor_type text not null check (actor_type in ('customer', 'staff', 'system')),
  actor_id uuid references auth.users (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index appointment_events_appt_idx on public.appointment_events (appointment_id, created_at);
create index appointment_events_recent_idx on public.appointment_events (created_at desc);

------------------------------------------------------------------------------
-- Content
------------------------------------------------------------------------------
-- media_path / poster_path / before_path are either Supabase Storage object
-- paths in the `media` bucket, or site-relative paths ("/images/…") for assets
-- shipped with the app.
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  media_path text not null,
  poster_path text,
  before_path text,
  caption text check (char_length(caption) <= 200),
  alt_text text not null check (char_length(alt_text) between 3 and 300),
  category text not null default 'styling' check (category ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  source text not null default 'salon' check (source in ('salon', 'illustrative')),
  width integer check (width > 0),
  height integer check (height > 0),
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_type = 'image' or poster_path is not null),
  -- A before/after pair must be two genuine photographs.
  check (before_path is null or media_type = 'image')
);
create index gallery_items_order_idx on public.gallery_items (sort_order, created_at);

-- Verified reviews only: each carries its source so it can be traced.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(author_name) between 1 and 80),
  rating smallint check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 2000),
  source text not null check (source in ('google', 'tripadvisor', 'facebook', 'instagram', 'in_person', 'other')),
  source_url text check (source_url ~ '^https://'),
  reviewed_on date,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(message) between 5 and 2000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);

------------------------------------------------------------------------------
-- Staff, notifications, audit, rate limiting
------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text,
  role public.staff_role not null,
  stylist_id uuid unique references public.stylists (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete cascade,
  event public.notification_event not null,
  channel public.notification_channel not null,
  recipient text not null,
  status public.notification_status not null default 'pending',
  provider text,
  provider_message_id text,
  error text,
  attempts integer not null default 0,
  -- Prevents sending the same message twice (e.g. a reminder on a cron retry).
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_log_appt_idx on public.notification_log (appointment_id);
create index notification_log_status_idx on public.notification_log (status, created_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);

create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

------------------------------------------------------------------------------
-- Row triggers
------------------------------------------------------------------------------
create function private.appointments_derive_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_min);
  new.blocked_until := new.ends_at + make_interval(mins => new.buffer_min);
  new.updated_at := now();
  return new;
end;
$$;

create trigger appointments_derive_times
  before insert or update on public.appointments
  for each row execute function private.appointments_derive_times();

do $$
declare
  t text;
begin
  foreach t in array array[
    'business_settings', 'notification_settings', 'service_categories', 'services',
    'stylists', 'stylist_contacts', 'customers', 'gallery_items', 'reviews', 'profiles',
    'notification_log'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t
    );
  end loop;
end;
$$;
