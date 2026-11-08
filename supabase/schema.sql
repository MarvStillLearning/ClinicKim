-- Run this in Supabase > SQL Editor > New query > Run
-- Safe to run again: it only adds what is missing.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  role text not null default 'cashier'
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

create table if not exists products (
  id bigint generated always as identity primary key,
  name text not null,
  price numeric not null default 0,
  stock int not null default 0
);
alter table products add column if not exists category text default 'Medicine';

create table if not exists sales (
  id bigint generated always as identity primary key,
  patient_id bigint references patients,
  total numeric not null,
  amount_paid numeric not null,
  change_amount numeric not null,
  payment_method text not null,
  cashier_id uuid references auth.users,
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
  for t in select unnest(array['profiles','patients','records','appointments','products','sales','sale_items'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff only" on public.%I', t);
  end loop;
end $$;

drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_user_role() = 'admin');
drop policy if exists "profiles no client write" on public.profiles;
create policy "profiles no client write" on public.profiles for all to authenticated
  using (false) with check (false);

drop policy if exists "patients staff read" on public.patients;
drop policy if exists "patients staff insert" on public.patients;
drop policy if exists "patients staff update" on public.patients;
drop policy if exists "patients staff delete" on public.patients;
create policy "patients staff read" on public.patients for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'cashier'));
create policy "patients staff insert" on public.patients for insert to authenticated
  with check (public.current_user_role() in ('admin', 'doctor', 'cashier'));
create policy "patients staff update" on public.patients for update to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'cashier'))
  with check (public.current_user_role() in ('admin', 'doctor', 'cashier'));
create policy "patients staff delete" on public.patients for delete to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "records clinical" on public.records;
create policy "records clinical" on public.records for all to authenticated
  using (public.current_user_role() in ('admin', 'doctor'))
  with check (public.current_user_role() in ('admin', 'doctor'));

drop policy if exists "appointments staff" on public.appointments;
drop policy if exists "appointments staff read" on public.appointments;
drop policy if exists "appointments staff write" on public.appointments;
drop policy if exists "appointments staff update" on public.appointments;
drop policy if exists "appointments admin delete" on public.appointments;
create policy "appointments staff read" on public.appointments for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'cashier'));
create policy "appointments staff write" on public.appointments for insert to authenticated
  with check (public.current_user_role() in ('admin', 'doctor', 'cashier'));
create policy "appointments staff update" on public.appointments for update to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'cashier'))
  with check (public.current_user_role() in ('admin', 'doctor', 'cashier'));
create policy "appointments admin delete" on public.appointments for delete to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "products staff read" on public.products;
drop policy if exists "products admin write" on public.products;
create policy "products staff read" on public.products for select to authenticated
  using (public.current_user_role() in ('admin', 'doctor', 'cashier'));
create policy "products admin write" on public.products for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "sales staff read" on public.sales;
drop policy if exists "sales no direct write" on public.sales;
create policy "sales staff read" on public.sales for select to authenticated
  using (public.current_user_role() in ('admin', 'cashier'));
create policy "sales no direct write" on public.sales for all to authenticated
  using (false) with check (false);

drop policy if exists "sale items staff read" on public.sale_items;
drop policy if exists "sale items no direct write" on public.sale_items;
create policy "sale items staff read" on public.sale_items for select to authenticated
  using (public.current_user_role() in ('admin', 'cashier'));
create policy "sale items no direct write" on public.sale_items for all to authenticated
  using (false) with check (false);

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
  if v_role not in ('admin', 'cashier') then raise exception 'Cashier access required'; end if;
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
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'doctor', 'cashier'));

-- Public patient appointment booking
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
  values (v_patient_id, p_appt_at, trim(coalesce(p_reason, '')), trim(coalesce(p_doctor, '')), 'Scheduled')
  returning id into v_appointment_id;

  update public.appointments
  set booking_code = 'APT-' || lpad(v_appointment_id::text, 6, '0')
  where id = v_appointment_id
  returning booking_code into v_booking_code;

  return jsonb_build_object('appointment_id', v_appointment_id, 'booking_code', v_booking_code);
end;
$$;

revoke all on function public.book_appointment(text, text, timestamptz, text, text) from public;
grant execute on function public.book_appointment(text, text, timestamptz, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
