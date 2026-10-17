-- Orange Salon — roles, row-level security, grants and audit.
--
-- Access model:
--   anon / non-staff users : published catalogue + public settings only.
--   stylist                : their own appointments and schedule (read-only).
--   receptionist           : appointments, customers, messages, notifications, time off.
--   admin (owner)          : everything, including settings, catalogue and staff.
-- Appointments are never written directly: all changes go through the
-- security-definer functions in the booking-engine migration.

------------------------------------------------------------------------------
-- Role helpers (called from policies as `(select private.fn())` so Postgres
-- evaluates them once per statement rather than once per row).
------------------------------------------------------------------------------
create function private.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_staff_role() = 'admin', false)
$$;

create function private.is_front_desk()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_staff_role() in ('admin', 'receptionist'), false)
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_staff_role() is not null
$$;

create function private.my_stylist_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.stylist_id from public.profiles p
  where p.id = auth.uid() and p.is_active and p.role = 'stylist'
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.current_staff_role(), private.is_admin(), private.is_front_desk(),
  private.is_staff(), private.my_stylist_id()
to anon, authenticated;

------------------------------------------------------------------------------
-- The salon always keeps at least one active admin. An advisory lock
-- serialises concurrent demotions so two cannot both pass the check.
------------------------------------------------------------------------------
create function private.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.is_active) then
    perform pg_advisory_xact_lock(hashtext('orange_salon.keep_one_admin'));
    if not exists (
      select 1 from public.profiles p
      where p.role = 'admin' and p.is_active and p.id <> old.id
    ) then
      raise exception 'LAST_ADMIN' using
        errcode = 'P0001',
        hint = 'Promote another admin before removing this one.';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'IMMUTABLE_ID' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_keep_one_admin
  before update or delete on public.profiles
  for each row execute function private.keep_one_admin();

-- A stylist login must point at a stylist profile; other roles may not.
create function private.profiles_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'stylist' and new.stylist_id is null then
    raise exception 'STYLIST_LINK_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_validate
  before insert or update on public.profiles
  for each row execute function private.profiles_validate();

------------------------------------------------------------------------------
-- Audit trail for sensitive administrative tables.
------------------------------------------------------------------------------
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_events (actor_id, actor_role, action, entity, entity_id, before, after)
  values (
    auth.uid(),
    private.current_staff_role()::text,
    lower(tg_op),
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'weekday', row_data ->> 'stylist_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'business_settings', 'notification_settings', 'business_hours', 'service_categories',
    'services', 'stylists', 'stylist_contacts', 'stylist_services', 'time_off',
    'gallery_items', 'reviews', 'profiles'
  ] loop
    execute format(
      'create trigger audit_row after insert or update or delete on public.%I for each row execute function private.audit_row()',
      t
    );
  end loop;
end;
$$;

------------------------------------------------------------------------------
-- Row-level security
------------------------------------------------------------------------------
alter table public.business_settings enable row level security;
alter table public.notification_settings enable row level security;
alter table public.business_hours enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.stylists enable row level security;
alter table public.stylist_contacts enable row level security;
alter table public.stylist_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.stylist_breaks enable row level security;
alter table public.time_off enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;
alter table public.gallery_items enable row level security;
alter table public.reviews enable row level security;
alter table public.contact_messages enable row level security;
alter table public.profiles enable row level security;
alter table public.notification_log enable row level security;
alter table public.audit_events enable row level security;
alter table private.rate_limits enable row level security;

-- Public settings and hours
create policy "settings readable by everyone" on public.business_settings
  for select to anon, authenticated using (true);
create policy "settings editable by admins" on public.business_settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "notification settings for admins" on public.notification_settings
  for select to authenticated using ((select private.is_admin()));
create policy "notification settings editable by admins" on public.notification_settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "hours readable by everyone" on public.business_hours
  for select to anon, authenticated using (true);
create policy "hours managed by admins" on public.business_hours
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Catalogue: visitors see active rows; staff see everything; admins write.
create policy "categories readable by everyone" on public.service_categories
  for select to anon, authenticated using (true);
create policy "categories managed by admins" on public.service_categories
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "active services readable" on public.services
  for select to anon, authenticated using (is_active or (select private.is_staff()));
create policy "services managed by admins" on public.services
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "active stylists readable" on public.stylists
  for select to anon, authenticated using (is_active or (select private.is_staff()));
create policy "stylists managed by admins" on public.stylists
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "stylist contacts for front desk" on public.stylist_contacts
  for select to authenticated
  using ((select private.is_front_desk()) or stylist_id = (select private.my_stylist_id()));
create policy "stylist contacts managed by admins" on public.stylist_contacts
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "stylist services readable" on public.stylist_services
  for select to anon, authenticated using (true);
create policy "stylist services managed by admins" on public.stylist_services
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Schedules: staff can see; a stylist sees their own; admins edit.
create policy "working hours visible to staff" on public.working_hours
  for select to authenticated
  using ((select private.is_front_desk()) or stylist_id = (select private.my_stylist_id()));
create policy "working hours managed by admins" on public.working_hours
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "breaks visible to staff" on public.stylist_breaks
  for select to authenticated
  using ((select private.is_front_desk()) or stylist_id = (select private.my_stylist_id()));
create policy "breaks managed by admins" on public.stylist_breaks
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "time off visible to staff" on public.time_off
  for select to authenticated
  using (
    (select private.is_front_desk())
    or (stylist_id is null and (select private.is_staff()))
    or stylist_id = (select private.my_stylist_id())
  );
create policy "time off managed by front desk" on public.time_off
  for insert to authenticated with check ((select private.is_front_desk()));
create policy "time off updated by front desk" on public.time_off
  for update to authenticated
  using ((select private.is_front_desk())) with check ((select private.is_front_desk()));
create policy "time off removed by front desk" on public.time_off
  for delete to authenticated using ((select private.is_front_desk()));

-- Customers and appointments
create policy "customers visible to front desk" on public.customers
  for select to authenticated using ((select private.is_front_desk()));
create policy "customers editable by front desk" on public.customers
  for update to authenticated
  using ((select private.is_front_desk())) with check ((select private.is_front_desk()));

create policy "appointments visible to front desk or own stylist" on public.appointments
  for select to authenticated
  using ((select private.is_front_desk()) or stylist_id = (select private.my_stylist_id()));

create policy "appointment events visible with their appointment" on public.appointment_events
  for select to authenticated
  using (
    (select private.is_front_desk())
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.stylist_id = (select private.my_stylist_id())
    )
  );

-- Content
create policy "published gallery readable" on public.gallery_items
  for select to anon, authenticated using (is_published or (select private.is_staff()));
create policy "gallery managed by admins" on public.gallery_items
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "published reviews readable" on public.reviews
  for select to anon, authenticated using (is_published or (select private.is_staff()));
create policy "reviews managed by admins" on public.reviews
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "messages visible to front desk" on public.contact_messages
  for select to authenticated using ((select private.is_front_desk()));
create policy "messages updated by front desk" on public.contact_messages
  for update to authenticated
  using ((select private.is_front_desk())) with check ((select private.is_front_desk()));
create policy "messages deleted by admins" on public.contact_messages
  for delete to authenticated using ((select private.is_admin()));

-- Staff
create policy "own profile or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or (select private.is_admin()));
create policy "profiles managed by admins" on public.profiles
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "notification log for front desk" on public.notification_log
  for select to authenticated using ((select private.is_front_desk()));

create policy "audit log for admins" on public.audit_events
  for select to authenticated using ((select private.is_admin()));

-- private.rate_limits has RLS on and no policies: only the service role and
-- security-definer functions can touch it.

------------------------------------------------------------------------------
-- Grants. Supabase's default privileges hand every API role ALL on new tables,
-- so start from nothing and grant exactly what each role needs. RLS still
-- applies on top of these grants.
------------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.business_settings, public.business_hours, public.service_categories,
  public.services, public.stylists, public.stylist_services, public.gallery_items,
  public.reviews
to anon, authenticated;

grant update on public.business_settings to authenticated;
grant select, update on public.notification_settings to authenticated;
grant insert, update, delete on
  public.business_hours, public.service_categories, public.services, public.stylists,
  public.stylist_services, public.gallery_items, public.reviews
to authenticated;
grant select, insert, update, delete on
  public.stylist_contacts, public.working_hours, public.stylist_breaks, public.time_off
to authenticated;
grant select, update on public.customers to authenticated;
grant select on public.appointments, public.appointment_events, public.notification_log, public.audit_events
  to authenticated;
grant select, update, delete on public.contact_messages to authenticated;
grant select, update on public.profiles to authenticated;

-- Column-level guard: staff may only change these profile fields through the API.
revoke update on public.profiles from authenticated;
grant update (full_name, role, stylist_id, is_active) on public.profiles to authenticated;

-- Customer phone numbers are the lookup key for bookings; front desk may fix
-- names, emails and notes, but not rewrite the phone a booking is keyed on.
revoke update on public.customers from authenticated;
grant update (full_name, email, staff_notes) on public.customers to authenticated;
