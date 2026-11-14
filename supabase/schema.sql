-- Run this in Supabase > SQL Editor > New query > Run
-- Safe to run again: it only adds what is missing.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  role text not null default 'nurse'
);
alter table profiles add column if not exists email text;

create table if not exists patients (
  id bigint generated always as identity primary key,
  full_name text not null,
  phone text,
  created_at timestamptz default now()
);
alter table patients add column if not exists birthdate date;
alter table patients add column if not exists sex text;
alter table patients add column if not exists address text;
alter table patients add column if not exists allergies text;
alter table patients add column if not exists emergency_contact_name text;
alter table patients add column if not exists emergency_contact text;

create table if not exists records (
  id bigint generated always as identity primary key,
  patient_id bigint references patients on delete cascade,
  diagnosis text,
  treatment text,
  created_at timestamptz default now()
);
alter table records add column if not exists complaint text;
alter table records add column if not exists bp text;
alter table records add column if not exists temperature text;
alter table records add column if not exists weight numeric;
alter table records add column if not exists notes text;

create table if not exists appointments (
  id bigint generated always as identity primary key,
  patient_id bigint references patients on delete cascade,
  appt_at timestamptz not null,
  reason text,
  doctor text,
  status text not null default 'Scheduled',
  created_at timestamptz default now()
);
alter table appointments add column if not exists location text;

create table if not exists doctor_schedule_dates (
  id bigint generated always as identity primary key,
  doctor text not null,
  location text not null check (location in ('Sta. Ana, Cagayan', 'Gattaran, Cagayan')),
  available_date date not null,
  available_from time not null default time '08:00',
  available_until time not null default time '17:00',
  created_at timestamptz not null default now(),
  unique (doctor, location, available_date),
  constraint doctor_schedule_dates_hours_check
    check (available_from = time '08:00' and available_until = time '17:00')
);

-- Keep existing databases aligned with the 8:00 AM–5:00 PM availability shown in the app.
alter table doctor_schedule_dates drop constraint if exists doctor_schedule_dates_hours_check;
update doctor_schedule_dates
set available_from = time '08:00', available_until = time '17:00'
where available_from is distinct from time '08:00'
   or available_until is distinct from time '17:00';
alter table doctor_schedule_dates
  alter column available_from set default time '08:00',
  alter column available_until set default time '17:00',
  add constraint doctor_schedule_dates_hours_check
    check (available_from = time '08:00' and available_until = time '17:00');

create table if not exists products (
  id bigint generated always as identity primary key,
  name text not null,
  price numeric not null default 0,
  stock int not null default 0
);
alter table products add column if not exists category text default 'Medicine';
alter table products add column if not exists expiry_date date;

create table if not exists sales (
  id bigint generated always as identity primary key,
  patient_id bigint references patients,
  total numeric not null,
  amount_paid numeric not null,
  change_amount numeric not null,
  payment_method text not null,
  cashier_id uuid references auth.users on delete set null,
  created_at timestamptz default now()
);
alter table sales add column if not exists subtotal numeric default 0;
alter table sales add column if not exists discount numeric default 0;

create table if not exists sale_items (
  id bigint generated always as identity primary key,
  sale_id bigint references sales on delete cascade,
  product_id bigint references products,
  name text,
  price numeric,
  qty int
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  created_at timestamptz not null default now()
);

-- Patient deletion rules: remove records and appointments, preserve walk-in sales history.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_class referenced on referenced.oid = c.confrelid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
    where t.relname = 'appointments'
      and referenced.relname = 'patients'
      and a.attname = 'patient_id'
      and c.contype = 'f'
  loop
    execute format('alter table public.appointments drop constraint %I', constraint_name);
  end loop;
  alter table public.appointments
    add constraint appointments_patient_id_fkey
    foreign key (patient_id) references public.patients(id) on delete cascade;

  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_class referenced on referenced.oid = c.confrelid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
    where t.relname = 'sales'
      and referenced.relname = 'patients'
      and a.attname = 'patient_id'
      and c.contype = 'f'
  loop
    execute format('alter table public.sales drop constraint %I', constraint_name);
  end loop;
  alter table public.sales
    add constraint sales_patient_id_fkey
    foreign key (patient_id) references public.patients(id) on delete set null;
end $$;

-- Allow inventory products to be deleted without removing sales history.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'sale_items'
      and c.contype = 'f'
      and c.conkey = array[
        (select attnum from pg_attribute
         where attrelid = t.oid and attname = 'product_id')
      ]::smallint[]
  loop
    execute format('alter table public.sale_items drop constraint %I', constraint_name);
  end loop;

  alter table public.sale_items
    add constraint sale_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;
end $$;

-- Auto-create a profile when a new user is made
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists on_signup on auth.users;
create trigger on_signup after insert on auth.users
  for each row execute function public.handle_new_user();

-- Add profiles for users you already created
insert into profiles (id, full_name)
  select id, email from auth.users on conflict (id) do nothing;

-- Fill profile emails for accounts created before the email column existed
update profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Security: role-based access policies.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

do $$
declare t text;
begin
  for t in select unnest(array['profiles','patients','records','appointments','products','sales','sale_items','doctor_schedule_dates'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff only" on public.%I', t);
  end loop;
end $$;

drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_user_role() in ('admin', 'doctor'));
drop policy if exists "profiles no client write" on public.profiles;
create policy "profiles no client write" on public.profiles for all to authenticated
  using (false) with check (false);

drop policy if exists "patients staff read" on public.patients;
drop policy if exists "patients staff insert" on public.patients;
drop policy if exists "patients staff update" on public.patients;
drop policy if exists "patients staff delete" on public.patients;
create policy "patients staff read" on public.patients for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "patients staff insert" on public.patients for insert to authenticated
  with check (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "patients staff update" on public.patients for update to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'))
  with check (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "patients staff delete" on public.patients for delete to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'));

drop policy if exists "records clinical" on public.records;
create policy "records clinical" on public.records for all to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'))
  with check (public.current_user_role() in ('admin', 'doctor', 'nurse'));

drop policy if exists "appointments staff" on public.appointments;
drop policy if exists "appointments staff read" on public.appointments;
drop policy if exists "appointments staff write" on public.appointments;
drop policy if exists "appointments staff update" on public.appointments;
drop policy if exists "appointments admin delete" on public.appointments;
create policy "appointments staff read" on public.appointments for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "appointments staff write" on public.appointments for insert to authenticated
  with check (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "appointments staff update" on public.appointments for update to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'))
  with check (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "appointments admin delete" on public.appointments for delete to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'));

grant select, insert, delete on public.doctor_schedule_dates to authenticated;
grant usage, select on sequence public.doctor_schedule_dates_id_seq to authenticated;
drop policy if exists "doctor schedule dates admin manage" on public.doctor_schedule_dates;
create policy "doctor schedule dates admin manage" on public.doctor_schedule_dates for all to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'))
  with check (public.current_user_role() in ('admin', 'doctor', 'nurse'));

drop policy if exists "products staff read" on public.products;
drop policy if exists "products admin write" on public.products;
create policy "products staff read" on public.products for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "products admin write" on public.products for all to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'))
  with check (public.current_user_role() in ('admin', 'doctor', 'nurse'));

drop policy if exists "sales staff read" on public.sales;
drop policy if exists "sales no direct write" on public.sales;
create policy "sales staff read" on public.sales for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "sales no direct write" on public.sales for all to authenticated
  using (false) with check (false);

drop policy if exists "sale items staff read" on public.sale_items;
drop policy if exists "sale items no direct write" on public.sale_items;
create policy "sale items staff read" on public.sale_items for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'nurse'));
create policy "sale items no direct write" on public.sale_items for all to authenticated
  using (false) with check (false);

-- Audit trail: doctors and system admins can review, application users cannot modify audit entries.
alter table public.audit_logs enable row level security;
grant select on public.audit_logs to authenticated;
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read" on public.audit_logs for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor'));
drop policy if exists "audit no client write" on public.audit_logs;
create policy "audit no client write" on public.audit_logs for all to authenticated
  using (false) with check (false);

create or replace function public.log_sensitive_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text;
begin
  if current_setting('app.import_clinic_backup', true) = 'true'
    and public.current_user_role() = 'admin' then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    v_record_id := coalesce(to_jsonb(old)->>'id', '');
  else
    v_record_id := coalesce(to_jsonb(new)->>'id', '');
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id)
  values (auth.uid(), tg_op, tg_table_name, v_record_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists patients_audit_trigger on public.patients;
create trigger patients_audit_trigger
  after insert or update or delete on public.patients
  for each row execute function public.log_sensitive_action();

drop trigger if exists records_audit_trigger on public.records;
create trigger records_audit_trigger
  after insert or update or delete on public.records
  for each row execute function public.log_sensitive_action();

drop trigger if exists appointments_audit_trigger on public.appointments;
create trigger appointments_audit_trigger
  after insert or update or delete on public.appointments
  for each row execute function public.log_sensitive_action();

drop trigger if exists profiles_audit_trigger on public.profiles;
create trigger profiles_audit_trigger
  after insert or update or delete on public.profiles
  for each row execute function public.log_sensitive_action();

drop trigger if exists sales_audit_trigger on public.sales;
create trigger sales_audit_trigger
  after insert or update or delete on public.sales
  for each row execute function public.log_sensitive_action();

-- Public visitors may only read Medicine and Service prices.
drop policy if exists "public medicine and service prices" on public.products;
create policy "public medicine and service prices"
  on public.products
  for select
  to anon
  using (false);

drop view if exists public.public_product_prices;
create view public.public_product_prices
with (security_invoker = false) as
select id, name, category, price
from public.products
where category in ('Medicine', 'Service');
grant select on public.public_product_prices to anon;

-- Server-authoritative checkout: prices, stock, totals, cashier, and writes are validated atomically.
drop function if exists public.checkout_sale(bigint, jsonb, numeric, numeric, text);
create function public.checkout_sale(
  p_patient_id bigint,
  p_cart jsonb,
  p_discount numeric,
  p_amount_paid numeric,
  p_payment_method text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity integer;
  v_subtotal numeric := 0;
  v_discount numeric;
  v_total numeric;
  v_change numeric;
  v_sale_id bigint;
  v_created_at timestamptz;
  v_items jsonb := '[]'::jsonb;
  v_quantities jsonb := '{}'::jsonb;
  v_product_id text;
  v_aggregate_quantity integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_role := public.current_user_role();
  if v_role not in ('admin', 'doctor', 'nurse') then raise exception 'Staff access required'; end if;
  if p_cart is null or jsonb_typeof(p_cart) <> 'array' or jsonb_array_length(p_cart) = 0 then
    raise exception 'Cart is empty';
  end if;
  if jsonb_array_length(p_cart) > 100 then raise exception 'Cart exceeds item limit'; end if;
  if p_discount is null or p_discount < 0 then raise exception 'Invalid discount'; end if;
  if p_amount_paid is null or p_amount_paid < 0 then raise exception 'Invalid amount paid'; end if;
  if coalesce(p_payment_method, '') not in ('Cash', 'GCash', 'Card') then
    raise exception 'Invalid payment method';
  end if;
  if p_patient_id is not null and not exists (
    select 1 from public.patients where id = p_patient_id
  ) then raise exception 'Invalid patient'; end if;

  for v_item in select * from jsonb_array_elements(p_cart)
  loop
    if not (v_item ? 'product_id') or not (v_item ? 'qty') then
      raise exception 'Invalid cart item';
    end if;
    begin
      select * into v_product from public.products where id = (v_item->>'product_id')::bigint for update;
    exception
      when others then raise exception 'Invalid product';
    end;
    if v_product.id is null then raise exception 'Product not found'; end if;
    begin
      v_quantity := (v_item->>'qty')::integer;
    exception
      when others then raise exception 'Invalid quantity';
    end;
    if v_quantity < 1 or v_quantity > 999 then
      raise exception 'Invalid quantity';
    end if;
    v_product_id := v_product.id::text;
    v_aggregate_quantity := coalesce((v_quantities->>v_product_id)::integer, 0) + v_quantity;
    v_quantities := jsonb_set(v_quantities, array[v_product_id], to_jsonb(v_aggregate_quantity), true);
    if v_product.category <> 'Service' and v_product.stock < v_aggregate_quantity then
      raise exception 'Insufficient stock for %', v_product.name;
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  v_discount := least(p_discount, v_subtotal);
  v_total := v_subtotal - v_discount;
  v_change := p_amount_paid - v_total;
  if p_amount_paid < v_total then raise exception 'Payment is not enough'; end if;

  insert into public.sales (
    patient_id, subtotal, discount, total, amount_paid, change_amount, payment_method, cashier_id
  ) values (
    p_patient_id, v_subtotal, v_discount, v_total, p_amount_paid, v_change, p_payment_method, auth.uid()
  ) returning id, created_at into v_sale_id, v_created_at;

  for v_item in select * from jsonb_array_elements(p_cart)
  loop
    select * into v_product from public.products where id = (v_item->>'product_id')::bigint for update;
    v_quantity := (v_item->>'qty')::integer;
    insert into public.sale_items (sale_id, product_id, name, price, qty)
    values (v_sale_id, v_product.id, v_product.name, v_product.price, v_quantity);
    v_items := v_items || jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'price', v_product.price,
      'qty', v_quantity
    );
    if v_product.category <> 'Service' then
      update public.products
      set stock = stock - v_quantity
      where id = v_product.id;
    end if;
  end loop;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'created_at', v_created_at,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total', v_total,
    'amount_paid', p_amount_paid,
    'change_amount', v_change,
    'items', v_items
  );
end;
$$;

revoke all on function public.checkout_sale(bigint, jsonb, numeric, numeric, text) from public;
grant execute on function public.checkout_sale(bigint, jsonb, numeric, numeric, text) to authenticated;

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'nurse' where role = 'cashier';
alter table public.profiles alter column role set default 'nurse';
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'doctor', 'nurse'));

-- Public patient appointment booking
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
  v_local_date date := (p_appt_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_appt_at at time zone 'Asia/Manila')::time;
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

  return jsonb_build_object('appointment_id', v_appointment_id, 'booking_code', v_booking_code);
end;
$$;

revoke all on function public.book_appointment(text, text, timestamptz, text, text, text) from public;
grant execute on function public.book_appointment(text, text, timestamptz, text, text, text) to anon, authenticated;

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
      and role in ('admin', 'doctor', 'nurse')
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
      and v_local_time >= d.available_from
      and v_local_time < d.available_until
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
  if current_setting('app.import_clinic_backup', true) = 'true'
    and public.current_user_role() = 'admin' then return new; end if;
  if new.status in ('Cancelled', 'Done') or coalesce(trim(new.doctor), '') = '' then return new; end if;
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
create trigger prevent_doctor_double_booking
  before insert or update on public.appointments
  for each row execute function public.prevent_doctor_double_booking();

-- Admin-only, transactional import for JSON backups created by the application.
create or replace function public.import_clinic_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_row jsonb;
  v_rows jsonb;
  v_update_columns text;
  v_row_count integer;
  v_table_count integer;
  v_max_id bigint;
  v_sequence text;
  v_counts jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or public.current_user_role() <> 'admin' then
    raise exception 'Admin access required to import backups';
  end if;
  if p_backup->>'format' is distinct from 'clinic-system-backup'
    or p_backup->>'version' is distinct from '1'
    or jsonb_typeof(p_backup->'tables') <> 'object' then
    raise exception 'Unsupported clinic backup file';
  end if;

  perform set_config('app.import_clinic_backup', 'true', true);
  foreach v_table in array array[
    'profiles', 'patients', 'products', 'doctor_schedule_dates',
    'appointments', 'records', 'sales', 'sale_items', 'audit_logs'
  ] loop
    v_rows := p_backup->'tables'->v_table;
    if v_rows is null then
      raise exception 'Backup is missing table data for %', v_table;
    end if;
    if jsonb_typeof(v_rows) <> 'array' then
      raise exception 'Backup data for % must be an array', v_table;
    end if;

    v_table_count := 0;
    for v_row in select value from jsonb_array_elements(v_rows)
    loop
      if jsonb_typeof(v_row) <> 'object' then
        raise exception 'Backup row in % must be an object', v_table;
      end if;

      if v_table = 'profiles' then
        -- Preserve system-admin roles and never allow an import to create a new admin.
        if v_row->>'id' is null then
          raise exception 'Profile backup row is missing its ID';
        end if;
        if v_row->>'role' in ('doctor', 'nurse')
          and exists (select 1 from auth.users where id = (v_row->>'id')::uuid) then
          insert into public.profiles (id, full_name, email, role)
          values ((v_row->>'id')::uuid, v_row->>'full_name', v_row->>'email', v_row->>'role')
          on conflict (id) do update
            set full_name = excluded.full_name,
                email = excluded.email,
                role = excluded.role
            where profiles.role <> 'admin';
          get diagnostics v_row_count = row_count;
          v_table_count := v_table_count + v_row_count;
        end if;
      else
        if v_table = 'sales' and v_row->>'cashier_id' is not null
          and not exists (select 1 from auth.users where id = (v_row->>'cashier_id')::uuid) then
          v_row := jsonb_set(v_row, '{cashier_id}', 'null'::jsonb);
        elsif v_table = 'audit_logs' and v_row->>'actor_id' is not null
          and not exists (select 1 from auth.users where id = (v_row->>'actor_id')::uuid) then
          v_row := jsonb_set(v_row, '{actor_id}', 'null'::jsonb);
        end if;

        select string_agg(format('%I = EXCLUDED.%I', column_name, column_name), ', ' order by ordinal_position)
          into v_update_columns
          from information_schema.columns
          where table_schema = 'public' and table_name = v_table and column_name <> 'id';

        if v_update_columns is null then
          raise exception 'Backup table % is not supported', v_table;
        end if;
        execute format(
          'insert into public.%I overriding system value select * from jsonb_populate_record(null::public.%I, $1) on conflict (id) do update set %s',
          v_table, v_table, v_update_columns
        ) using v_row;
        get diagnostics v_row_count = row_count;
        v_table_count := v_table_count + v_row_count;
      end if;
    end loop;
    v_counts := v_counts || jsonb_build_object(v_table, v_table_count);
  end loop;

  -- Keep identity sequences ahead of IDs restored from the file.
  foreach v_table in array array['patients', 'records', 'appointments', 'doctor_schedule_dates', 'products', 'sales', 'sale_items', 'audit_logs'] loop
    v_sequence := pg_get_serial_sequence(format('public.%I', v_table), 'id');
    if v_sequence is not null then
      execute format('select coalesce(max(id), 0) from public.%I', v_table) into v_max_id;
      perform setval(v_sequence::regclass, greatest(v_max_id, 1), v_max_id > 0);
    end if;
  end loop;

  insert into public.audit_logs (actor_id, action, table_name, record_id)
  values (auth.uid(), 'IMPORT', 'backup', p_backup->>'created_at');
  return jsonb_build_object('rows', v_counts, 'audit_recorded', true);
end;
$$;
revoke all on function public.import_clinic_backup(jsonb) from public;
grant execute on function public.import_clinic_backup(jsonb) to authenticated;

notify pgrst, 'reload schema';
