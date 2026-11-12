-- Run this entire file in Supabase SQL Editor if public appointment booking is enabled.

alter table public.appointments add column if not exists booking_code text;
alter table public.appointments add column if not exists location text;

update public.appointments
set booking_code = 'APT-' || lpad(id::text, 6, '0')
where booking_code is null;

create unique index if not exists appointments_booking_code_unique
  on public.appointments(booking_code)
  where booking_code is not null;

drop function if exists public.book_appointment(text, text, timestamptz, text, text, text);
drop function if exists public.book_appointment(text, text, timestamptz, text, text);
drop function if exists public.book_appointment(text, text, date, text, text, text);

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
  if p_appt_at is null or p_appt_at <= now() then
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
begin
  if length(trim(coalesce(p_reason, ''))) = 0 or length(trim(p_reason)) > 500 then
    raise exception 'Reason must be between 1 and 500 characters';
  end if;
  if p_appt_at is null or p_appt_at <= now() then
    raise exception 'Appointment time must be in the future';
  end if;
  if trim(coalesce(p_doctor, '')) <> 'Monique Nolasco - Pet' then
    raise exception 'Invalid doctor';
  end if;
  if trim(coalesce(p_location, '')) not in ('Sta. Ana, Cagayan', 'Gattaran, Cagayan') then
    raise exception 'Invalid location';
  end if;

  select a.id, a.booking_code into v_appointment_id, v_booking_code
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where upper(a.booking_code) = upper(trim(coalesce(p_booking_code, '')))
    and p.phone = trim(coalesce(p_phone, ''))
    and a.status = 'Scheduled'
    and a.appt_at > now()
  for update of a;

  if not found then
    raise exception 'Booking ID or phone number was not recognized, or the appointment can no longer be changed';
  end if;

  update public.appointments
  set appt_at = p_appt_at,
      reason = trim(p_reason),
      doctor = trim(p_doctor),
      location = trim(p_location)
  where id = v_appointment_id;

  return jsonb_build_object('booking_code', v_booking_code);
end;
$$;

revoke all on function public.update_public_appointment(text, text, timestamptz, text, text, text) from public;
grant execute on function public.update_public_appointment(text, text, timestamptz, text, text, text) to anon, authenticated;

drop trigger if exists prevent_doctor_double_booking on public.appointments;
drop function if exists public.prevent_doctor_double_booking();

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
