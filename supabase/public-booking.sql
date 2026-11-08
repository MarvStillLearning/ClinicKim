-- Run this entire file in Supabase SQL Editor if public appointment booking is enabled.

alter table public.appointments add column if not exists booking_code text;
alter table public.appointments add column if not exists duration_minutes integer not null default 30;
alter table public.appointments add column if not exists location text;

update public.appointments
set booking_code = 'APT-' || lpad(id::text, 6, '0')
where booking_code is null;

create unique index if not exists appointments_booking_code_unique
  on public.appointments(booking_code)
  where booking_code is not null;

drop function if exists public.book_appointment(text, text, timestamptz, text, text, text);
drop function if exists public.book_appointment(text, text, timestamptz, text, text);

create function public.book_appointment(
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
begin
  if length(trim(coalesce(p_full_name, ''))) > 100 then
    raise exception 'Full name is too long';
  end if;
  if length(trim(coalesce(p_phone, ''))) > 30 then
    raise exception 'Phone number is too long';
  end if;
  if length(trim(coalesce(p_reason, ''))) > 500 then
    raise exception 'Reason is too long';
  end if;
  if length(trim(coalesce(p_doctor, ''))) > 100 then
    raise exception 'Doctor name is too long';
  end if;
  if trim(coalesce(p_doctor, '')) <> 'Monique Nolasco - Pet' then
    raise exception 'Invalid doctor';
  end if;
  if trim(coalesce(p_location, '')) not in ('Sta. Ana, Cagayan', 'Gattaran, Cagayan') then
    raise exception 'Invalid location';
  end if;
  if length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'Full name is required';
  end if;
  if length(trim(coalesce(p_phone, ''))) = 0 then
    raise exception 'Phone number is required';
  end if;
  if p_appt_at <= now() then
    raise exception 'Appointment time must be in the future';
  end if;

  select id into v_patient_id
  from public.patients
  where phone = trim(p_phone)
  limit 1;

  if v_patient_id is null then
    insert into public.patients (full_name, phone)
    values (trim(p_full_name), trim(p_phone))
    returning id into v_patient_id;
  else
    update public.patients
    set full_name = trim(p_full_name)
    where id = v_patient_id
      and (full_name is null or length(trim(full_name)) = 0);
  end if;

  insert into public.appointments (patient_id, appt_at, reason, doctor, location, status)
  values (
    v_patient_id,
    p_appt_at,
    trim(coalesce(p_reason, '')),
    'Monique Nolasco - Pet',
    trim(p_location),
    'Scheduled'
  )
  returning id into v_appointment_id;

  update public.appointments
  set booking_code = 'APT-' || lpad(v_appointment_id::text, 6, '0')
  where id = v_appointment_id
  returning booking_code into v_booking_code;

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'booking_code', v_booking_code
  );
end;
$$;

revoke all on function public.book_appointment(text, text, timestamptz, text, text, text) from public;
grant execute on function public.book_appointment(text, text, timestamptz, text, text, text) to anon, authenticated;

alter table public.appointments add column if not exists duration_minutes integer not null default 30;

create or replace function public.prevent_doctor_double_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration integer := greatest(coalesce(new.duration_minutes, 30), 15);
begin
  if coalesce(new.status, '') = 'Cancelled' then return new; end if;
  if coalesce(trim(new.doctor), '') = '' then return new; end if;
  if exists (
    select 1 from public.appointments existing
    where existing.id is distinct from new.id
      and existing.status <> 'Cancelled'
      and coalesce(existing.status, '') <> 'Done'
      and lower(trim(coalesce(existing.doctor, ''))) = lower(trim(new.doctor))
      and existing.appt_at < (new.appt_at + make_interval(mins => v_duration))
      and (existing.appt_at + make_interval(mins => greatest(coalesce(existing.duration_minutes, 30), 15))) > new.appt_at
  ) then
    raise exception 'Doctor is already booked for this time slot';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_doctor_double_booking on public.appointments;
create trigger prevent_doctor_double_booking
  before insert or update on public.appointments
  for each row execute function public.prevent_doctor_double_booking();

drop function if exists public.get_doctors();
create function public.get_doctors()
returns table(id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.role = 'doctor'
    and coalesce(trim(p.full_name), '') <> ''
  order by p.full_name;
$$;

revoke all on function public.get_doctors() from public;
grant execute on function public.get_doctors() to anon, authenticated;

notify pgrst, 'reload schema';
