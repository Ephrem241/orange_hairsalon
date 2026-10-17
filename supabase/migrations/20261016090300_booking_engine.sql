-- Orange Salon — booking engine.
--
-- The database is the single authority on availability:
--   private.check_slot          — can this stylist take [start, start+duration(+buffer))?
--   private.stylist_free_slots  — every bookable start for a stylist on a date.
--   private.create_booking      — validates, assigns a stylist, inserts atomically.
-- The `appointments_no_overlap` exclusion constraint is the final guard: if two
-- requests race past the checks, only one insert can commit.
--
-- Errors are raised with errcode P0001 and a stable UPPER_SNAKE message that the
-- application maps to friendly copy (see src/lib/booking/errors.ts).

------------------------------------------------------------------------------
-- Guards
------------------------------------------------------------------------------
create function private.require_front_desk()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_front_desk() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

------------------------------------------------------------------------------
-- Availability core
------------------------------------------------------------------------------
-- Returns null when the stylist can take the appointment, otherwise a reason:
-- OUTSIDE_HOURS, ON_BREAK, TIME_OFF or OVERLAP. The service itself must fit
-- inside working hours and avoid breaks; service + clean-up buffer must avoid
-- time off and other live appointments (matching the exclusion constraint).
create function private.check_slot(
  p_stylist_id uuid,
  p_start timestamptz,
  p_duration_min integer,
  p_buffer_min integer,
  p_ignore_appointment uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_date date := private.local_date(p_start);
  v_dow smallint := extract(dow from v_date)::smallint;
  v_end timestamptz := p_start + make_interval(mins => p_duration_min);
  v_block timestamptz := p_start + make_interval(mins => p_duration_min + p_buffer_min);
begin
  if not exists (
    select 1
    from public.working_hours w
    join public.business_hours h on h.weekday = w.weekday and not h.is_closed
    where w.stylist_id = p_stylist_id
      and w.weekday = v_dow
      and p_start >= greatest(private.local_ts(v_date, w.starts_at), private.local_ts(v_date, h.opens_at))
      and v_end <= least(private.local_ts(v_date, w.ends_at), private.local_ts(v_date, h.closes_at))
  ) then
    return 'OUTSIDE_HOURS';
  end if;

  if exists (
    select 1 from public.stylist_breaks b
    where b.stylist_id = p_stylist_id
      and b.weekday = v_dow
      and tstzrange(private.local_ts(v_date, b.starts_at), private.local_ts(v_date, b.ends_at), '[)')
          && tstzrange(p_start, v_end, '[)')
  ) then
    return 'ON_BREAK';
  end if;

  if exists (
    select 1 from public.time_off t
    where (t.stylist_id = p_stylist_id or t.stylist_id is null)
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_start, v_block, '[)')
  ) then
    return 'TIME_OFF';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.stylist_id = p_stylist_id
      and a.status in ('pending', 'confirmed')
      and a.id is distinct from p_ignore_appointment
      and tstzrange(a.starts_at, a.blocked_until, '[)') && tstzrange(p_start, v_block, '[)')
  ) then
    return 'OVERLAP';
  end if;

  return null;
end;
$$;

-- All grid-aligned starts on a salon-local date that pass check_slot.
create function private.stylist_free_slots(
  p_stylist_id uuid,
  p_date date,
  p_duration_min integer,
  p_buffer_min integer,
  p_interval_min integer,
  p_ignore_appointment uuid default null
)
returns setof timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select distinct gs.slot
  from public.working_hours w
  join public.business_hours h on h.weekday = w.weekday and not h.is_closed
  cross join lateral generate_series(
    greatest(private.local_ts(p_date, w.starts_at), private.local_ts(p_date, h.opens_at)),
    least(private.local_ts(p_date, w.ends_at), private.local_ts(p_date, h.closes_at))
      - make_interval(mins => p_duration_min),
    make_interval(mins => p_interval_min)
  ) as gs (slot)
  where w.stylist_id = p_stylist_id
    and w.weekday = extract(dow from p_date)
    and private.check_slot(p_stylist_id, gs.slot, p_duration_min, p_buffer_min, p_ignore_appointment) is null
  order by 1
$$;

------------------------------------------------------------------------------
-- Booking creation (shared by online booking and front-desk entry)
------------------------------------------------------------------------------
create function private.create_booking(
  p_service_id uuid,
  p_stylist_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_source public.booking_source,
  p_staff_mode boolean,
  p_actor uuid,
  p_confirm boolean,
  p_policy_accepted boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.business_settings;
  v_service public.services;
  v_buffer integer;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_date date := private.local_date(p_starts_at);
  v_customer_id uuid;
  v_status public.appointment_status;
  v_candidate uuid;
  v_reason text;
  v_last_reason text;
  v_tried integer := 0;
  v_id uuid;
  v_reference text;
begin
  select * into s from public.business_settings where id = 1;
  if not found then
    raise exception 'NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  if char_length(v_name) not between 2 and 120 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'NOTES_TOO_LONG' using errcode = 'P0001';
  end if;
  if p_starts_at is null then
    raise exception 'INVALID_TIME' using errcode = 'P0001';
  end if;

  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  v_buffer := coalesce(v_service.buffer_min, s.default_buffer_min);

  if p_staff_mode then
    if p_starts_at < now() - interval '12 hours' then
      raise exception 'IN_PAST' using errcode = 'P0001';
    end if;
  else
    if not s.online_booking_enabled then
      raise exception 'BOOKING_DISABLED' using errcode = 'P0001';
    end if;
    if not coalesce(p_policy_accepted, false) then
      raise exception 'POLICY_NOT_ACCEPTED' using errcode = 'P0001';
    end if;
    if s.require_email and v_email is null then
      raise exception 'EMAIL_REQUIRED' using errcode = 'P0001';
    end if;
    if p_starts_at < now() + make_interval(mins => s.min_lead_minutes) then
      raise exception 'TOO_SOON' using errcode = 'P0001';
    end if;
    if v_date > private.local_date(now()) + s.max_advance_days then
      raise exception 'TOO_FAR' using errcode = 'P0001';
    end if;
  end if;

  -- Find or create the customer. A public booking never overwrites the
  -- details already on file for a phone number.
  insert into public.customers (full_name, phone_e164, email)
  values (v_name, p_phone, v_email)
  on conflict (phone_e164) do nothing
  returning id into v_customer_id;
  if v_customer_id is null then
    select c.id into v_customer_id from public.customers c where c.phone_e164 = p_phone;
  end if;

  v_status := case
    when p_confirm or (not p_staff_mode and s.auto_confirm) then 'confirmed'::public.appointment_status
    else 'pending'::public.appointment_status
  end;

  -- Candidates: the chosen stylist, or every eligible stylist ordered by how
  -- busy they already are that day ("any available stylist").
  for v_candidate in
    select st.id
    from public.stylists st
    join public.stylist_services ss on ss.stylist_id = st.id and ss.service_id = p_service_id
    where st.is_active
      and (p_staff_mode or st.accepts_online_booking)
      and (p_stylist_id is null or st.id = p_stylist_id)
    order by (
      select count(*) from public.appointments a
      where a.stylist_id = st.id
        and a.status in ('pending', 'confirmed')
        and private.local_date(a.starts_at) = v_date
    ), st.sort_order, st.id
  loop
    v_tried := v_tried + 1;

    if p_staff_mode then
      -- Front desk may book any free time, not only grid slots.
      v_reason := private.check_slot(v_candidate, p_starts_at, v_service.duration_min, v_buffer);
    elsif exists (
      select 1
      from private.stylist_free_slots(v_candidate, v_date, v_service.duration_min, v_buffer, s.slot_interval_min) as fs (slot)
      where fs.slot = p_starts_at
    ) then
      v_reason := null;
    else
      v_reason := coalesce(
        private.check_slot(v_candidate, p_starts_at, v_service.duration_min, v_buffer),
        'OFF_GRID'
      );
    end if;

    if v_reason is not null then
      v_last_reason := v_reason;
      continue;
    end if;

    v_id := null;
    for attempt in 1..5 loop
      begin
        v_reference := private.new_reference();
        insert into public.appointments (
          reference, service_id, stylist_id, customer_id, status, source, starts_at,
          service_name, price_etb, price_type, duration_min, buffer_min,
          customer_name, customer_phone, customer_email, customer_notes,
          policy_accepted_at, confirmed_at, created_by
        ) values (
          v_reference, v_service.id, v_candidate, v_customer_id, v_status, p_source, p_starts_at,
          v_service.name, v_service.price_etb, v_service.price_type, v_service.duration_min, v_buffer,
          v_name, p_phone, v_email, v_notes,
          case when coalesce(p_policy_accepted, false) then now() end,
          case when v_status = 'confirmed' then now() end,
          p_actor
        )
        returning id into v_id;
        exit;
      exception
        when unique_violation then
          v_id := null; -- reference collision: draw another
        when exclusion_violation then
          -- Another booking committed for this stylist between check and insert.
          v_id := null;
          v_last_reason := 'OVERLAP';
          exit;
      end;
    end loop;

    if v_id is not null then
      insert into public.appointment_events (appointment_id, event, actor_type, actor_id, details)
      values (
        v_id, 'created', case when p_staff_mode then 'staff' else 'customer' end, p_actor,
        jsonb_build_object('source', p_source, 'status', v_status)
      );
      return jsonb_build_object(
        'appointment_id', v_id,
        'reference', v_reference,
        'status', v_status,
        'stylist_id', v_candidate,
        'starts_at', p_starts_at,
        'ends_at', p_starts_at + make_interval(mins => v_service.duration_min)
      );
    end if;
  end loop;

  if v_tried = 0 then
    raise exception 'STYLIST_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_last_reason = 'OVERLAP' then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;
  raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001', detail = coalesce(v_last_reason, '');
end;
$$;

-- The customer-facing view of an appointment (no internal notes or contact data).
create function private.customer_view(a public.appointments)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.business_settings;
  v_stylist text;
  v_deadline timestamptz;
  v_open boolean;
begin
  select * into s from public.business_settings where id = 1;
  select st.display_name into v_stylist from public.stylists st where st.id = a.stylist_id;
  v_deadline := a.starts_at - make_interval(hours => s.cancel_cutoff_hours);
  v_open := a.status in ('pending', 'confirmed') and now() <= v_deadline;
  return jsonb_build_object(
    'reference', a.reference,
    'status', a.status,
    'service_id', a.service_id,
    'service_name', a.service_name,
    'stylist_name', v_stylist,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'duration_min', a.duration_min,
    'price_etb', a.price_etb,
    'price_type', a.price_type,
    'customer_name', a.customer_name,
    'can_cancel', v_open and s.allow_customer_cancel,
    'can_reschedule', v_open and s.allow_customer_reschedule,
    'change_deadline', v_deadline
  );
end;
$$;

------------------------------------------------------------------------------
-- Public booking API (callable only with the server's secret key)
------------------------------------------------------------------------------
create function public.get_available_slots(p_service_id uuid, p_stylist_id uuid, p_date date)
returns table (slot_start timestamptz, stylists_free integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.business_settings;
  v_service public.services;
  v_today date := private.local_date(now());
begin
  select * into s from public.business_settings where id = 1;
  if not found or not s.online_booking_enabled then
    return;
  end if;
  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if p_date < v_today or p_date > v_today + s.max_advance_days then
    return;
  end if;

  return query
    select fs.slot, count(*)::integer
    from public.stylists st
    join public.stylist_services ss on ss.stylist_id = st.id and ss.service_id = p_service_id
    cross join lateral private.stylist_free_slots(
      st.id, p_date, v_service.duration_min,
      coalesce(v_service.buffer_min, s.default_buffer_min), s.slot_interval_min
    ) as fs (slot)
    where st.is_active
      and st.accepts_online_booking
      and (p_stylist_id is null or st.id = p_stylist_id)
      and fs.slot >= now() + make_interval(mins => s.min_lead_minutes)
    group by fs.slot
    order by fs.slot;
end;
$$;

-- Dates in [p_from, p_to] on which at least one eligible stylist is scheduled
-- and not fully away. Used to grey out the calendar; exact slots are fetched
-- per day with get_available_slots.
create function public.get_bookable_days(p_service_id uuid, p_stylist_id uuid, p_from date, p_to date)
returns setof date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.business_settings;
  v_today date := private.local_date(now());
begin
  select * into s from public.business_settings where id = 1;
  if not found or not s.online_booking_enabled then
    return;
  end if;
  if not exists (select 1 from public.services where id = p_service_id and is_active) then
    return;
  end if;

  return query
    select d::date
    from generate_series(
      greatest(p_from, v_today),
      least(p_to, v_today + s.max_advance_days, p_from + 62),
      interval '1 day'
    ) as d
    where exists (
      select 1
      from public.stylists st
      join public.stylist_services ss on ss.stylist_id = st.id and ss.service_id = p_service_id
      join public.working_hours w on w.stylist_id = st.id and w.weekday = extract(dow from d)
      join public.business_hours h on h.weekday = w.weekday and not h.is_closed
      where st.is_active
        and st.accepts_online_booking
        and (p_stylist_id is null or st.id = p_stylist_id)
        and greatest(w.starts_at, h.opens_at) < least(w.ends_at, h.closes_at)
        and not exists (
          select 1 from public.time_off t
          where (t.stylist_id = st.id or t.stylist_id is null)
            and t.starts_at <= private.local_ts(d::date, greatest(w.starts_at, h.opens_at))
            and t.ends_at >= private.local_ts(d::date, least(w.ends_at, h.closes_at))
        )
    )
    order by 1;
end;
$$;

create function public.book_appointment(
  p_service_id uuid,
  p_stylist_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_policy_accepted boolean
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_booking(
    p_service_id, p_stylist_id, p_starts_at, p_full_name, p_phone, p_email, p_notes,
    'online', false, null, false, p_policy_accepted
  )
$$;

-- Customer self-service is keyed on reference + the phone number used to book.
create function public.customer_lookup(p_reference text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments
  where reference = upper(btrim(p_reference)) and customer_phone = p_phone;
  if not found then
    return null;
  end if;
  return private.customer_view(a);
end;
$$;

create function public.customer_cancel(p_reference text, p_phone text, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  s public.business_settings;
begin
  select * into s from public.business_settings where id = 1;
  select * into a from public.appointments
  where reference = upper(btrim(p_reference)) and customer_phone = p_phone
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if a.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if not s.allow_customer_cancel then
    raise exception 'CHANGES_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if now() > a.starts_at - make_interval(hours => s.cancel_cutoff_hours) then
    raise exception 'PAST_CUTOFF' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'customer',
      cancel_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500)
  where id = a.id
  returning * into a;

  insert into public.appointment_events (appointment_id, event, actor_type, details)
  values (a.id, 'cancelled', 'customer', jsonb_build_object('reason', a.cancel_reason));

  return private.customer_view(a);
end;
$$;

create function public.customer_reschedule_slots(p_reference text, p_phone text, p_date date)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  s public.business_settings;
  v_today date := private.local_date(now());
begin
  select * into s from public.business_settings where id = 1;
  select * into a from public.appointments
  where reference = upper(btrim(p_reference)) and customer_phone = p_phone;
  if not found or a.status not in ('pending', 'confirmed') or not s.allow_customer_reschedule then
    return;
  end if;
  if p_date < v_today or p_date > v_today + s.max_advance_days then
    return;
  end if;
  return query
    select fs.slot
    from private.stylist_free_slots(a.stylist_id, p_date, a.duration_min, a.buffer_min, s.slot_interval_min, a.id) as fs (slot)
    where fs.slot >= now() + make_interval(mins => s.min_lead_minutes)
      and exists (select 1 from public.stylists st where st.id = a.stylist_id and st.is_active);
end;
$$;

create function public.customer_reschedule(p_reference text, p_phone text, p_new_start timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  s public.business_settings;
  v_old timestamptz;
  v_status public.appointment_status;
begin
  select * into s from public.business_settings where id = 1;
  select * into a from public.appointments
  where reference = upper(btrim(p_reference)) and customer_phone = p_phone
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if a.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if not s.allow_customer_reschedule then
    raise exception 'CHANGES_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if now() > a.starts_at - make_interval(hours => s.cancel_cutoff_hours) then
    raise exception 'PAST_CUTOFF' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.customer_reschedule_slots(p_reference, p_phone, private.local_date(p_new_start)) as fs (slot)
    where fs.slot = p_new_start
  ) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_old := a.starts_at;
  v_status := case when s.auto_confirm then 'confirmed'::public.appointment_status else 'pending'::public.appointment_status end;
  begin
    update public.appointments
    set starts_at = p_new_start,
        status = v_status,
        confirmed_at = case when v_status = 'confirmed' then now() end
    where id = a.id
    returning * into a;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  insert into public.appointment_events (appointment_id, event, actor_type, details)
  values (a.id, 'rescheduled', 'customer', jsonb_build_object('from', v_old, 'to', p_new_start));

  return private.customer_view(a);
end;
$$;

------------------------------------------------------------------------------
-- Staff API (signed-in staff; each function checks the caller's role)
------------------------------------------------------------------------------
create function public.staff_create_appointment(
  p_service_id uuid,
  p_stylist_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_source public.booking_source default 'phone',
  p_confirm boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_front_desk();
  return private.create_booking(
    p_service_id, p_stylist_id, p_starts_at, p_full_name, p_phone, p_email, p_notes,
    p_source, true, auth.uid(), p_confirm, false
  );
end;
$$;

create function public.staff_available_slots(
  p_service_id uuid,
  p_stylist_id uuid,
  p_date date,
  p_ignore_appointment uuid default null
)
returns table (slot_start timestamptz, slot_stylist_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.business_settings;
  v_service public.services;
  v_duration integer;
  v_buffer integer;
begin
  perform private.require_front_desk();
  select * into s from public.business_settings where id = 1;
  select * into v_service from public.services where id = p_service_id;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- When rescheduling, keep the appointment's own snapshot of duration/buffer.
  select coalesce(a.duration_min, v_service.duration_min), coalesce(a.buffer_min, v_service.buffer_min, s.default_buffer_min)
  into v_duration, v_buffer
  from (select 1) as one
  left join public.appointments a on a.id = p_ignore_appointment;

  return query
    select fs.slot, st.id
    from public.stylists st
    join public.stylist_services ss on ss.stylist_id = st.id and ss.service_id = p_service_id
    cross join lateral private.stylist_free_slots(
      st.id, p_date, v_duration, v_buffer, s.slot_interval_min, p_ignore_appointment
    ) as fs (slot)
    where st.is_active
      and (p_stylist_id is null or st.id = p_stylist_id)
      and fs.slot >= now()
    order by fs.slot, st.sort_order;
end;
$$;

create function public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_reason text default null,
  p_amount_paid_etb integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_slot_problem text;
  v_event text;
begin
  perform private.require_front_desk();

  select * into a from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not (
    (a.status = 'pending' and p_status in ('confirmed', 'cancelled'))
    or (a.status = 'confirmed' and p_status in ('completed', 'no_show', 'cancelled'))
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001',
      detail = format('%s → %s', a.status, p_status);
  end if;

  if p_status = 'confirmed' then
    -- The schedule may have changed since the request (time off, new hours).
    v_slot_problem := private.check_slot(a.stylist_id, a.starts_at, a.duration_min, a.buffer_min, a.id);
    if v_slot_problem is not null then
      raise exception 'SLOT_NO_LONGER_AVAILABLE' using errcode = 'P0001', detail = v_slot_problem;
    end if;
  elsif p_status = 'cancelled' and v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  elsif p_status in ('completed', 'no_show') and a.starts_at > now() then
    raise exception 'NOT_STARTED' using errcode = 'P0001';
  end if;

  if p_amount_paid_etb is not null and (p_status <> 'completed' or p_amount_paid_etb < 0) then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = p_status,
      confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      cancelled_by = case when p_status = 'cancelled' then 'staff' else cancelled_by end,
      cancel_reason = case when p_status = 'cancelled' then left(v_reason, 500) else cancel_reason end,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      amount_paid_etb = case when p_status = 'completed' then p_amount_paid_etb else amount_paid_etb end
  where id = a.id;

  v_event := case
    when p_status = 'cancelled' and a.status = 'pending' then 'rejected'
    else p_status::text
  end;
  insert into public.appointment_events (appointment_id, event, actor_type, actor_id, details)
  values (
    a.id, v_event, 'staff', auth.uid(),
    jsonb_strip_nulls(jsonb_build_object(
      'from', a.status, 'to', p_status, 'reason', v_reason, 'amount_paid_etb', p_amount_paid_etb
    ))
  );

  return jsonb_build_object('appointment_id', a.id, 'status', p_status, 'event', v_event);
end;
$$;

create function public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_start timestamptz,
  p_new_stylist_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  v_stylist uuid;
  v_problem text;
begin
  perform private.require_front_desk();

  select * into a from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if a.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  v_stylist := coalesce(p_new_stylist_id, a.stylist_id);
  if not exists (
    select 1 from public.stylists st
    join public.stylist_services ss on ss.stylist_id = st.id and ss.service_id = a.service_id
    where st.id = v_stylist and st.is_active
  ) then
    raise exception 'STYLIST_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_problem := private.check_slot(v_stylist, p_new_start, a.duration_min, a.buffer_min, a.id);
  if v_problem is not null then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001', detail = v_problem;
  end if;

  begin
    update public.appointments
    set starts_at = p_new_start, stylist_id = v_stylist
    where id = a.id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  insert into public.appointment_events (appointment_id, event, actor_type, actor_id, details)
  values (
    a.id, 'rescheduled', 'staff', auth.uid(),
    jsonb_build_object('from', a.starts_at, 'to', p_new_start, 'from_stylist', a.stylist_id, 'to_stylist', v_stylist)
  );

  return jsonb_build_object('appointment_id', a.id, 'starts_at', p_new_start, 'stylist_id', v_stylist);
end;
$$;

create function public.update_appointment_notes(p_appointment_id uuid, p_notes text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_front_desk();
  update public.appointments
  set internal_notes = left(nullif(btrim(coalesce(p_notes, '')), ''), 2000)
  where id = p_appointment_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

-- Counts and revenue for a period. Security invoker: row-level security limits
-- stylists to their own appointments. Recorded revenue counts completed
-- appointments only; expected revenue is confirmed work not yet completed.
create function public.dashboard_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*),
    'pending', count(*) filter (where status = 'pending'),
    'confirmed', count(*) filter (where status = 'confirmed'),
    'completed', count(*) filter (where status = 'completed'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'no_show', count(*) filter (where status = 'no_show'),
    'recorded_revenue_etb', coalesce(sum(coalesce(amount_paid_etb, price_etb)) filter (where status = 'completed'), 0),
    'expected_revenue_etb', coalesce(sum(price_etb) filter (where status = 'confirmed'), 0)
  )
  from public.appointments
  where starts_at >= p_from and starts_at < p_to
$$;

------------------------------------------------------------------------------
-- Admin helpers (atomic multi-row edits)
------------------------------------------------------------------------------
-- Replace a stylist's weekly hours and breaks in one transaction.
-- p_hours / p_breaks: [{"weekday":1,"starts_at":"09:00","ends_at":"17:00","label":"Lunch"}]
create function public.set_stylist_schedule(p_stylist_id uuid, p_hours jsonb, p_breaks jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if not exists (select 1 from public.stylists where id = p_stylist_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  delete from public.working_hours where stylist_id = p_stylist_id;
  delete from public.stylist_breaks where stylist_id = p_stylist_id;

  insert into public.working_hours (stylist_id, weekday, starts_at, ends_at)
  select p_stylist_id, (e ->> 'weekday')::smallint, (e ->> 'starts_at')::time, (e ->> 'ends_at')::time
  from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) as e;

  insert into public.stylist_breaks (stylist_id, weekday, starts_at, ends_at, label)
  select p_stylist_id, (e ->> 'weekday')::smallint, (e ->> 'starts_at')::time, (e ->> 'ends_at')::time,
         nullif(e ->> 'label', '')
  from jsonb_array_elements(coalesce(p_breaks, '[]'::jsonb)) as e;

  insert into public.audit_events (actor_id, actor_role, action, entity, entity_id, after)
  values (
    auth.uid(), private.current_staff_role()::text, 'update', 'stylist_schedule', p_stylist_id::text,
    jsonb_build_object('hours', p_hours, 'breaks', p_breaks)
  );
exception
  when exclusion_violation then
    raise exception 'SCHEDULE_OVERLAP' using errcode = 'P0001';
  when check_violation or invalid_datetime_format or invalid_text_representation then
    raise exception 'INVALID_SCHEDULE' using errcode = 'P0001';
end;
$$;

create function public.set_stylist_services(p_stylist_id uuid, p_service_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  delete from public.stylist_services
  where stylist_id = p_stylist_id and not (service_id = any (coalesce(p_service_ids, '{}')));
  insert into public.stylist_services (stylist_id, service_id)
  select p_stylist_id, sid from unnest(coalesce(p_service_ids, '{}')) as sid
  on conflict do nothing;
end;
$$;

create function public.reorder_gallery(p_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.gallery_items g
  set sort_order = x.ord::integer
  from unnest(p_ids) with ordinality as x (id, ord)
  where g.id = x.id;
end;
$$;

------------------------------------------------------------------------------
-- Rate limiting (fixed window, atomic upsert). Keys are hashed by the caller.
------------------------------------------------------------------------------
create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
  set hits = case
        when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
        else r.hits + 1
      end,
      window_start = case
        when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
        else r.window_start
      end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

create function public.prune_rate_limits()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with gone as (
    delete from private.rate_limits where window_start < now() - interval '1 day' returning 1
  )
  select count(*)::integer from gone
$$;

------------------------------------------------------------------------------
-- Function privileges: nothing is callable unless granted here.
------------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function
  private.current_staff_role(), private.is_admin(), private.is_front_desk(),
  private.is_staff(), private.my_stylist_id()
to anon, authenticated;

grant execute on function
  public.get_available_slots(uuid, uuid, date),
  public.get_bookable_days(uuid, uuid, date, date),
  public.book_appointment(uuid, uuid, timestamptz, text, text, text, text, boolean),
  public.customer_lookup(text, text),
  public.customer_cancel(text, text, text),
  public.customer_reschedule_slots(text, text, date),
  public.customer_reschedule(text, text, timestamptz),
  public.consume_rate_limit(text, integer, integer),
  public.prune_rate_limits()
to service_role;

grant execute on function
  public.staff_create_appointment(uuid, uuid, timestamptz, text, text, text, text, public.booking_source, boolean),
  public.staff_available_slots(uuid, uuid, date, uuid),
  public.set_appointment_status(uuid, public.appointment_status, text, integer),
  public.reschedule_appointment(uuid, timestamptz, uuid),
  public.update_appointment_notes(uuid, text),
  public.dashboard_summary(timestamptz, timestamptz),
  public.set_stylist_schedule(uuid, jsonb, jsonb),
  public.set_stylist_services(uuid, uuid[]),
  public.reorder_gallery(uuid[])
to authenticated;
