-- Orange Salon — foundation: extensions, schemas, enum types and small helpers.
--
-- Conventions used across every migration:
--   * Every function sets `search_path = ''` and schema-qualifies everything it touches.
--   * Internal functions live in the `private` schema, which PostgREST does not expose.
--   * All salon-local times are Africa/Addis_Ababa (UTC+3, no DST). Instants are timestamptz.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create type public.staff_role as enum ('admin', 'receptionist', 'stylist');

create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');

create type public.booking_source as enum ('online', 'phone', 'walk_in');

create type public.notification_channel as enum ('email', 'whatsapp');

create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');

create type public.notification_event as enum (
  'requested', 'confirmed', 'rescheduled', 'cancelled', 'reminder', 'salon_alert'
);

-- A range of wall-clock times within a day, used to stop overlapping weekly shifts.
create type public.timerange as range (subtype = time);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Salon-local wall-clock time on a given date → absolute instant.
create function private.local_ts(p_date date, p_time time)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_date + p_time) at time zone 'Africa/Addis_Ababa'
$$;

-- Absolute instant → salon-local calendar date.
create function private.local_date(p_ts timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_ts at time zone 'Africa/Addis_Ababa')::date
$$;

-- Booking references: "OS-" + 6 characters from an alphabet without 0/O, 1/I/L.
create function private.new_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(6);
  result text := 'OS-';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return result;
end;
$$;
