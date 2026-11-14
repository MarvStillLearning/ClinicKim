-- Run after supabase/public-booking.sql in Supabase SQL Editor.
-- Adds exact available dates and hourly appointment capacity from 8:00 AM to 4:00 PM.

create table if not exists public.doctor_schedule_dates (
  id bigint generated always as identity primary key,
  doctor text not null,
  location text not null check (location in ('Sta. Ana, Cagayan', 'Gattaran, Cagayan')),
  available_date date not null,
  available_from time not null default time '08:00',
  available_until time not null default time '16:00',
  created_at timestamptz not null default now(),
  unique (doctor, location, available_date),
  constraint doctor_schedule_dates_hours_check
    check (available_from = time '08:00' and available_until = time '16:00')
);

alter table public.doctor_schedule_dates
  add column if not exists available_from time not null default time '08:00';
alter table public.doctor_schedule_dates
  add column if not exists available_until time not null default time '16:00';

alter table public.doctor_schedule_dates
  drop constraint if exists doctor_schedule_dates_hours_check;

update public.doctor_schedule_dates
set available_from = time '08:00'
where available_from is distinct from time '08:00';
update public.doctor_schedule_dates
set available_until = time '16:00'
where available_until is distinct from time '16:00';
alter table public.doctor_schedule_dates
  alter column available_from set default time '08:00',
  alter column available_from set not null,
  alter column available_until set default time '16:00',
  alter column available_until set not null;

create unique index if not exists doctor_schedule_dates_doctor_location_date_unique
  on public.doctor_schedule_dates(doctor, location, available_date);

alter table public.doctor_schedule_dates
  drop constraint if exists doctor_schedule_dates_hours_check;
alter table public.doctor_schedule_dates
  add constraint doctor_schedule_dates_hours_check
  check (
    available_from = time '08:00'
    and available_until = time '16:00'
  );

alter table public.doctor_schedule_dates enable row level security;
grant select, insert, delete on public.doctor_schedule_dates to authenticated;
grant usage, select on sequence public.doctor_schedule_dates_id_seq to authenticated;

drop policy if exists "doctor schedule dates admin manage" on public.doctor_schedule_dates;
create policy "doctor schedule dates admin manage" on public.doctor_schedule_dates for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Preserve old weekly schedules as individual dates for the next 90 days.
do $$
begin
  if to_regclass('public.doctor_schedule_slots') is not null then
    if to_regclass('public.doctor_schedule_closures') is not null then
      execute $migration$
        insert into public.doctor_schedule_dates (doctor, location, available_date)
        select distinct
          s.doctor,
          s.location,
          (now() at time zone 'Asia/Manila')::date + days.day_offset
        from public.doctor_schedule_slots s
        cross join generate_series(0, 90) as days(day_offset)
        where s.weekday = extract(dow from (now() at time zone 'Asia/Manila')::date + days.day_offset)::smallint
          and not exists (
            select 1
            from public.doctor_schedule_closures c
            where c.doctor = s.doctor
              and c.location = s.location
              and c.closed_date = (now() at time zone 'Asia/Manila')::date + days.day_offset
          )
        on conflict (doctor, location, available_date) do nothing
      $migration$;
    else
      execute $migration$
        insert into public.doctor_schedule_dates (doctor, location, available_date)
        select distinct
          s.doctor,
          s.location,
          (now() at time zone 'Asia/Manila')::date + days.day_offset
        from public.doctor_schedule_slots s
        cross join generate_series(0, 90) as days(day_offset)
        where s.weekday = extract(dow from (now() at time zone 'Asia/Manila')::date + days.day_offset)::smallint
        on conflict (doctor, location, available_date) do nothing
      $migration$;
    end if;
  end if;
end;
$$;

drop function if exists public.get_public_appointment_slots(date, text, text, text);
drop function if exists public.get_public_appointment_slots(date, text, text);
drop function if exists public.get_public_appointment_doctors(date, text);
create function public.get_public_appointment_doctors(p_date date, p_location text)
returns table(doctor text)
language sql
stable
security definer
set search_path = public
as $$
  select d.doctor
  from public.doctor_schedule_dates d
  where d.location = p_location
    and d.available_date = p_date
    and (d.available_date + d.available_until) at time zone 'Asia/Manila' > now()
  order by d.doctor;
$$;

create function public.get_public_appointment_slots(p_date date, p_location text, p_doctor text)
returns table(available_time time, remaining_slots integer)
language sql
stable
security definer
set search_path = public
as $$
  select slots.available_time,
    greatest(0, 10 - (
      select count(*)::integer
      from public.appointments a
      where lower(trim(a.doctor)) = lower(trim(p_doctor))
        and (a.appt_at at time zone 'Asia/Manila')::date = p_date
        and extract(hour from (a.appt_at at time zone 'Asia/Manila')) = extract(hour from slots.available_time)
        and a.status not in ('Cancelled', 'Done')
    )) as remaining_slots
  from generate_series(8, 15) as slot(hour_number)
  cross join lateral (
    select make_time(slot.hour_number, 0, 0) as available_time
  ) slots
  where exists (
    select 1
    from public.doctor_schedule_dates d
    where d.doctor = p_doctor
      and d.location = p_location
      and d.available_date = p_date
      and slots.available_time >= d.available_from
      and slots.available_time < d.available_until
  )
  order by slots.available_time;
$$;

drop function if exists public.get_public_appointment_dates(text);
create function public.get_public_appointment_dates(p_location text)
returns table(available_date date)
language sql
stable
security definer
set search_path = public
as $$
  select distinct d.available_date
  from public.doctor_schedule_dates d
  where d.location = p_location
    and d.available_date >= (now() at time zone 'Asia/Manila')::date
    and (d.available_date + d.available_until) at time zone 'Asia/Manila' > now()
  order by d.available_date;
$$;

revoke all on function public.get_public_appointment_dates(text) from public;
revoke all on function public.get_public_appointment_doctors(date, text) from public;
revoke all on function public.get_public_appointment_slots(date, text, text) from public;
grant execute on function public.get_public_appointment_dates(text) to anon, authenticated;
grant execute on function public.get_public_appointment_doctors(date, text) to anon, authenticated;
grant execute on function public.get_public_appointment_slots(date, text, text) to anon, authenticated;

drop function if exists public.book_appointment(text, text, date, text, text, text);
create or replace function public.book_appointment(
  p_full_name text,
  p_phone text,
  p_appt_at timestamptz,
  p_reason text,
  p_doctor text default 'Monique Nolasco - Pet',
  p_location text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id bigint;
  v_appointment_id bigint;
  v_booking_code text;
  v_local_date date := (p_appt_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_appt_at at time zone 'Asia/Manila')::time;
begin
  if length(trim(coalesce(p_full_name, ''))) = 0 or length(trim(p_full_name)) > 100 then raise exception 'Invalid full name'; end if;
  if length(trim(coalesce(p_phone, ''))) = 0 or length(trim(p_phone)) > 30 then raise exception 'Invalid phone number'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 or length(trim(p_reason)) > 500 then raise exception 'Invalid reason for visit'; end if;
  if p_appt_at is null or p_appt_at <= now() then raise exception 'Appointment time must be in the future'; end if;
  if trim(coalesce(p_doctor, '')) = '' or length(trim(p_doctor)) > 100 then raise exception 'Invalid doctor'; end if;
  if trim(coalesce(p_location, '')) not in ('Sta. Ana, Cagayan', 'Gattaran, Cagayan') then raise exception 'Invalid location'; end if;

  if not exists (
    select 1 from public.doctor_schedule_dates d
    where d.doctor = trim(p_doctor)
      and d.location = trim(p_location)
      and d.available_date = v_local_date
      and v_local_time >= d.available_from
      and v_local_time < d.available_until
  ) then
    raise exception 'This appointment date or time is not available';
  end if;

  select id into v_patient_id from public.patients where phone = trim(p_phone) limit 1;
  if v_patient_id is null then
    insert into public.patients (full_name, phone)
    values (trim(p_full_name), trim(p_phone))
    returning id into v_patient_id;
  else
    update public.patients set full_name = trim(p_full_name)
    where id = v_patient_id and (full_name is null or length(trim(full_name)) = 0);
  end if;

  insert into public.appointments (patient_id, appt_at, reason, doctor, location, status)
  values (v_patient_id, p_appt_at, trim(p_reason), trim(p_doctor), trim(p_location), 'Scheduled')
  returning id into v_appointment_id;

  update public.appointments
  set booking_code = 'APT-' || lpad(v_appointment_id::text, 6, '0')
  where id = v_appointment_id
  returning booking_code into v_booking_code;

  return jsonb_build_object('appointment_id', v_appointment_id, 'booking_code', v_booking_code);
end;
$$;

revoke all on function public.book_appointment(text, text, timestamptz, text, text, text) from public;
grant execute on function public.book_appointment(text, text, timestamptz, text, text, text) to anon, authenticated;

create or replace function public.get_public_appointment(
  p_booking_code text,
  p_phone text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment record;
begin
  select a.booking_code, a.appt_at, a.reason, a.doctor, a.location, a.status
  into v_appointment
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where upper(a.booking_code) = upper(trim(coalesce(p_booking_code, '')))
    and p.phone = trim(coalesce(p_phone, ''));

  if not found then
    raise exception 'Booking ID or phone number was not recognized';
  end if;
  if v_appointment.status <> 'Scheduled' or v_appointment.appt_at <= now() then
    raise exception 'This appointment can no longer be changed';
  end if;

  return jsonb_build_object(
    'booking_code', v_appointment.booking_code,
    'appt_at', v_appointment.appt_at,
    'reason', v_appointment.reason,
    'doctor', v_appointment.doctor,
    'location', v_appointment.location
  );
end;
$$;

revoke all on function public.get_public_appointment(text, text) from public;
grant execute on function public.get_public_appointment(text, text) to anon, authenticated;

drop function if exists public.update_public_appointment(text, text, date, text, text, text);
create or replace function public.update_public_appointment(
  p_booking_code text,
  p_phone text,
  p_appt_at timestamptz,
  p_reason text,
  p_doctor text,
  p_location text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment_id bigint;
  v_booking_code text;
  v_local_date date := (p_appt_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_appt_at at time zone 'Asia/Manila')::time;
begin
  if length(trim(coalesce(p_reason, ''))) = 0 or length(trim(p_reason)) > 500 then raise exception 'Invalid reason for visit'; end if;
  if p_appt_at is null or p_appt_at <= now() then raise exception 'Appointment time must be in the future'; end if;
  if trim(coalesce(p_doctor, '')) = '' or length(trim(p_doctor)) > 100 then raise exception 'Invalid doctor'; end if;
  if trim(coalesce(p_location, '')) not in ('Sta. Ana, Cagayan', 'Gattaran, Cagayan') then raise exception 'Invalid location'; end if;

  select a.id, a.booking_code into v_appointment_id, v_booking_code
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where upper(a.booking_code) = upper(trim(coalesce(p_booking_code, '')))
    and p.phone = trim(coalesce(p_phone, ''))
    and a.status = 'Scheduled'
    and a.appt_at > now()
  for update of a;
  if not found then raise exception 'Booking ID or phone number was not recognized, or the appointment can no longer be changed'; end if;

  if not exists (
    select 1 from public.doctor_schedule_dates d
    where d.doctor = trim(p_doctor)
      and d.location = trim(p_location)
      and d.available_date = v_local_date
      and v_local_time >= d.available_from
      and v_local_time < d.available_until
  ) then
    raise exception 'This appointment date or time is no longer available';
  end if;

  update public.appointments
  set appt_at = p_appt_at, reason = trim(p_reason), doctor = trim(p_doctor), location = trim(p_location)
  where id = v_appointment_id;
  return jsonb_build_object('booking_code', v_booking_code);
end;
$$;

revoke all on function public.update_public_appointment(text, text, timestamptz, text, text, text) from public;
grant execute on function public.update_public_appointment(text, text, timestamptz, text, text, text) to anon, authenticated;

drop trigger if exists prevent_doctor_double_booking on public.appointments;
drop function if exists public.prevent_doctor_double_booking();
create or replace function public.prevent_doctor_double_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_date date;
  v_local_time time;
begin
  if new.status in ('Cancelled', 'Done') or coalesce(trim(new.doctor), '') = '' then return new; end if;
  if new.appt_at <= now() then
    raise exception 'Appointment time must be in the future';
  end if;

  v_local_date := (new.appt_at at time zone 'Asia/Manila')::date;
  v_local_time := (new.appt_at at time zone 'Asia/Manila')::time;
  if v_local_time < time '08:00' or v_local_time >= time '16:00'
    or extract(minute from v_local_time) <> 0
    or extract(second from v_local_time) <> 0 then
    raise exception 'Appointments must start on the hour between 8:00 AM and 3:00 PM';
  end if;
  if not exists (
    select 1
    from public.doctor_schedule_dates d
    where d.doctor = trim(new.doctor)
      and d.location = trim(new.location)
      and d.available_date = v_local_date
      and v_local_time >= d.available_from
      and v_local_time < d.available_until
  ) then
    raise exception 'This appointment date or time is not available';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    lower(trim(new.doctor)) || '|' || v_local_date::text || '|' || extract(hour from v_local_time)::text, 0
  ));
  if (
    select count(*)
    from public.appointments a
    where a.id is distinct from new.id
      and a.status not in ('Cancelled', 'Done')
      and lower(trim(a.doctor)) = lower(trim(new.doctor))
      and (a.appt_at at time zone 'Asia/Manila')::date = v_local_date
      and extract(hour from (a.appt_at at time zone 'Asia/Manila')) = extract(hour from v_local_time)
  ) >= 10 then
    raise exception 'This hour is full. Please choose another hour.';
  end if;
  return new;
end;
$$;

create trigger prevent_doctor_double_booking
  before insert or update on public.appointments
  for each row execute function public.prevent_doctor_double_booking();

alter table public.appointments drop column if exists duration_minutes;

notify pgrst, 'reload schema';
