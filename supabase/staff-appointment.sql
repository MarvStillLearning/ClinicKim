-- Run after schema.sql and appointment-schedule.sql.
-- Lets signed-in staff book an existing patient only during published availability.

create or replace function public.book_staff_appointment(
  p_patient_id bigint,
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
  v_local_date date;
  v_local_time time;
  v_appointment_id bigint;
  v_booking_code text;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'doctor', 'cashier')
  ) then
    raise exception 'Staff access required';
  end if;

  if p_patient_id is null or not exists (
    select 1 from public.patients where id = p_patient_id
  ) then
    raise exception 'Select an existing patient';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 or length(trim(p_reason)) > 500 then
    raise exception 'Reason must be between 1 and 500 characters';
  end if;
  if length(trim(coalesce(p_doctor, ''))) = 0 or length(trim(p_doctor)) > 100 then
    raise exception 'Select an available doctor';
  end if;
  if trim(coalesce(p_location, '')) not in ('Sta. Ana, Cagayan', 'Gattaran, Cagayan') then
    raise exception 'Select a valid clinic location';
  end if;
  if p_appt_at is null or p_appt_at <= now() then
    raise exception 'Appointment time must be in the future';
  end if;

  v_local_date := (p_appt_at at time zone 'Asia/Manila')::date;
  v_local_time := (p_appt_at at time zone 'Asia/Manila')::time;
  if not exists (
    select 1
    from public.doctor_schedule_dates d
    where d.doctor = trim(p_doctor)
      and d.location = trim(p_location)
      and d.available_date = v_local_date
      and v_local_time between d.available_from and d.available_until
  ) then
    raise exception 'This appointment date or time is not available';
  end if;

  insert into public.appointments (patient_id, appt_at, reason, doctor, location, status)
  values (p_patient_id, p_appt_at, trim(p_reason), trim(p_doctor), trim(p_location), 'Scheduled')
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

revoke all on function public.book_staff_appointment(bigint, timestamptz, text, text, text) from public;
revoke all on function public.book_staff_appointment(bigint, timestamptz, text, text, text) from anon;
grant execute on function public.book_staff_appointment(bigint, timestamptz, text, text, text) to authenticated;

notify pgrst, 'reload schema';
