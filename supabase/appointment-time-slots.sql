-- Run after appointment-schedule.sql to enforce ten appointments per hour,
-- from 8:00 AM through 4:00 PM Manila time.

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
  if new.status in ('Cancelled', 'Done') or coalesce(trim(new.doctor), '') = '' then
    return new;
  end if;
  if new.appt_at <= now() then
    raise exception 'Appointment time must be in the future';
  end if;

  v_local_date := (new.appt_at at time zone 'Asia/Manila')::date;
  v_local_time := (new.appt_at at time zone 'Asia/Manila')::time;
  if v_local_time < time '08:00' or v_local_time >= time '17:00'
    or extract(minute from v_local_time) <> 0
    or extract(second from v_local_time) <> 0 then
    raise exception 'Appointments must start on the hour between 8:00 AM and 4:00 PM';
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
    from public.appointments existing
    where existing.id is distinct from new.id
      and existing.status not in ('Cancelled', 'Done')
      and lower(trim(existing.doctor)) = lower(trim(new.doctor))
      and (existing.appt_at at time zone 'Asia/Manila')::date = v_local_date
      and extract(hour from (existing.appt_at at time zone 'Asia/Manila')) = extract(hour from v_local_time)
  ) >= 10 then
    raise exception 'This hour is full. Please choose another hour.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_doctor_double_booking on public.appointments;
create trigger prevent_doctor_double_booking
  before insert or update on public.appointments
  for each row execute function public.prevent_doctor_double_booking();

notify pgrst, 'reload schema';
