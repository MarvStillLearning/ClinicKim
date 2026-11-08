-- Run this entire file in Supabase SQL Editor if public appointment booking is enabled.

alter table public.appointments add column if not exists booking_code text;

update public.appointments
set booking_code = 'APT-' || lpad(id::text, 6, '0')
where booking_code is null;

create unique index if not exists appointments_booking_code_unique
  on public.appointments(booking_code)
  where booking_code is not null;

drop function if exists public.book_appointment(text, text, timestamptz, text, text);

create function public.book_appointment(
  p_full_name text,
  p_phone text,
  p_appt_at timestamptz,
  p_reason text,
  p_doctor text default ''
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

  insert into public.appointments (patient_id, appt_at, reason, doctor, status)
  values (
    v_patient_id,
    p_appt_at,
    trim(coalesce(p_reason, '')),
    trim(coalesce(p_doctor, '')),
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

revoke all on function public.book_appointment(text, text, timestamptz, text, text) from public;
grant execute on function public.book_appointment(text, text, timestamptz, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
